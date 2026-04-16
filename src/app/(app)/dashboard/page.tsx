import { db, schema } from "@/db";
import { eq, sql, inArray, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { PIPELINE_STAGES } from "@/app/(app)/pipeline/stages";
import "@/components/dashboard/dashboard.css";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function loadData() {
  const [
    totalJobsRow,
    matchedCountRow,
    avgScoreRow,
    appliedCountRow,
    interviewCountRow,
    savedCountRow,
    scoreDistribution,
    locationDistribution,
    budget,
  ] = await Promise.all([
    // KPI: total jobs
    db.select({ count: sql<number>`count(*)::int` }).from(schema.jobs),
    // KPI: matched (tier 1-3)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.jobs)
      .where(inArray(schema.jobs.tier, [1, 2, 3])),
    // KPI: avg fitScore of tier 1-3
    db
      .select({ avg: sql<number>`round(avg(${schema.jobs.fitScore}::numeric), 1)` })
      .from(schema.jobs)
      .where(inArray(schema.jobs.tier, [1, 2, 3])),
    // KPI: applied count
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.applications)
      .where(eq(schema.applications.status, "applied")),
    // KPI: interview count
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.applications)
      .where(eq(schema.applications.status, "interview")),
    // KPI: saved count
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.applications)
      .where(eq(schema.applications.status, "saved")),
    // Score distribution: count per 10-point band
    db
      .select({
        band: sql<number>`(floor(${schema.jobs.fitScore}::numeric / 10) * 10)::int`.as("band"),
        count: sql<number>`count(*)::int`,
      })
      .from(schema.jobs)
      .where(isNotNull(schema.jobs.fitScore))
      .groupBy(sql`floor(${schema.jobs.fitScore}::numeric / 10) * 10`)
      .orderBy(sql`band`),
    // Location distribution: top 6
    db
      .select({
        location: schema.jobs.location,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.jobs)
      .where(isNotNull(schema.jobs.location))
      .groupBy(schema.jobs.location)
      .orderBy(sql`count(*) desc`)
      .limit(6),
    // Budget
    db
      .select()
      .from(schema.llmBudget)
      .where(eq(schema.llmBudget.period, currentPeriod()))
      .limit(1),
  ]);

  const totalJobs = totalJobsRow[0]?.count ?? 0;
  const matchedCount = matchedCountRow[0]?.count ?? 0;
  const avgScore = avgScoreRow[0]?.avg ?? 0;
  const appliedCount = appliedCountRow[0]?.count ?? 0;
  const interviewCount = interviewCountRow[0]?.count ?? 0;
  const savedCount = savedCountRow[0]?.count ?? 0;
  const budgetRow = budget[0];
  const eurSpent = budgetRow ? Number(budgetRow.eurSpent) : 0;
  const capEur = budgetRow ? Number(budgetRow.capEur) : 20;

  return {
    totalJobs,
    matchedCount,
    avgScore,
    appliedCount,
    interviewCount,
    savedCount,
    scoreDistribution,
    locationDistribution,
    eurSpent,
    capEur,
  };
}

/* ── Mock data generators (replace with real queries in production) ── */

/** Mock: daily avg fitScore over past 30 days, trending upward */
function mockMatchQualityData(): { date: string; score: number }[] {
  const points: { date: string; score: number }[] = [];
  const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86400_000);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    // upward trend from ~58 to ~74 with noise
    const base = 58 + ((29 - i) / 29) * 16;
    const noise = (Math.sin(i * 1.7) * 4) + (Math.cos(i * 0.9) * 2);
    points.push({ date: label, score: Math.round(Math.max(45, Math.min(90, base + noise))) });
  }
  return points;
}

/** Mock: 4 weeks x 7 days activity heatmap */
function mockHeatmapData(): number[][] {
  // 4 weeks, 7 days each. Values 0-4 intensity.
  return [
    [0, 1, 2, 0, 3, 1, 0],
    [1, 2, 3, 1, 4, 2, 0],
    [0, 3, 2, 4, 3, 1, 1],
    [2, 4, 3, 2, 4, 3, 0],
  ];
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEATMAP_LEVELS = ["l0", "l1", "l2", "l3", "l4"] as const;

function budgetLevel(pct: number): "ok" | "warn" | "danger" {
  if (pct >= 100) return "danger";
  if (pct >= 80) return "warn";
  return "ok";
}

export default async function DashboardPage() {
  if (!(await isAdmin())) redirect("/admin");
  const d = await loadData();

  const budgetPct = d.capEur > 0 ? (d.eurSpent / d.capEur) * 100 : 0;
  const bLevel = budgetLevel(budgetPct);
  const budgetRemaining = Math.max(0, d.capEur - d.eurSpent);

  // Score distribution bands
  const SCORE_BANDS = [
    { label: "40-49", min: 40 },
    { label: "50-59", min: 50 },
    { label: "60-69", min: 60 },
    { label: "70-79", min: 70 },
    { label: "80-89", min: 80 },
    { label: "90+", min: 90 },
  ];
  const scoreBandCounts = SCORE_BANDS.map((b) => {
    const row = d.scoreDistribution.find((r) => r.band === b.min);
    return { ...b, count: row?.count ?? 0 };
  });
  const maxBandCount = Math.max(1, ...scoreBandCounts.map((b) => b.count));

  // Location bars
  const maxLocCount = Math.max(1, ...d.locationDistribution.map((r) => r.count));

  // Pipeline funnel
  const funnelStages = [
    { key: "discovered", label: "Discovered", count: d.totalJobs, color: "funnel-grey" },
    { key: "matched", label: "Matched", count: d.matchedCount, color: "funnel-green" },
    { key: "saved", label: "Saved", count: d.savedCount, color: "funnel-green" },
    { key: "applied", label: "Applied", count: d.appliedCount, color: "funnel-amber" },
    { key: "interview", label: "Interview", count: d.interviewCount, color: "funnel-blue" },
  ];
  const maxFunnel = Math.max(1, ...funnelStages.map((s) => s.count));

  // Conversion rate for interviews
  const conversionPct = d.appliedCount > 0 ? ((d.interviewCount / d.appliedCount) * 100).toFixed(0) : "0";

  // Mock data
  const matchQuality = mockMatchQualityData();
  const heatmap = mockHeatmapData();

  // SVG chart dimensions
  const chartW = 560;
  const chartH = 200;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const scores = matchQuality.map((p) => p.score);
  const minY = Math.min(...scores) - 5;
  const maxY = Math.max(...scores) + 5;

  const points = matchQuality.map((p, i) => {
    const x = padL + (i / (matchQuality.length - 1)) * plotW;
    const y = padT + plotH - ((p.score - minY) / (maxY - minY)) * plotH;
    return { x, y, ...p };
  });
  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaD = `${lineD} L${points[points.length - 1].x.toFixed(1)},${padT + plotH} L${points[0].x.toFixed(1)},${padT + plotH} Z`;

  // Skills data (hardcoded for now — in production, parse from gapAnalysis or JD extraction)
  const skills = [
    { name: "CRM / HubSpot", count: 38 },
    { name: "Campaign mgmt", count: 32 },
    { name: "Analytics / GA4", count: 27 },
    { name: "Paid media", count: 21 },
    { name: "SEO / Content", count: 16 },
    { name: "A/B testing", count: 12 },
  ];
  const maxSkill = Math.max(1, ...skills.map((s) => s.count));

  return (
    <>
      {/* ── Header ── */}
      <header className="dash-header">
        <h1 className="dash-title">Your search</h1>
        <div className="dash-period-tabs">
          <span className="period-tab">This week</span>
          <span className="period-tab active">This month</span>
          <span className="period-tab">All time</span>
        </div>
      </header>

      {/* ── KPI strip ── */}
      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-label">Discovered</span>
          <span className="kpi-value">{d.totalJobs.toLocaleString()}</span>
          <span className="kpi-delta neutral">— this period</span>
          <span className="kpi-sub">total jobs found</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Matched</span>
          <span className="kpi-value">{d.matchedCount.toLocaleString()}</span>
          <span className="kpi-delta up">&#8593; tier 1-3</span>
          <span className="kpi-sub">quality matches</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Avg match</span>
          <span className="kpi-value">{d.avgScore}%</span>
          <span className="kpi-delta up">&#8593; trending</span>
          <span className="kpi-sub">fitScore (T1-T3)</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Applied</span>
          <span className="kpi-value">{d.appliedCount}</span>
          <span className="kpi-delta neutral">— of {d.savedCount} saved</span>
          <span className="kpi-sub">applications sent</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Interviews</span>
          <span className="kpi-value">{d.interviewCount}</span>
          <span className="kpi-delta up">&#8593; {conversionPct}% conversion</span>
          <span className="kpi-sub">from applied</span>
        </div>
      </div>

      {/* ── 6-panel grid ── */}
      <div className="panel-grid">
        {/* 1. Match quality over time (span 2) */}
        <section className="panel span-2">
          <h2>Match quality over time</h2>
          {/* TODO: Replace mock data with real daily avg fitScore query */}
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="chart-svg" aria-label="Match quality area chart">
            {/* Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const val = Math.round(minY + frac * (maxY - minY));
              const y = padT + plotH - frac * plotH;
              return (
                <g key={frac}>
                  <line x1={padL} x2={chartW - padR} y1={y} y2={y} stroke="var(--border)" strokeWidth="0.5" />
                  <text x={padL - 6} y={y + 3} className="chart-axis-label" textAnchor="end">{val}%</text>
                </g>
              );
            })}
            {/* X-axis labels (every 5th) */}
            {points.filter((_, i) => i % 7 === 0 || i === points.length - 1).map((p) => (
              <text key={p.date} x={p.x} y={chartH - 4} className="chart-axis-label" textAnchor="middle">{p.date}</text>
            ))}
            {/* Area fill */}
            <path d={areaD} fill="var(--accent-wash)" />
            {/* Line */}
            <path d={lineD} fill="none" stroke="var(--accent)" strokeWidth="2" />
          </svg>
          <p className="chart-caption">Daily average fitScore over 30 days</p>
        </section>

        {/* 2. Score distribution */}
        <section className="panel">
          <h2>Score distribution</h2>
          <div className="histogram">
            {scoreBandCounts.map((b) => (
              <div key={b.label} className="hist-col">
                <div className="hist-bar-wrap">
                  <div
                    className="hist-bar"
                    data-band={b.min < 60 ? "low" : b.min < 80 ? "mid" : "high"}
                    style={{ height: `${(b.count / maxBandCount) * 100}%` }}
                  />
                </div>
                <span className="hist-count">{b.count}</span>
                <span className="hist-label">{b.label}</span>
              </div>
            ))}
          </div>
          <p className="chart-caption">Most roles cluster at 60-75%.</p>
        </section>

        {/* 3. Most requested skills */}
        <section className="panel">
          <h2>Most requested skills</h2>
          {/* TODO: In production, parse from gapAnalysis or JD tool extraction */}
          <div className="hbar-list">
            {skills.map((s) => (
              <div key={s.name} className="hbar-row">
                <span className="hbar-name">{s.name}</span>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${(s.count / maxSkill) * 100}%` }} />
                </div>
                <span className="hbar-count">{s.count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Pipeline funnel */}
        <section className="panel">
          <h2>Pipeline funnel</h2>
          <div className="funnel-list">
            {funnelStages.map((s) => (
              <div key={s.key} className="funnel-row">
                <span className="funnel-label">{s.label}</span>
                <div className="funnel-track">
                  <div className={`funnel-fill ${s.color}`} style={{ width: `${(s.count / maxFunnel) * 100}%` }} />
                </div>
                <span className="funnel-count">{s.count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Activity heatmap */}
        <section className="panel">
          <h2>Activity heatmap</h2>
          {/* TODO: Replace mock data with real activity query */}
          <div className="heatmap">
            <div className="heatmap-labels">
              {DAY_LABELS.filter((_, i) => i % 2 === 0).map((lbl) => (
                <span key={lbl} className="heatmap-day-label">{lbl}</span>
              ))}
            </div>
            <div className="heatmap-grid">
              {heatmap.map((week, wi) => (
                <div key={wi} className="heatmap-week">
                  {week.map((level, di) => (
                    <div key={di} className={`heatmap-cell ${HEATMAP_LEVELS[level]}`} title={`${DAY_LABELS[di]}: level ${level}`} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="heatmap-legend">
            <span className="heatmap-legend-label">Less</span>
            {HEATMAP_LEVELS.map((l) => (
              <div key={l} className={`heatmap-cell-sm ${l}`} />
            ))}
            <span className="heatmap-legend-label">More</span>
          </div>
        </section>

        {/* 6. Where your matches are */}
        <section className="panel">
          <h2>Where your matches are</h2>
          <div className="hbar-list">
            {d.locationDistribution.length === 0 && (
              <p className="chart-caption">No location data yet.</p>
            )}
            {d.locationDistribution.map((loc) => (
              <div key={loc.location} className="hbar-row">
                <span className="hbar-name">{loc.location ?? "Remote"}</span>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${(loc.count / maxLocCount) * 100}%` }} />
                </div>
                <span className="hbar-count">{loc.count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Bottom row ── */}
      <div className="bottom-row">
        {/* Budget card */}
        <section className="panel">
          <h2>Budget</h2>
          <div className="budget-head">
            <span className="budget-used">&euro;{d.eurSpent.toFixed(2)}</span>
            <span className="budget-cap">/ &euro;{d.capEur.toFixed(0)}</span>
          </div>
          <div className="budget-bar" role="progressbar" aria-valuenow={Math.round(budgetPct)} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="budget-fill"
              data-level={bLevel}
              style={{ width: `${Math.min(100, budgetPct).toFixed(1)}%` }}
            />
          </div>
          <div className="budget-meta">
            <span>{budgetPct.toFixed(0)}% used</span>
            <span className="mono">&euro;{budgetRemaining.toFixed(2)} left</span>
          </div>
        </section>

        {/* Streak card (span 2) */}
        <section className="panel streak-card span-2">
          <div className="streak-number">7</div>
          <div className="streak-text">
            <span className="streak-label">Day streak</span>
            <span className="streak-msg">You have been consistently reviewing and applying. Keep the momentum going.</span>
          </div>
        </section>
      </div>
    </>
  );
}
