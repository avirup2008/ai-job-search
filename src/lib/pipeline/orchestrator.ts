import { db, schema } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { discover } from "./discover";
import { clusterJobs, computeDedupeHash } from "./dedupe";
import { applyHardFilters } from "./filters";
import { assessJob } from "./rank";
import { assignTier } from "./tier";
import type { Profile } from "@/lib/profile/types";

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
  };
  perSource: Record<string, number>;
  errors: Record<string, string>;
  elapsedMs: number;
}

/**
 * The nightly pipeline. Runs discover → dedupe → (per canonical) filter → optional rank → persist.
 * Idempotent: re-running will not insert duplicate jobs (unique index on source + sourceExternalId).
 * Records a run row up front; updates on completion or failure.
 */
export async function runNightly(): Promise<RunSummary> {
  const started = Date.now();
  const [run] = await db.insert(schema.runs).values({ status: "running" }).returning();
  const runId = run.id;

  try {
    // 1. Discover
    const disc = await discover();

    // 2. Cluster (cross-source dedup)
    const clusters = clusterJobs(disc.jobs);

    // 3. Load profile
    const [profileRow] = await db.select().from(schema.profile).limit(1);
    if (!profileRow) throw new Error("No profile row found — run scripts/seed-profile.ts first");
    const profile: Profile = {
      roles: profileRow.roles as Profile["roles"],
      achievements: profileRow.achievements as Profile["achievements"],
      toolStack: profileRow.toolStack as Profile["toolStack"],
      industries: profileRow.industries as Profile["industries"],
      stories: profileRow.stories as Profile["stories"],
      constraints: profileRow.constraints as Profile["constraints"],
      preferences: profileRow.preferences as Profile["preferences"],
    };

    const byTier: Record<string, number> = { "1": 0, "2": 0, "3": 0, "filtered": 0 };
    let inserted = 0;
    let skipped = 0;
    let filtered = 0;
    let ranked = 0;

    // 4. Per canonical: filter → (maybe rank) → persist
    for (const cluster of clusters) {
      const j = cluster.canonical;

      // Idempotency check BEFORE any LLM call
      const existing = await db
        .select({ id: schema.jobs.id })
        .from(schema.jobs)
        .where(and(eq(schema.jobs.source, j.source), eq(schema.jobs.sourceExternalId, j.sourceExternalId ?? "")))
        .limit(1);
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Ensure company row
      let companyId: string | null = null;
      if (j.companyName) {
        const [existingCo] = await db
          .select({ id: schema.companies.id })
          .from(schema.companies)
          .where(eq(schema.companies.name, j.companyName))
          .limit(1);
        if (existingCo) {
          companyId = existingCo.id;
        } else {
          const [created] = await db
            .insert(schema.companies)
            .values({ name: j.companyName, domain: j.companyDomain })
            .returning({ id: schema.companies.id });
          companyId = created.id;
        }
      }

      // Compute dedupe hash
      const dedupeHash = computeDedupeHash({
        companyName: j.companyName,
        title: j.title,
        location: j.location,
        postedAt: j.postedAt,
      });

      // Hard filter first (cheap)
      const hardFilter = applyHardFilters({ title: j.title, jdText: j.jdText, seniority: null });
      if (hardFilter.filter) {
        await db.insert(schema.jobs).values({
          companyId,
          source: j.source,
          sourceUrl: j.sourceUrl,
          sourceExternalId: j.sourceExternalId,
          title: j.title,
          jdText: j.jdText,
          location: j.location,
          postedAt: j.postedAt ?? null,
          dedupeHash,
          dutchRequired: hardFilter.filter === "dutch_required",
          hardFilterReason: hardFilter.filter,
          tier: null,
        });
        filtered++;
        inserted++;
        byTier.filtered = (byTier.filtered ?? 0) + 1;
        continue;
      }

      // Rank (burns Haiku tokens) — skip if budget blocks via thrown BudgetExceededError
      let rank;
      try {
        rank = await assessJob({ jdText: j.jdText, jobTitle: j.title, profile });
      } catch (e) {
        // Budget exhausted or rank failure — record the job without tier/fit, skip ranking
        await db.insert(schema.jobs).values({
          companyId,
          source: j.source,
          sourceUrl: j.sourceUrl,
          sourceExternalId: j.sourceExternalId,
          title: j.title,
          jdText: j.jdText,
          location: j.location,
          postedAt: j.postedAt ?? null,
          dedupeHash,
          hardFilterReason: null,
          tier: null,
        });
        inserted++;
        // Keep iterating — one bad rank shouldn't poison the run
        continue;
      }

      const tier = assignTier(rank.fitScore);

      const [insertedJob] = await db.insert(schema.jobs).values({
        companyId,
        source: j.source,
        sourceUrl: j.sourceUrl,
        sourceExternalId: j.sourceExternalId,
        title: j.title,
        jdText: j.jdText,
        location: j.location,
        postedAt: j.postedAt ?? null,
        dedupeHash,
        dutchRequired: rank.assessment.dutchRequired,
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
      }).returning({ id: schema.jobs.id });

      // Create application row in 'new' status for tiered jobs
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
    }

    const summary: RunSummary = {
      runId,
      counts: {
        discovered: disc.jobs.length,
        clusters: clusters.length,
        inserted, skipped, filtered, ranked, byTier,
      },
      perSource: disc.perSource,
      errors: disc.errors,
      elapsedMs: Date.now() - started,
    };

    await db
      .update(schema.runs)
      .set({
        endedAt: sql`now()`,
        status: Object.keys(disc.errors).length > 0 ? "partial" : "succeeded",
        stageMetrics: summary,
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
