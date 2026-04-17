import pLimit from "p-limit";
import { db, schema } from "@/db";
import { eq, sql, inArray, and } from "drizzle-orm";
import { discover } from "./discover";
import { clusterJobs, computeDedupeHash } from "./dedupe";
import { applyHardFilters, type FilterReason } from "./filters";
import { assessJob } from "./rank";
import { assignTier } from "./tier";
import type { Profile } from "@/lib/profile/types";
import type { RawJob } from "@/lib/sources/types";
import { readMultipliersFromProfile, blendFitScoreWithMultipliers, type ScoringMultipliers } from "@/lib/scoring/multipliers";
import { detectDrift } from "@/lib/scoring/drift";
import { generateCV } from "@/lib/generate/cv";
import { renderCvDocx } from "@/lib/generate/cv-docx";
import { storeCv } from "@/lib/generate/storage";

export interface SourceSummaryEntry {
  source: string;
  fetched: number;
  error: string | null;
}

export interface RunSummary {
  runId: string;
  counts: {
    discovered: number;
    clusters: number;
    inserted: number;
    skipped: number;     // duplicates already in DB
    filtered: number;    // passed insertion but hit a hard filter
    ranked: number;      // went through Haiku
    byTier: Record<string, number>;
    rescored: number;    // existing jobs re-scored via multipliers (no LLM)
    drifted: number;     // jobs whose tier changed after re-score
    cvGenerated: number; // R-84: CVs batch-generated for new T1/T2 jobs
    cvFailed: number;    // R-84: CV generation failures this run
    queuedScored: number; // R-82: url_paste queued rows scored this run
    queuedFailed: number; // R-82: url_paste queued rows that failed scoring (will retry)
  };
  sourceSummary: SourceSummaryEntry[];
  perSource: Record<string, number>;
  errors: Record<string, string>;
  cvErrors?: Array<{ jobId: string; documentKind: string; error: string }>;
  elapsedMs: number;
}

// Anthropic ITPM rate limits on Tier 1 accounts cap burst throughput.
// At p-limit(3) with ~3.5K input tokens each, ~10K ITPM per burst — safely
// under the common 50K ITPM limit. Observed run at 10 concurrent had 73%
// silent failure rate due to rate limits; 3 keeps ~100% success.
const RANK_CONCURRENCY = 3;
const MAX_CV_PER_RUN = 5;
const CV_CONCURRENCY = 2;

interface ClassifiedJob {
  j: RawJob;
  companyId: string | null;
  dedupeHash: string;
  filter: FilterReason | null;
}

/**
 * The nightly pipeline. Runs discover → dedupe → classify → rank (parallel) → persist.
 *
 * Idempotent: re-running will not insert duplicate jobs (unique index on source + sourceExternalId).
 * Records a run row up front; updates on completion or failure.
 *
 * Concurrency: LLM rank calls run in parallel (default 10 at a time).
 * Company upserts happen in a single pre-pass to avoid races.
 */
export async function runNightly(): Promise<RunSummary> {
  const started = Date.now();
  const [run] = await db.insert(schema.runs).values({ status: "running" }).returning();
  const runId = run.id;

  try {
    // 0. Clean up rank-failed rows from previous runs so they get re-attempted.
    //    A row is "rank-failed" if it has no tier, no hard_filter_reason, and no
    //    fit_score — meaning the LLM call crashed and we wrote a placeholder row.
    //    Applications are cascade-deleted (tier was null → no app row existed anyway).
    const deletedFailed = await db.execute(sql`
      DELETE FROM jobs
      WHERE tier IS NULL
        AND hard_filter_reason IS NULL
        AND fit_score IS NULL
      RETURNING id
    `);
    const retryCount = Array.isArray(deletedFailed) ? deletedFailed.length : (deletedFailed as { rowCount?: number }).rowCount ?? 0;
    if (retryCount > 0) {
      console.log(`[orchestrator] cleaned ${retryCount} rank-failed rows from prior runs — will re-attempt`);
    }

    // 0.5 pre-req: load profile (needed by both Step 0.5 and Step 6 rank pass)
    const [profileRow] = await db.select().from(schema.profile).limit(1);
    if (!profileRow) throw new Error("No profile row found — run scripts/seed-profile.ts first");
    const profile: Profile = {
      fullName: profileRow.fullName ?? "",
      headline: profileRow.headline ?? undefined,
      roles: profileRow.roles as Profile["roles"],
      achievements: profileRow.achievements as Profile["achievements"],
      toolStack: profileRow.toolStack as Profile["toolStack"],
      industries: profileRow.industries as Profile["industries"],
      stories: profileRow.stories as Profile["stories"],
      constraints: profileRow.constraints as Profile["constraints"],
      preferences: profileRow.preferences as Profile["preferences"],
      portfolioUrl: profileRow.portfolioUrl ?? undefined,
      linkedinUrl: profileRow.linkedinUrl,
      contactEmail: profileRow.contactEmail ?? undefined,
      phone: profileRow.phone ?? undefined,
    };

    const multipliers: ScoringMultipliers = readMultipliersFromProfile(profileRow.preferences);

    // 0.5: Score queued URL-paste rows (R-82).
    // These rows have source='url_paste' AND hard_filter_reason='queued' — inserted
    // synchronously by /api/queue-url and deferred to the nightly budget.
    // They survive Step 0's DELETE because hard_filter_reason IS NOT NULL.
    const queuedRows = await db
      .select({
        id: schema.jobs.id,
        title: schema.jobs.title,
        jdText: schema.jobs.jdText,
      })
      .from(schema.jobs)
      .where(and(
        eq(schema.jobs.source, "url_paste"),
        eq(schema.jobs.hardFilterReason, "queued"),
      ));

    let queuedScored = 0;
    let queuedFailed = 0;
    const queuedLimit = pLimit(RANK_CONCURRENCY);
    await Promise.all(
      queuedRows.map((row) =>
        queuedLimit(async () => {
          try {
            const rank = await assessJob({
              jdText: row.jdText,
              jobTitle: row.title,
              profile,
            });
            const tier = assignTier(rank.fitScore);
            await db
              .update(schema.jobs)
              .set({
                fitScore: String(rank.fitScore),
                fitBreakdown: rank.components,
                gapAnalysis: {
                  strengths: rank.assessment.strengths,
                  gaps: rank.assessment.gaps,
                  recommendation: rank.assessment.recommendation,
                  recommendationReason: rank.assessment.recommendationReason,
                },
                tier,
                seniority: rank.assessment.seniorityLevel,
                hardFilterReason: null,
              })
              .where(eq(schema.jobs.id, row.id));
            if (tier !== null) {
              await db.insert(schema.applications).values({
                jobId: row.id,
                status: "new",
              });
            }
            queuedScored++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[queue-url-rank-failed] jobId=${row.id}: ${msg.slice(0, 200)}`);
            queuedFailed++;
            // Leave hardFilterReason='queued' — next nightly will retry
          }
        }),
      ),
    );

    // 1. Discover + cluster
    const disc = await discover();
    const clusters = clusterJobs(disc.jobs);

    // 2. Pre-pass: idempotency check across the whole batch
    const existingRows = await db
      .select({ source: schema.jobs.source, sourceExternalId: schema.jobs.sourceExternalId })
      .from(schema.jobs);
    const existingSet = new Set(existingRows.map((r) => `${r.source}|${r.sourceExternalId ?? ""}`));

    // 3. Pre-pass: upsert unique companies sequentially (avoids races)
    const companyNames = new Set<string>();
    for (const c of clusters) {
      if (c.canonical.companyName) companyNames.add(c.canonical.companyName);
    }
    const companyIdByName = new Map<string, string>();
    for (const name of companyNames) {
      const [existingCo] = await db
        .select({ id: schema.companies.id })
        .from(schema.companies)
        .where(eq(schema.companies.name, name))
        .limit(1);
      if (existingCo) {
        companyIdByName.set(name, existingCo.id);
      } else {
        const [created] = await db
          .insert(schema.companies)
          .values({ name })
          .returning({ id: schema.companies.id });
        companyIdByName.set(name, created.id);
      }
    }

    // 4. Classify: skip / filter / rank
    const byTier: Record<string, number> = { "1": 0, "2": 0, "3": 0, "filtered": 0 };
    let skipped = 0;
    let inserted = 0;
    let filtered = 0;
    let ranked = 0;

    const toFilter: ClassifiedJob[] = [];
    const toRank: ClassifiedJob[] = [];

    for (const cluster of clusters) {
      const j = cluster.canonical;
      if (existingSet.has(`${j.source}|${j.sourceExternalId ?? ""}`)) {
        skipped++;
        continue;
      }

      const companyId = j.companyName ? companyIdByName.get(j.companyName) ?? null : null;
      const dedupeHash = computeDedupeHash({
        companyName: j.companyName,
        title: j.title,
        location: j.location,
        postedAt: j.postedAt,
      });
      const hardFilter = applyHardFilters({
        title: j.title,
        jdText: j.jdText,
        location: j.location,
        seniority: null,
      });
      const entry: ClassifiedJob = { j, companyId, dedupeHash, filter: hardFilter.filter };

      if (hardFilter.filter) toFilter.push(entry);
      else toRank.push(entry);
    }

    // 5. Insert filtered jobs (fast, no LLM cost) — sequential is fine at this scale
    for (const e of toFilter) {
      await db.insert(schema.jobs).values({
        companyId: e.companyId,
        source: e.j.source,
        sourceUrl: e.j.sourceUrl,
        sourceExternalId: e.j.sourceExternalId,
        title: e.j.title,
        jdText: e.j.jdText,
        location: e.j.location,
        postedAt: e.j.postedAt ?? null,
        dedupeHash: e.dedupeHash,
        dutchRequired: e.filter === "dutch_required",
        hardFilterReason: e.filter,
        tier: null,
      });
      filtered++;
      inserted++;
      byTier.filtered = (byTier.filtered ?? 0) + 1;
    }

    // 6. Rank + insert — parallelized up to RANK_CONCURRENCY
    const limit = pLimit(RANK_CONCURRENCY);
    await Promise.all(
      toRank.map((e) =>
        limit(async () => {
          let rank;
          try {
            rank = await assessJob({ jdText: e.j.jdText, jobTitle: e.j.title, profile });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[rank-failed] ${e.j.source}/${e.j.sourceExternalId} "${e.j.title.slice(0, 50)}": ${msg.slice(0, 200)}`);
            // Budget exhausted or rank failure — record without tier/fit, keep iterating
            await db.insert(schema.jobs).values({
              companyId: e.companyId,
              source: e.j.source,
              sourceUrl: e.j.sourceUrl,
              sourceExternalId: e.j.sourceExternalId,
              title: e.j.title,
              jdText: e.j.jdText,
              location: e.j.location,
              postedAt: e.j.postedAt ?? null,
              dedupeHash: e.dedupeHash,
              hardFilterReason: null,
              tier: null,
            });
            inserted++;
            return;
          }

          const tier = assignTier(rank.fitScore);
          const [insertedJob] = await db
            .insert(schema.jobs)
            .values({
              companyId: e.companyId,
              source: e.j.source,
              sourceUrl: e.j.sourceUrl,
              sourceExternalId: e.j.sourceExternalId,
              title: e.j.title,
              jdText: e.j.jdText,
              location: e.j.location,
              postedAt: e.j.postedAt ?? null,
              dedupeHash: e.dedupeHash,
              seniority: rank.assessment.seniorityLevel,
              fitScore: String(rank.fitScore),
              fitBreakdown: rank.components,
              gapAnalysis: {
                strengths: rank.assessment.strengths,
                gaps: rank.assessment.gaps,
                recommendation: rank.assessment.recommendation,
                recommendationReason: rank.assessment.recommendationReason,
              },
              tier,
            })
            .returning({ id: schema.jobs.id });

          if (tier !== null) {
            await db.insert(schema.applications).values({
              jobId: insertedJob.id,
              status: "new",
            });
          }

          inserted++;
          ranked++;
          const key = tier ? String(tier) : "filtered";
          byTier[key] = (byTier[key] ?? 0) + 1;
        }),
      ),
    );

    // 7. Re-score pass — re-apply profile multipliers to every existing ranked job.
    //    Uses stored fitBreakdown — NO Haiku calls — per D-1 (re-score ALL) and budget constraint.
    //    Industries are not stored as a dedicated column; seniority-only bucket is used instead.
    //    Plan 02 consumers may surface this gap once industries are stored explicitly.
    const existingRanked = await db
      .select({
        id: schema.jobs.id,
        tier: schema.jobs.tier,
        fitScore: schema.jobs.fitScore,
        fitBreakdown: schema.jobs.fitBreakdown,
        seniority: schema.jobs.seniority,
      })
      .from(schema.jobs);

    let rescoredCount = 0;
    let driftedCount = 0;
    for (const row of existingRanked) {
      if (row.tier == null) continue; // filtered or rank-failed — skip
      const fb = row.fitBreakdown as { skills?: number; tools?: number; seniority?: number; industry?: number } | null;
      if (!fb) continue;
      const components = {
        skills: fb.skills ?? 0,
        tools: fb.tools ?? 0,
        seniority: fb.seniority ?? 0,
        industry: fb.industry ?? 0,
      };
      // Industries are not stored as a dedicated column — use seniority-only bucket for now.
      // NOTE: Plan 02 should surface this gap; consumers expecting industry-keyed multipliers
      // will not see industry signal until a dedicated column is added.
      const seniorityStr = row.seniority ?? "";
      const newScore = blendFitScoreWithMultipliers(components, multipliers, { industries: [], seniority: seniorityStr });
      const newTier = assignTier(newScore);
      const drift = detectDrift(row.tier, newTier);
      rescoredCount++;
      if (drift.drifted) {
        driftedCount++;
        await db
          .update(schema.jobs)
          .set({ previousTier: row.tier, tier: newTier, fitScore: String(newScore) })
          .where(eq(schema.jobs.id, row.id));
        // Emit tier_drift event if an application row exists for this job
        const [app] = await db
          .select({ id: schema.applications.id })
          .from(schema.applications)
          .where(eq(schema.applications.jobId, row.id))
          .limit(1);
        if (app) {
          await db.insert(schema.events).values({
            applicationId: app.id,
            kind: "tier_drift",
            payload: { jobId: row.id, oldTier: row.tier, newTier, delta: drift.delta },
          });
        }
      } else if (Math.abs(Number(row.fitScore ?? 0) - newScore) > 0.5) {
        await db
          .update(schema.jobs)
          .set({ fitScore: String(newScore) })
          .where(eq(schema.jobs.id, row.id));
      }
    }

    // Build per-source summary after discovery
    const sourceSummary: SourceSummaryEntry[] = Object.entries(disc.perSource).map(([source, fetched]) => ({
      source,
      fetched,
      error: disc.errors[source] ?? null,
    }));

    // 8. Nightly CV generation — batch generate for new T1/T2 jobs (cap MAX_CV_PER_RUN)
    // R-84: every CV produced here runs through the ATS keyword pass inside generateCV().
    let cvGenerated = 0;
    let cvFailed = 0;
    const cvErrors: Array<{ jobId: string; documentKind: string; error: string }> = [];
    const needsCv = await db
      .select({
        applicationId: schema.applications.id,
        jobId: schema.jobs.id,
        tier: schema.jobs.tier,
      })
      .from(schema.applications)
      .innerJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
      .leftJoin(
        schema.documents,
        and(
          eq(schema.documents.applicationId, schema.applications.id),
          eq(schema.documents.kind, "cv"),
        ),
      )
      .where(and(inArray(schema.jobs.tier, [1, 2]), sql`${schema.documents.id} IS NULL`))
      .limit(MAX_CV_PER_RUN);

    const cvLimit = pLimit(CV_CONCURRENCY);
    await Promise.all(
      needsCv.map((row) =>
        cvLimit(async () => {
          try {
            const gen = await generateCV(row.jobId);
            const docxBuffer = await renderCvDocx(gen.cv);
            await storeCv({
              applicationId: row.applicationId,
              docxBuffer,
              tokenCostEur: gen.costEur,
              tier: row.tier ?? null,
            });
            cvGenerated++;
          } catch (err) {
            cvFailed++;
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[nightly-cv] jobId=${row.jobId}`, err);
            cvErrors.push({ jobId: row.jobId, documentKind: "cv", error: msg });
          }
        }),
      ),
    );

    const summary: RunSummary = {
      runId,
      counts: {
        discovered: disc.jobs.length,
        clusters: clusters.length,
        inserted,
        skipped,
        filtered,
        ranked,
        byTier,
        rescored: rescoredCount,
        drifted: driftedCount,
        cvGenerated,
        cvFailed,
        queuedScored,
        queuedFailed,
      },
      sourceSummary,
      perSource: disc.perSource,
      errors: disc.errors,
      cvErrors: cvErrors.length > 0 ? cvErrors : undefined,
      elapsedMs: Date.now() - started,
    };

    await db
      .update(schema.runs)
      .set({
        endedAt: sql`now()`,
        status: Object.keys(disc.errors).length > 0 ? "partial" : "succeeded",
        stageMetrics: summary,
        errorJson: cvErrors.length > 0 ? { cvErrors } : null,
      })
      .where(eq(schema.runs.id, runId));

    return summary;
  } catch (e) {
    await db
      .update(schema.runs)
      .set({
        endedAt: sql`now()`,
        status: "failed",
        errorJson: {
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        },
      })
      .where(eq(schema.runs.id, runId));
    throw e;
  }
}
