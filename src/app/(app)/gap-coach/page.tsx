import { db, schema } from "@/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  GapCoachList,
  shapeGapCoachRow,
  sortGapCoachRows,
  type GapCoachRaw,
} from "@/components/gap-coach/GapCoachList";
import "./gap-coach.css";

async function loadT2Jobs(): Promise<GapCoachRaw[]> {
  const rows = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.title,
      companyName: schema.companies.name,
      fitScore: schema.jobs.fitScore,
      fitBreakdown: schema.jobs.fitBreakdown,
      gapAnalysis: schema.jobs.gapAnalysis,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, sql`${schema.jobs.companyId} = ${schema.companies.id}`)
    .where(eq(schema.jobs.tier, 2))
    .orderBy(desc(schema.jobs.fitScore))
    .limit(50);
  return rows as GapCoachRaw[];
}

export default async function GapCoachPage() {
  const raw = await loadT2Jobs();
  const rows = sortGapCoachRows(raw.map(shapeGapCoachRow));
  return (
    <>
      <header className="app-header">
        <div>
          <h1 className="gap-coach-title-h1">Profile Gap Coach</h1>
          <p className="gap-coach-subtitle">
            T2 jobs ranked by closeness to T1 &mdash; fix the gaps below to tip them into T1.
          </p>
        </div>
        <div className="app-header-meta">
          {rows.length} T2 role{rows.length === 1 ? "" : "s"}
        </div>
      </header>
      <GapCoachList rows={rows} />
    </>
  );
}
