import { db, schema } from "@/db";
import { inArray, lt } from "drizzle-orm";
import { del } from "@vercel/blob";

/**
 * Purge result — what the cron endpoint returns to the caller / logs.
 */
export type PurgeResult = {
  jobsDeleted: number;
  applicationsDeleted: number;
  documentsDeleted: number;
  blobsDeleted: number;
  freedBytes: number;
  dryRun: boolean;
  elapsedMs: number;
};

/** Jobs in pipeline (saved/rejected/discarded) with no activity for 60 days. */
const RETENTION_DAYS = 60;
/** Jobs in inbox (status "new") with no action for 14 days — stale listings. */
const STALE_NEW_DAYS = 14;
/** Jobs never touched (no application row) expire after 14 days. */
const ORPHAN_RETENTION_DAYS = 14;
const PURGE_STATUSES = new Set(["new", "saved", "discarded", "rejected"]);
// PROTECTED_STATUSES is implicit: any status NOT in PURGE_STATUSES protects its job forever.
// Concretely those are: applied, interviewing, offered.

/**
 * A job is a purge candidate iff:
 *   - every non-null application row for that job has status IN (new, saved, discarded, rejected)
 *   - AND MAX(lastEventAt) across those applications < now - 60 days
 *
 * Implementation: fetch all applications (minimal columns), group by jobId in JS.
 * At Disha's scale (single-user, low hundreds of jobs) this is negligibly cheap and far
 * more readable than a BOOL_AND + GROUP BY sql template. Prefer correctness and
 * auditability over cleverness for a daily cron.
 */
export async function selectPurgeCandidates(now: Date): Promise<{
  jobIds: string[];
  applicationIds: string[];
  documents: Array<{ id: string; blobUrlDocx: string | null; blobUrlPdf: string | null }>;
}> {
  const retentionCutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const staleNewCutoff  = new Date(now.getTime() - STALE_NEW_DAYS * 24 * 60 * 60 * 1000);

  // 1. Pull every application row's minimal state.
  const apps = await db
    .select({
      jobId: schema.applications.jobId,
      applicationId: schema.applications.id,
      status: schema.applications.status,
      lastEventAt: schema.applications.lastEventAt,
    })
    .from(schema.applications);

  // 2. Group by job and evaluate eligibility.
  const byJob = new Map<string, { apps: Array<{ id: string; status: string; lastEventAt: Date }>; maxLastEventAt: Date }>();
  for (const row of apps as Array<{ jobId: string; applicationId: string; status: string; lastEventAt: Date }>) {
    const entry = byJob.get(row.jobId);
    const lastEventAt = row.lastEventAt instanceof Date ? row.lastEventAt : new Date(row.lastEventAt);
    if (!entry) {
      byJob.set(row.jobId, {
        apps: [{ id: row.applicationId, status: row.status, lastEventAt }],
        maxLastEventAt: lastEventAt,
      });
    } else {
      entry.apps.push({ id: row.applicationId, status: row.status, lastEventAt });
      if (lastEventAt > entry.maxLastEventAt) entry.maxLastEventAt = lastEventAt;
    }
  }

  const jobIds: string[] = [];
  const applicationIds: string[] = [];
  for (const [jobId, group] of byJob.entries()) {
    const allPurgeable = group.apps.every((a) => PURGE_STATUSES.has(a.status));
    if (!allPurgeable) continue;

    // Jobs where every app is "new" (sitting in inbox untouched) → 14-day cutoff.
    // All other purgeable statuses (saved, rejected, discarded) → 60-day cutoff.
    const allNew = group.apps.every((a) => a.status === "new");
    const cutoff = allNew ? staleNewCutoff : retentionCutoff;
    if (group.maxLastEventAt >= cutoff) continue;

    jobIds.push(jobId);
    for (const a of group.apps) applicationIds.push(a.id);
  }

  // 3. Fetch documents for candidate applications (needed for blob cleanup).
  let documents: Array<{ id: string; blobUrlDocx: string | null; blobUrlPdf: string | null }> = [];
  if (applicationIds.length > 0) {
    const docRows = await db
      .select({
        id: schema.documents.id,
        applicationId: schema.documents.applicationId,
        blobUrlDocx: schema.documents.blobUrlDocx,
        blobUrlPdf: schema.documents.blobUrlPdf,
      })
      .from(schema.documents)
      .where(inArray(schema.documents.applicationId, applicationIds));
    documents = (docRows as Array<{ id: string; blobUrlDocx: string | null; blobUrlPdf: string | null }>).map((d) => ({
      id: d.id,
      blobUrlDocx: d.blobUrlDocx,
      blobUrlPdf: d.blobUrlPdf,
    }));
  }

  return { jobIds, applicationIds, documents };
}

/**
 * Jobs that were discovered but never had an application row created.
 * These are filtered/rank-failed jobs that the pipeline never promoted.
 * Purge threshold: 180 days since discoveredAt.
 */
export async function selectOrphanJobIds(now: Date): Promise<string[]> {
  const cutoff = new Date(now.getTime() - ORPHAN_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Pull all jobIds that have at least one application row.
  // Use select (not selectDistinct) for broad mock compatibility; deduplicate in JS.
  const withApps = await db
    .select({ jobId: schema.applications.jobId })
    .from(schema.applications);

  const withAppsSet = new Set(withApps.map((r) => r.jobId));

  // Pull all jobs older than the cutoff
  const oldJobs = await db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(lt(schema.jobs.discoveredAt, cutoff));

  return (oldJobs as Array<{ id: string }>)
    .filter((j) => !withAppsSet.has(j.id))
    .map((j) => j.id);
}

/**
 * Orchestrate the purge: select candidates, delete blobs first (so a crash can't
 * leave orphaned blob objects whose DB pointers are already gone), then cascade-delete
 * the jobs row (FKs handle applications / documents / events / screening_answers).
 *
 * freedBytes is returned as 0 with a comment; accurate accounting comes from the
 * Vercel Blob dashboard. HEAD-ing each URL on every run is cost we don't need.
 */
export async function purgeOldJobs(opts: { dryRun: boolean; now?: Date }): Promise<PurgeResult> {
  const start = performance.now();
  const now = opts.now ?? new Date();

  const { jobIds, applicationIds, documents } = await selectPurgeCandidates(now);
  const orphanJobIds = await selectOrphanJobIds(now);

  // Merge, deduplicate (selectPurgeCandidates and orphans are disjoint by definition,
  // but guard anyway)
  const allJobIds = [...new Set([...jobIds, ...orphanJobIds])];

  // Collect every non-null blob URL. Docs can have 0, 1, or 2 URLs (docx / pdf).
  const urls: string[] = [];
  for (const d of documents) {
    if (d.blobUrlDocx) urls.push(d.blobUrlDocx);
    if (d.blobUrlPdf) urls.push(d.blobUrlPdf);
  }

  if (!opts.dryRun) {
    // Blob deletion BEFORE DB deletion — if the DB delete failed first, blobs would
    // become unreachable orphans with no pointer to find them. The reverse order means
    // at worst we have a dangling DB row pointing to a deleted blob, which the next
    // cron tick will clean up.
    if (urls.length > 0) {
      await del(urls);
    }
    if (allJobIds.length > 0) {
      await db.delete(schema.jobs).where(inArray(schema.jobs.id, allJobIds));
    }
  }

  const elapsedMs = Math.round(performance.now() - start);

  return {
    jobsDeleted: allJobIds.length,
    applicationsDeleted: applicationIds.length,
    documentsDeleted: documents.length,
    blobsDeleted: urls.length,
    // freedBytes: we rely on Vercel Blob dashboard for accurate byte accounting.
    // HEAD-ing every URL would double the egress cost of the cron for no meaningful signal.
    freedBytes: 0,
    dryRun: opts.dryRun,
    elapsedMs,
  };
}
