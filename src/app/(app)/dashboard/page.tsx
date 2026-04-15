import { db, schema } from "@/db";
import { eq, gte, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { PIPELINE_STAGES, type PipelineStage } from "@/app/(app)/pipeline/stages";
import "@/components/dashboard/dashboard.css";

const STAGE_LABEL: Record<PipelineStage, string> = {
  new: "New",
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function loadKpis() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getTime() - 7 * 86400_000);

  const [
    totalJobsRow,
    newJobsTodayRow,
    newJobsWeekRow,
    totalAppsRow,
    totalDocsRow,
    stageCounts,
    budget,
    generatedThisWeekRow,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(schema.jobs),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.jobs).where(gte(schema.jobs.discoveredAt, startOfDay)),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.jobs).where(gte(schema.jobs.discoveredAt, startOfWeek)),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.applications),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.documents),
    db
      .select({ status: schema.applications.status, count: sql<number>`count(*)::int` })
      .from(schema.applications)
      .groupBy(schema.applications.status),
    db.select().from(schema.llmBudget).where(eq(schema.llmBudget.period, currentPeriod())).limit(1),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.documents).where(gte(schema.documents.createdAt, startOfWeek)),
  ]);

  const byStage: Record<PipelineStage, number> = {
    new: 0, saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0,
  };
  for (const r of stageCounts) {
    if ((PIPELINE_STAGES as readonly string[]).includes(r.status)) {
      byStage[r.status as PipelineStage] = r.count;
    }
  }

  const inFlight = byStage.saved + byStage.applied + byStage.interview + byStage.offer;
  const budgetRow = budget[0];
  const eurSpent = budgetRow ? Number(budgetRow.eurSpent) : 0;
  const capEur = budgetRow ? Number(budgetRow.capEur) : 20;

  return {
    totalJobs: totalJobsRow[0]?.count ?? 0,
    newToday: newJobsTodayRow[0]?.count ?? 0,
    newWeek: newJobsWeekRow[0]?.count ?? 0,
    totalApps: totalAppsRow[0]?.count ?? 0,
    totalDocs: totalDocsRow[0]?.count ?? 0,
    byStage,
    inFlight,
    eurSpent,
    capEur,
    generatedThisWeek: generatedThisWeekRow[0]?.count ?? 0,
  };
}

function budgetLevel(pct: number): "ok" | "warn" | "danger" {
  if (pct >= 100) return "danger";
  if (pct >= 80) return "warn";
  return "ok";
}

export default async function DashboardPage() {
  if (!(await isAdmin())) redirect("/admin");
  const k = await loadKpis();
  const pct = k.capEur > 0 ? (k.eurSpent / k.capEur) * 100 : 0;
  const level = budgetLevel(pct);
  const maxStage = Math.max(1, ...Object.values(k.byStage));

  return (
    <>
      <header className="app-header">
        <div>
          <span className="label">Overview</span>
          <h1>Dashboard</h1>
        </div>
        <div className="app-header-meta">Live counts from production.</div>
      </header>

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-label">Jobs discovered</span>
          <span className="kpi-value">{k.totalJobs.toLocaleString()}</span>
          <span className="kpi-sub">
            <span className="kpi-delta">+{k.newToday}</span> today · <span className="kpi-delta">+{k.newWeek}</span> this week
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">In-flight apps</span>
          <span className="kpi-value">{k.inFlight}</span>
          <span className="kpi-sub">{k.totalApps} total applications</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Docs generated</span>
          <span className="kpi-value">{k.totalDocs}</span>
          <span className="kpi-sub"><span className="kpi-delta">+{k.generatedThisWeek}</span> this week</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">LLM spend this month</span>
          <span className="kpi-value">€{k.eurSpent.toFixed(2)}</span>
          <span className="kpi-sub">{pct.toFixed(0)}% of €{k.capEur.toFixed(0)} cap</span>
        </div>
      </div>

      <div className="dashboard-cols">
        <section className="panel">
          <h2>Budget burndown</h2>
          <div className="budget-head">
            <span className="budget-used">€{k.eurSpent.toFixed(2)}</span>
            <span className="budget-cap">/ €{k.capEur.toFixed(0)} cap</span>
          </div>
          <div className="budget-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="budget-fill"
              data-level={level}
              style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}
            />
          </div>
          <div className="budget-meta">
            <span>Sonnet → Haiku downgrade at 80%</span>
            <span className="mono">{pct.toFixed(1)}%</span>
          </div>
        </section>

        <section className="panel">
          <h2>Pipeline stages</h2>
          <div className="stage-list">
            {PIPELINE_STAGES.map((stage) => {
              const count = k.byStage[stage];
              const w = (count / maxStage) * 100;
              return (
                <div key={stage} className="stage-row">
                  <span className="stage-name">{STAGE_LABEL[stage]}</span>
                  <div className="stage-bar">
                    <div className="stage-fill" style={{ width: `${w}%` }} />
                  </div>
                  <span className="stage-count">{count}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
