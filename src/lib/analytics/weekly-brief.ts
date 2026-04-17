import { db, schema } from "@/db";
import { sql, eq, isNotNull, gte, and } from "drizzle-orm";
import { startOfWeek } from "date-fns";
import { SOURCE_LABELS } from "./source-quality";

export const TARGET_APPLICATIONS_PER_WEEK = 5;

export interface WeeklyBrief {
  generatedAt: string;
  weekStarting: string;
  applicationsSentThisWeek: number;
  targetPacePerWeek: number;
  t1Available: number;
  t1Applied: number;
  topSourceThisWeek: string;
  callout: string;
}

interface CalloutInput {
  applicationsSentThisWeek: number;
  targetPacePerWeek: number;
  t1Available: number;
  t1Applied: number;
  topSourceThisWeek: string;
}

/** Pure rules engine — unit testable without DB. */
export function computeCallout(input: CalloutInput): string {
  const { applicationsSentThisWeek, targetPacePerWeek, t1Available, t1Applied, topSourceThisWeek } = input;

  // Rule 3 has priority over Rule 2 when t1Available > 0 and none applied yet
  if (t1Available > 0 && t1Applied === 0) {
    return `${t1Available} T1 job${t1Available === 1 ? "" : "s"} discovered — none applied yet`;
  }
  // Rule 1: Behind pace
  if (applicationsSentThisWeek < targetPacePerWeek * 0.6) {
    return `Behind pace — only ${applicationsSentThisWeek} of ${targetPacePerWeek} applications sent this week`;
  }
  // Rule 4: Low T1 application rate
  if (t1Available >= 3 && t1Applied / t1Available < 0.5) {
    return `Only ${t1Applied} of ${t1Available} T1 jobs applied — ${t1Available - t1Applied} remain`;
  }
  // Rule 2: Pace on track (only when no T1 context to show)
  if (applicationsSentThisWeek >= targetPacePerWeek && t1Available === 0) {
    return `Pace on track — ${applicationsSentThisWeek} applications sent this week`;
  }
  // Rule 5: Default (catches on-pace with T1 data, or any other case)
  if (t1Available > 0) {
    return `Top source: ${topSourceThisWeek} with ${t1Available} T1 jobs this week`;
  }
  // Rule 2 fallback: on-pace, no T1 data at all
  if (applicationsSentThisWeek >= targetPacePerWeek) {
    return `Pace on track — ${applicationsSentThisWeek} applications sent this week`;
  }
  // True default
  return `Top source: ${topSourceThisWeek} with ${t1Available} T1 jobs this week`;
}

/** Reads DB and produces the weekly brief. No LLM calls. */
export async function generateWeeklyBrief(): Promise<WeeklyBrief> {
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekIso = thisWeekStart.toISOString().slice(0, 10);
  const nextWeekStart = new Date(thisWeekStart.getTime() + 7 * 86400 * 1000);

  // Applications sent this week
  const [appsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.applications)
    .where(
      and(
        isNotNull(schema.applications.appliedAt),
        gte(schema.applications.appliedAt, thisWeekStart),
      ),
    );

  const applicationsSentThisWeek = appsRow?.count ?? 0;

  // T1 jobs discovered this week, grouped by source
  const t1BySource = await db
    .select({
      source: schema.jobs.source,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.tier, 1),
        gte(schema.jobs.discoveredAt, thisWeekStart),
        sql`${schema.jobs.discoveredAt} < ${nextWeekStart.toISOString()}::timestamptz`,
      ),
    )
    .groupBy(schema.jobs.source)
    .orderBy(sql`count(*) desc`);

  const t1Available = t1BySource.reduce((s, r) => s + r.count, 0);
  const topSourceRaw = t1BySource[0]?.source ?? null;
  const topSourceThisWeek = topSourceRaw ? (SOURCE_LABELS[topSourceRaw] ?? topSourceRaw) : "—";

  // T1 applications sent this week
  const [t1AppsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.applications)
    .innerJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
    .where(
      and(
        isNotNull(schema.applications.appliedAt),
        gte(schema.applications.appliedAt, thisWeekStart),
        eq(schema.jobs.tier, 1),
      ),
    );

  const t1Applied = t1AppsRow?.count ?? 0;

  const calloutInput: CalloutInput = {
    applicationsSentThisWeek,
    targetPacePerWeek: TARGET_APPLICATIONS_PER_WEEK,
    t1Available,
    t1Applied,
    topSourceThisWeek,
  };

  return {
    generatedAt: new Date().toISOString(),
    weekStarting: thisWeekIso,
    applicationsSentThisWeek,
    targetPacePerWeek: TARGET_APPLICATIONS_PER_WEEK,
    t1Available,
    t1Applied,
    topSourceThisWeek,
    callout: computeCallout(calloutInput),
  };
}
