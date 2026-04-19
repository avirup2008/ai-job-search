import { db, schema } from "@/db";
import { isNotNull, sql } from "drizzle-orm";

export interface FeedbackInsights {
  positiveCount: number;     // applied + interview + offer
  negativeCount: number;     // rejected
  positiveAvgScore: number | null;
  positiveComponents: {
    skills: number;
    tools: number;
    seniority: number;
    industry: number;
  } | null;
  t1ConversionRate: number | null;  // % of T1 jobs that got applied
  t2ConversionRate: number | null;
  calibrationNote: string;
}

const POSITIVE_STATUSES = ["applied", "interview", "offer"] as const;
const NEGATIVE_STATUSES = ["rejected"] as const;

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function getFeedbackInsights(): Promise<FeedbackInsights> {
  // Join jobs with their applications to get status + fit data together
  const rows = await db
    .select({
      appStatus: schema.applications.status,
      fitScore: schema.jobs.fitScore,
      tier: schema.jobs.tier,
      fitBreakdown: schema.jobs.fitBreakdown,
    })
    .from(schema.applications)
    .innerJoin(schema.jobs, sql`${schema.jobs.id} = ${schema.applications.jobId}`)
    .where(isNotNull(schema.jobs.fitScore));

  // Also get all scored jobs (to compute tier counts regardless of application existence)
  const allScoredJobs = await db
    .select({
      fitScore: schema.jobs.fitScore,
      tier: schema.jobs.tier,
    })
    .from(schema.jobs)
    .where(isNotNull(schema.jobs.fitScore));

  const positive = rows.filter((j) =>
    POSITIVE_STATUSES.includes(j.appStatus as typeof POSITIVE_STATUSES[number])
  );
  const negative = rows.filter((j) =>
    NEGATIVE_STATUSES.includes(j.appStatus as typeof NEGATIVE_STATUSES[number])
  );

  const t1Jobs = allScoredJobs.filter((j) => j.tier === 1);
  const t2Jobs = allScoredJobs.filter((j) => j.tier === 2);
  const t1Applied = rows.filter(
    (j) => j.tier === 1 && POSITIVE_STATUSES.includes(j.appStatus as typeof POSITIVE_STATUSES[number])
  );
  const t2Applied = rows.filter(
    (j) => j.tier === 2 && POSITIVE_STATUSES.includes(j.appStatus as typeof POSITIVE_STATUSES[number])
  );

  if (positive.length === 0) {
    return {
      positiveCount: 0,
      negativeCount: negative.length,
      positiveAvgScore: null,
      positiveComponents: null,
      t1ConversionRate: null,
      t2ConversionRate: null,
      calibrationNote: "No applied/interview/offer jobs yet — apply to some roles to enable feedback learning.",
    };
  }

  const positiveScores = positive.map((j) => Number(j.fitScore)).filter(Boolean);
  const positiveAvgScore = Math.round(avg(positiveScores) * 10) / 10;

  const breakdown = (j: typeof rows[0]) =>
    (j.fitBreakdown ?? {}) as { skills?: number; tools?: number; seniority?: number; industry?: number };

  const positiveComponents = {
    skills: Math.round(avg(positive.map((j) => breakdown(j).skills ?? 0)) * 100) / 100,
    tools: Math.round(avg(positive.map((j) => breakdown(j).tools ?? 0)) * 100) / 100,
    seniority: Math.round(avg(positive.map((j) => breakdown(j).seniority ?? 0)) * 100) / 100,
    industry: Math.round(avg(positive.map((j) => breakdown(j).industry ?? 0)) * 100) / 100,
  };

  const t1ConversionRate =
    t1Jobs.length > 0 ? Math.round((t1Applied.length / t1Jobs.length) * 100) : null;
  const t2ConversionRate =
    t2Jobs.length > 0 ? Math.round((t2Applied.length / t2Jobs.length) * 100) : null;

  let calibrationNote = `Avg score of applied jobs: ${positiveAvgScore}. `;
  if (positiveAvgScore < 70) {
    calibrationNote += "Applying to lower-scored jobs — consider lowering T1 threshold.";
  } else if (positiveAvgScore > 82) {
    calibrationNote += "Applying only to top-scored jobs — algorithm well calibrated.";
  } else {
    calibrationNote += "T1/T2 boundary looks well calibrated.";
  }

  return {
    positiveCount: positive.length,
    negativeCount: negative.length,
    positiveAvgScore,
    positiveComponents,
    t1ConversionRate,
    t2ConversionRate,
    calibrationNote,
  };
}
