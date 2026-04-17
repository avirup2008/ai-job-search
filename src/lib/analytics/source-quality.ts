import { db, schema } from "@/db";
import { sql, isNotNull } from "drizzle-orm";

export const SOURCE_LABELS: Record<string, string> = {
  adzuna: "Adzuna",
  jooble: "Jooble",
  magnetme: "Magnet.me",
  nvb: "Nationale Vacaturebank",
  "indeed-nl": "Indeed NL",
};

export interface SourceQualityRow {
  source: string;
  label: string;
  total: number;
  t1Count: number;
  conversionRate: number; // 0.0–100.0
}

/** Pure computation — unit testable without DB. Input: raw GROUP BY rows. */
export function computeSourceQuality(
  rows: { source: string; total: number; t1Count: number }[]
): SourceQualityRow[] {
  return rows
    .map((r) => ({
      source: r.source,
      label: SOURCE_LABELS[r.source] ?? r.source,
      total: r.total,
      t1Count: r.t1Count,
      conversionRate: r.total > 0 ? Math.round((r.t1Count / r.total) * 1000) / 10 : 0.0,
    }))
    .sort((a, b) => b.t1Count - a.t1Count);
}

/** DB query — separated from pure computation so both are independently testable. */
export async function querySourceQuality(): Promise<SourceQualityRow[]> {
  const rows = await db
    .select({
      source: schema.jobs.source,
      total: sql<number>`count(*)::int`,
      t1Count: sql<number>`count(*) filter (where ${schema.jobs.tier} = 1)::int`,
    })
    .from(schema.jobs)
    .where(isNotNull(schema.jobs.source))
    .groupBy(schema.jobs.source)
    .orderBy(sql`count(*) filter (where ${schema.jobs.tier} = 1) desc`);

  return computeSourceQuality(rows);
}
