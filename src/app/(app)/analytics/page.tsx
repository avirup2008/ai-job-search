import { db, schema } from "@/db";
import { eq, sql, inArray, isNotNull, gte, and } from "drizzle-orm";
import { PIPELINE_STAGES } from "@/app/(app)/pipeline/stages";
import { aggregateByNormalizedLocation } from "@/lib/location/normalize";
import { KEYWORDS, extractKeywordCounts, profileKeywordSet } from "@/lib/analytics/keywords";
import { querySourceQuality } from "@/lib/analytics/source-quality";
import { queryMarketPulse } from "@/lib/analytics/market-pulse";
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
    matchQualityTrend,
    applicationsPerDay,
    jdTextsForKeywords,
    profileRows,
    sourceQuality,
    marketPulse,
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
    // Location distribution: raw group-by, re-aggregated after normalization
    // (so "Netherlands" and "Nederland" merge into one bucket). We skip the
    // SQL LIMIT because the top-6 cut must happen post-normalization.
    db
      .select({
        location: schema.jobs.location,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.jobs)
      .where(isNotNull(schema.jobs.location))
      .groupBy(schema.jobs.location),
    // Budget
    db
      .select()
      .from(schema.llmBudget)
      .where(eq(schema.llmBudget.period, currentPeriod()))
      .limit(1),
    // Match quality trend: daily avg fitScore, tier 1-3, last 30 days
    db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${schema.jobs.discoveredAt}), 'YYYY-MM-DD')`.as("date"),
        avgScore: sql<number>`round(avg(${schema.jobs.fitScore}::numeric), 1)::float`,
      })
      .from(schema.jobs)
      .where(
        and(
          inArray(schema.jobs.tier, [1, 2, 3]),
          gte(schema.jobs.discoveredAt, sql`now() - interval '30 days'`),
        ),
      )
      .groupBy(sql`date_trunc('day', ${schema.jobs.discoveredAt})`)
      .orderBy(sql`date_trunc('day', ${schema.jobs.discoveredAt})`),
    // Applications sent per day, last 90 days
    db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${schema.applications.appliedAt}), 'YYYY-MM-DD')`.as("date"),
        count: sql<number>`count(*)::int`,
      })
      .from(schema.applications)
      .where(
        and(
          isNotNull(schema.applications.appliedAt),
          gte(schema.applications.appliedAt, sql`now() - interval '90 days'`),
        ),
      )
      .groupBy(sql`date_trunc('day', ${schema.applications.appliedAt})`),
    // Tier 1-3 jdText corpus for keyword extraction
    db
      .select({ jdText: schema.jobs.jdText })
      .from(schema.jobs)
      .where(
        and(
          inArray(schema.jobs.tier, [1, 2, 3]),
          isNotNull(schema.jobs.jdText),
        ),
      ),
    // Profile row for strengths matching
    db
      .select({
        headline: schema.profile.headline,
        roles: schema.profile.roles,
        toolStack: schema.profile.toolStack,
        achievements: schema.profile.achievements,
        industries: schema.profile.industries,
      })
      .from(schema.profile)
      .limit(1),
    // Source quality: T1 jobs discovered per source + conversion rate
    querySourceQuality(),
    // Market pulse: avg days-to-response, T1 trend, source response rates
    queryMarketPulse(),
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

  // Merge location variants (Nederland/Netherlands/NL → Netherlands;
  // "Amsterdam, NL" → "Amsterdam") then take the top 6 by count.
  const normalizedLocations = aggregateByNormalizedLocation(locationDistribution).slice(0, 6);

  // ── Match quality: 30-day carry-forward fill ──────────────────────────────
  // Build an ISO-date → avgScore map from the query results.
  const trendMap = new Map<string, number>();
  for (const row of matchQualityTrend) {
    trendMap.set(row.date, row.avgScore ?? 0);
  }
  // Build 30-day grid from today back (UTC), carry-forward for missing days.
  const matchQuality: { date: string; score: number }[] = [];
  let lastKnown = 0;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const label = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
    if (trendMap.has(iso)) {
      lastKnown = trendMap.get(iso)!;
    }
    matchQuality.push({ date: label, score: lastKnown });
  }
  // Trim leading zeros (no data before first job discovered) — keep at least
  // 2 points so the SVG path doesn't degenerate.
  const firstNonZero = matchQuality.findIndex((p) => p.score > 0);
  const trimmedMatchQuality =
    firstNonZero > 0 && matchQuality.length - firstNonZero >= 2
      ? matchQuality.slice(firstNonZero)
      : matchQuality;

  // ── Activity heatmap: 13 weeks × 7 days ──────────────────────────────────
  const appMap = new Map<string, number>();
  for (const row of applicationsPerDay) {
    appMap.set(row.date, row.count ?? 0);
  }
  // Build 91-day array (today + 90 prior), then fold into 13×7.
  // Day 0 = 90 days ago; day 90 = today.
  // Week rows run oldest-first; within each week, index 0=Mon … 6=Sun (UTC).
  const NUM_WEEKS = 13;
  const TOTAL_DAYS = NUM_WEEKS * 7; // 91
  const heatmapCounts: number[] = [];
  for (let i = TOTAL_DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    heatmapCounts.push(appMap.get(iso) ?? 0);
  }
  const maxCount = Math.max(1, ...heatmapCounts);
  const heatmap: number[][] = [];
  for (let w = 0; w < NUM_WEEKS; w++) {
    const week: number[] = [];
    for (let d = 0; d < 7; d++) {
      const c = heatmapCounts[w * 7 + d];
      let level = 0;
      if (c > 0) {
        const ratio = c / maxCount;
        if (ratio <= 0.25) level = 1;
        else if (ratio <= 0.5) level = 2;
        else if (ratio <= 0.75) level = 3;
        else level = 4;
      }
      week.push(level);
    }
    heatmap.push(week);
  }

  // ── Skills: keyword extraction from tier 1-3 JD corpus ───────────────────
  const jdTexts = jdTextsForKeywords.map((r) => r.jdText);
  const kwCounts = extractKeywordCounts(jdTexts);
  const profileRow = profileRows[0] ?? null;
  const inProfile = profileKeywordSet(profileRow ?? {});

  const skills = Array.from(kwCounts.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count, inProfile: inProfile.has(name) }));

  return {
    totalJobs,
    matchedCount,
    avgScore,
    appliedCount,
    interviewCount,
    savedCount,
    scoreDistribution,
    locationDistribution: normalizedLocations,
    eurSpent,
    capEur,
    matchQuality: trimmedMatchQuality,
    heatmap,
    skills,
    sourceQuality,
    marketPulse,
  };
}


function budgetLevel(pct: number): "ok" | "warn" | "danger" {
  if (pct >= 100) return "danger";
  if (pct >= 80) return "warn";
  return "ok";
}

export default async function DashboardPage() {
  const d = await loadData();

  const budgetPct = d.capEur > 0 ? (d.eurSpent / d.capEur) * 100 : 0;
  const bLevel = budgetLevel(budgetPct);
  const budgetRemaining = Math.max(0, d.capEur - d.eurSpent);

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

  // SVG chart dimensions — compact to reduce page height
  const chartW = 560;
  const chartH = 140;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  // Match quality SVG: only compute if we have >= 2 data points with score > 0
  const hasMatchData = d.matchQuality.length >= 2 && d.matchQuality.some((p) => p.score > 0);
  const scores = hasMatchData ? d.matchQuality.map((p) => p.score) : [];
  const minY = hasMatchData ? Math.min(...scores) - 5 : 0;
  const maxY = hasMatchData ? Math.max(...scores) + 5 : 100;

  const points = hasMatchData
    ? d.matchQuality.map((p, i) => {
        const x = padL + (i / (d.matchQuality.length - 1)) * plotW;
        const y = padT + plotH - ((p.score - minY) / (maxY - minY)) * plotH;
        return { x, y, ...p };
      })
    : [];

  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaD = points.length > 0
    ? `${lineD} L${points[points.length - 1].x.toFixed(1)},${padT + plotH} L${points[0].x.toFixed(1)},${padT + plotH} Z`
    : "";

  // Skills
  const maxSkill = Math.max(1, ...d.skills.map((s) => s.count));
  const maxT1 = Math.max(1, ...d.sourceQuality.map((s) => s.t1Count));

  // Suppress unused-import TS warning: PIPELINE_STAGES is used below if funnel ever
  // references named stages — keep the import in case of future use.
  void PIPELINE_STAGES;

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
          <span className="kpi-label">Applied</span>
          <span className="kpi-value">{d.appliedCount}</span>
          <span className="kpi-delta neutral">— of {d.savedCount} saved</span>
          <span className="kpi-sub">applications sent</span>
        </div>
      </div>

      {/* ── 6-panel grid ── */}
      <div className="panel-grid">
        {/* 1. Match quality over time (span 2) */}
        <section className="panel span-2">
          <h2>Match quality over time</h2>
          {hasMatchData ? (
            <>
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
                {/* X-axis labels (every 7th) */}
                {points.filter((_, i) => i % 7 === 0 || i === points.length - 1).map((p) => (
                  <text key={p.date} x={p.x} y={chartH - 4} className="chart-axis-label" textAnchor="middle">{p.date}</text>
                ))}
                {/* Area fill */}
                <path d={areaD} fill="var(--accent-wash)" />
                {/* Line */}
                <path d={lineD} fill="none" stroke="var(--accent)" strokeWidth="2" />
              </svg>
              <p className="chart-caption">Daily average fitScore over 30 days</p>
            </>
          ) : (
            <p className="chart-caption">Not enough data yet — check back after more jobs are discovered.</p>
          )}
        </section>

        {/* 2. Top skills in your matches */}
        <section className="panel">
          <h2>Top skills in your matches</h2>
          <p className="chart-caption">Orange = gap in your profile · Green = strength</p>
          <div className="hbar-list">
            {d.skills.length === 0 ? (
              <p className="chart-caption">No tier 1-3 matches yet — skills will appear once jobs are scored.</p>
            ) : (
              d.skills.map((s) => (
                <div key={s.name} className="hbar-row" data-skill-kind={s.inProfile ? "strength" : "gap"}>
                  <span className="hbar-name">{s.name}</span>
                  <div className="hbar-track">
                    <div
                      className="hbar-fill"
                      style={{
                        width: `${(s.count / maxSkill) * 100}%`,
                        background: s.inProfile ? "var(--accent)" : "var(--warn, #e08a3b)",
                      }}
                    />
                  </div>
                  <span className="hbar-count">{s.count}</span>
                </div>
              ))
            )}
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

        {/* 5. Where your matches are */}
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

        {/* 7. Budget — inside the grid, spans 2 columns */}
        <section className="panel span-2">
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

        {/* Source quality */}
        <section className="panel">
          <h2>Source quality</h2>
          <p className="chart-caption">T1 jobs discovered per source · bar = count · label = conversion rate</p>
          <div className="hbar-list">
            {d.sourceQuality.length === 0 ? (
              <p className="chart-caption">No jobs discovered yet.</p>
            ) : (
              d.sourceQuality.map((s) => (
                <div key={s.source} className="hbar-row">
                  <span className="hbar-name">{s.label}</span>
                  <div className="hbar-track">
                    <div
                      className="hbar-fill"
                      style={{ width: `${(s.t1Count / maxT1) * 100}%` }}
                    />
                  </div>
                  <span className="hbar-count">{s.t1Count} T1 ({s.conversionRate.toFixed(1)}%)</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Market Pulse */}
        <section className="panel">
          <h2>Market pulse</h2>
          <p className="chart-caption">Derived from your application history</p>
          <div className="hbar-list">
            <div className="hbar-row">
              <span className="hbar-name">Avg days to response</span>
              <span className="hbar-count">
                {d.marketPulse.avgDaysToResponse !== null
                  ? `${d.marketPulse.avgDaysToResponse} days`
                  : "No responses yet"}
              </span>
            </div>
            <div className="hbar-row">
              <span className="hbar-name">T1 volume trend</span>
              <span className="hbar-count" data-trend={d.marketPulse.t1TrendDirection}>
                {d.marketPulse.t1TrendLabel}
              </span>
            </div>
            {d.marketPulse.sourceResponseRate.map((r) => (
              <div key={r.source} className="hbar-row">
                <span className="hbar-name">{r.label} response rate</span>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${r.rate}%` }} />
                </div>
                <span className="hbar-count">{r.rate.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
