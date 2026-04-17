import { db, schema } from "@/db";
import { sql, isNotNull, and, eq, gte } from "drizzle-orm";
import { startOfWeek, subWeeks } from "date-fns";
import { SOURCE_LABELS } from "./source-quality";

export interface MarketPulse {
  avgDaysToResponse: number | null;
  t1TrendLabel: string;
  t1TrendDirection: "up" | "down" | "neutral";
  sourceResponseRate: { source: string; label: string; rate: number }[];
}

interface MarketPulseRaw {
  avgDays: number | null;
  t1ThisWeek: number;
  t1FourWeekAvg: number;
  sourceResponseRows: { source: string; applied: number; responded: number }[];
}

/** Pure computation — unit testable without DB. */
export function computeMarketPulse(raw: MarketPulseRaw): MarketPulse {
  // T1 trend label
  let t1TrendLabel = "No data yet";
  let t1TrendDirection: "up" | "down" | "neutral" = "neutral";
  if (raw.t1FourWeekAvg > 0 || raw.t1ThisWeek > 0) {
    const pctChange =
      raw.t1FourWeekAvg > 0
        ? Math.round(((raw.t1ThisWeek - raw.t1FourWeekAvg) / raw.t1FourWeekAvg) * 100)
        : 0;
    if (pctChange > 5) {
      t1TrendDirection = "up";
      t1TrendLabel = `+${pctChange}% vs 4-week avg`;
    } else if (pctChange < -5) {
      t1TrendDirection = "down";
      t1TrendLabel = `${pctChange}% vs 4-week avg`;
    } else {
      t1TrendLabel = `${raw.t1ThisWeek} T1 this week (stable)`;
    }
  }

  // Source response rate
  const sourceResponseRate = raw.sourceResponseRows.map((r) => ({
    source: r.source,
    label: SOURCE_LABELS[r.source] ?? r.source,
    rate: r.applied > 0 ? Math.round((r.responded / r.applied) * 1000) / 10 : 0.0,
  }));

  return {
    avgDaysToResponse: raw.avgDays ?? null,
    t1TrendLabel,
    t1TrendDirection,
    sourceResponseRate,
  };
}

/** DB queries — returns computed MarketPulse from live data. */
export async function queryMarketPulse(): Promise<MarketPulse> {
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const fourWeeksAgo = subWeeks(thisWeekStart, 4);

  // Days-to-response: use lastEventAt fallback (safe when events table is sparse).
  // Measures elapsed days from appliedAt to last status change for applications
  // that have progressed past "applied" (interview, offer, or rejected).
  const [daysRow] = await db
    .select({
      avgDays: sql<number | null>`
        round(avg(
          extract(epoch from (${schema.applications.lastEventAt} - ${schema.applications.appliedAt})) / 86400
        )::numeric, 1)
      `,
    })
    .from(schema.applications)
    .where(
      and(
        isNotNull(schema.applications.appliedAt),
        sql`${schema.applications.status} in ('interview','offer','rejected')`,
      ),
    );

  // T1 volume: this week vs prior 4 weeks
  const t1TrendRows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${schema.jobs.discoveredAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.tier, 1),
        gte(schema.jobs.discoveredAt, fourWeeksAgo),
      ),
    )
    .groupBy(sql`date_trunc('week', ${schema.jobs.discoveredAt})`)
    .orderBy(sql`date_trunc('week', ${schema.jobs.discoveredAt})`);

  const thisWeekIso = thisWeekStart.toISOString().slice(0, 10);
  const thisWeekRow = t1TrendRows.find((r) => r.week === thisWeekIso);
  const t1ThisWeek = thisWeekRow?.count ?? 0;
  const priorWeeks = t1TrendRows.filter((r) => r.week !== thisWeekIso);
  const t1FourWeekAvg =
    priorWeeks.length > 0
      ? Math.round(priorWeeks.reduce((s, r) => s + r.count, 0) / priorWeeks.length)
      : 0;

  // Source response rate: for each source, how many applications got a response
  const sourceResponseRows = await db
    .select({
      source: schema.jobs.source,
      applied: sql<number>`count(*)::int`,
      responded: sql<number>`count(*) filter (where ${schema.applications.status} in ('interview','offer','rejected'))::int`,
    })
    .from(schema.applications)
    .innerJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
    .where(isNotNull(schema.applications.appliedAt))
    .groupBy(schema.jobs.source);

  return computeMarketPulse({
    avgDays: daysRow?.avgDays ?? null,
    t1ThisWeek,
    t1FourWeekAvg,
    sourceResponseRows,
  });
}
