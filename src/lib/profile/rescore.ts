import pLimit from "p-limit";
import { eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { assessJob } from "@/lib/pipeline/rank";
import { assignTier } from "@/lib/pipeline/tier";
import { getBudget } from "@/lib/llm/budget";
import type { Profile } from "@/lib/profile/types";

const RESCORE_CONCURRENCY = 3;
// Vercel Hobby cap is 60s. Each Haiku call ~2-3s, 3 concurrent → 15 jobs ≈ 15s. Safe.
const BATCH_SIZE = 15;

export interface RescoreResult {
  updated: number;
  costEur: number;
  profileFound: boolean;
  jobCount: number;   // jobs processed this batch
  remaining: number;  // unscored jobs still left after this batch
  firstError?: string;
}

/**
 * Rescore up to BATCH_SIZE jobs against the latest profile, prioritising
 * unscored jobs (fitScore IS NULL) first. Call repeatedly until remaining=0.
 */
export async function rescoreMatchedJobs(): Promise<RescoreResult> {
  const [profileRow] = await db.select().from(schema.profile).limit(1);
  if (!profileRow) {
    console.warn("[rescore] no profile row — skipping");
    return { updated: 0, costEur: 0, profileFound: false, jobCount: 0, remaining: 0 };
  }

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

  // Count how many jobs still need scoring so we can report remaining.
  const [{ unscoredTotal }] = await db
    .select({ unscoredTotal: sql<number>`count(*)` })
    .from(schema.jobs)
    .where(isNull(schema.jobs.fitScore));

  const remaining = Math.max(0, Number(unscoredTotal) - BATCH_SIZE);

  // Fetch next batch: unscored jobs first, then oldest discovered.
  const jobs = await db
    .select({ id: schema.jobs.id, jdText: schema.jobs.jdText, title: schema.jobs.title })
    .from(schema.jobs)
    .orderBy(
      sql`${schema.jobs.fitScore} IS NOT NULL`,  // nulls (unscored) first
      schema.jobs.discoveredAt,
    )
    .limit(BATCH_SIZE);

  console.log(`[rescore] profile found, batch=${jobs.length}, unscoredTotal=${unscoredTotal}`);

  if (jobs.length === 0) {
    return { updated: 0, costEur: 0, profileFound: true, jobCount: 0, remaining: 0 };
  }

  const before = await getBudget(20);
  const limiter = pLimit(RESCORE_CONCURRENCY);
  let updated = 0;
  let firstError: string | undefined;

  await Promise.all(
    jobs.map((j) =>
      limiter(async () => {
        try {
          const rank = await assessJob({ jdText: j.jdText, jobTitle: j.title, profile });
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
                hardRequirementsMet: rank.assessment.hardRequirementsMet,
                dutchLanguageRequired: rank.assessment.dutchLanguageRequired,
              },
              tier,
            })
            .where(eq(schema.jobs.id, j.id));
          updated++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!firstError) firstError = msg;
          console.error(`[rescore-failed] ${j.id} "${j.title.slice(0, 50)}": ${msg.slice(0, 200)}`);
        }
      }),
    ),
  );

  const after = await getBudget(20);
  const costEur = Math.max(0, after.eurSpent - before.eurSpent);
  return { updated, costEur, profileFound: true, jobCount: jobs.length, remaining, firstError };
}
