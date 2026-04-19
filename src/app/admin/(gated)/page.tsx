import Link from "next/link";
import { db, schema } from "@/db";
import { desc, sql } from "drizzle-orm";
import TriggerRunButton from "./TriggerRunClient";
import { getFeedbackInsights } from "@/lib/pipeline/feedback";

export const dynamic = "force-dynamic";

async function summary() {
  const jobCount = await db.select({ n: sql<number>`count(*)` }).from(schema.jobs);
  const runCount = await db.select({ n: sql<number>`count(*)` }).from(schema.runs);
  const [lastRun] = await db.select().from(schema.runs).orderBy(desc(schema.runs.startedAt)).limit(1);
  const [budget] = await db.select().from(schema.llmBudget).orderBy(desc(schema.llmBudget.period)).limit(1);
  return {
    jobs: Number(jobCount[0]?.n ?? 0),
    runs: Number(runCount[0]?.n ?? 0),
    lastRunAt: lastRun?.startedAt ?? null,
    lastRunStatus: lastRun?.status ?? null,
    budgetEur: budget ? Number(budget.eurSpent) : 0,
  };
}

export default async function AdminHome() {
  const [s, insights] = await Promise.all([summary(), getFeedbackInsights()]);
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/inbox" style={{ fontSize: 13, color: "#666", textDecoration: "none" }}>← Back to Inbox</Link>
      </div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>AI Job Search — Admin</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        <Stat label="Jobs in DB" value={String(s.jobs)} />
        <Stat label="Pipeline runs" value={String(s.runs)} />
        <Stat label="Last run" value={s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : "—"} sub={s.lastRunStatus ?? ""} />
        <Stat label="Budget (this month)" value={`€${s.budgetEur.toFixed(2)}`} />
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>Navigate</h2>
      <ul style={{ fontSize: 14, lineHeight: 1.8 }}>
        <li><Link href="/admin/jobs">Jobs (ranked queue)</Link></li>
        <li><Link href="/admin/runs">Runs (pipeline log)</Link></li>
        <li><Link href="/admin/profile">Profile</Link></li>
        <li><Link href="/admin/budget">Budget</Link></li>
      </ul>

      <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 8 }}>Actions</h2>
      <TriggerRunButton />

      <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 8 }}>Feedback Insights</h2>
      <div style={{ fontSize: 13 }}>
        <div style={{ marginBottom: 8, color: "#333" }}>{insights.calibrationNote}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          <Stat label="Applied / Interview" value={String(insights.positiveCount)} />
          <Stat label="Flagged" value={String(insights.negativeCount)} />
          {insights.positiveAvgScore != null && (
            <Stat label="Avg score (applied)" value={String(insights.positiveAvgScore)} />
          )}
          {insights.t1ConversionRate != null && (
            <Stat label="T1 apply rate" value={`${insights.t1ConversionRate}%`} />
          )}
          {insights.t2ConversionRate != null && (
            <Stat label="T2 apply rate" value={`${insights.t2ConversionRate}%`} />
          )}
        </div>
        {insights.positiveComponents && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#666", fontFamily: "monospace" }}>
            Applied job avg components — skills: {insights.positiveComponents.skills} · tools: {insights.positiveComponents.tools} · seniority: {insights.positiveComponents.seniority} · industry: {insights.positiveComponents.industry}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
