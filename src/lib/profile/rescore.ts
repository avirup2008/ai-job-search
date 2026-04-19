import pLimit from "p-limit";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { assessJob } from "@/lib/pipeline/rank";
import { assignTier } from "@/lib/pipeline/tier";
import { getBudget } from "@/lib/llm/budget";
import type { Profile } from "@/lib/profile/types";

const RESCORE_CONCURRENCY = 3;

export interface RescoreResult {
  updated: number;
  costEur: number;
  profileFound: boolean;
  jobCount: number;
}

/**
 * Rescore all jobs in the DB against the latest profile.
 *
 * Runs Haiku fit assessment on each job, updates fitScore/fitBreakdown/gapAnalysis/tier.
 * Returns diagnostic counts so callers can surface "no profile" vs "no jobs" to the UI.
 */
export async function rescoreMatchedJobs(): Promise<RescoreResult> {
  const [profileRow] = await db.select().from(schema.profile).limit(1);
  if (!profileRow) {
    console.warn("[rescore] no profile row — skipping");
    return { updated: 0, costEur: 0, profileFound: false, jobCount: 0 };
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

  // Fetch all jobs — no tier filter; first run in production has tier=null everywhere.
  const jobs = await db
    .select({ id: schema.jobs.id, jdText: schema.jobs.jdText, title: schema.jobs.title })
    .from(schema.jobs);

  console.log(`[rescore] profile found, jobCount=${jobs.length}`);

  if (jobs.length === 0) {
    return { updated: 0, costEur: 0, profileFound: true, jobCount: 0 };
  }

  // Track cost via budget delta — assessJob() records spend via gateway internally.
  const before = await getBudget(20);
  const limit = pLimit(RESCORE_CONCURRENCY);
  let updated = 0;

  await Promise.all(
    jobs.map((j) =>
      limit(async () => {
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
          console.error(`[rescore-failed] ${j.id} "${j.title.slice(0, 50)}": ${msg.slice(0, 200)}`);
        }
      }),
    ),
  );

  const after = await getBudget(20);
  const costEur = Math.max(0, after.eurSpent - before.eurSpent);
  return { updated, costEur, profileFound: true, jobCount: jobs.length };
}
