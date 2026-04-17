import { db, schema } from "@/db";
import { desc, eq, gte, inArray, sql, and } from "drizzle-orm";
import Link from "next/link";
import "@/components/home/home.css";

// Force re-render on each request so greeting reflects current time
export const dynamic = "force-dynamic";
export const revalidate = 0;

type GapAnalysis = { strengths?: string[] } | null;

function firstName(full: string | null): string {
  if (!full) return "there";
  return full.trim().split(/\s+/)[0] ?? "there";
}

function greeting(): string {
  // Use Amsterdam timezone explicitly — server runs in UTC otherwise
  const h = Number(new Date().toLocaleString("en-GB", {
    timeZone: "Europe/Amsterdam",
    hour: "numeric",
    hour12: false,
  }));
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function fmtDate(d: Date): string {
  // Use Amsterdam timezone for all date parts
  const tz = "Europe/Amsterdam";
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long", timeZone: tz }).toUpperCase();
  const day = Number(d.toLocaleString("en-GB", { day: "numeric", timeZone: tz }));
  const month = d.toLocaleDateString("en-GB", { month: "long", timeZone: tz }).toUpperCase();
  return `${weekday} ${day} ${month}`;
}

async function loadHome() {
  const since24h = new Date(Date.now() - 24 * 3600_000);
  const [profile, featured, newToday, strongCount, totalT123] = await Promise.all([
    db.select({ fullName: schema.profile.fullName }).from(schema.profile).limit(1),
    db.select({
      id: schema.jobs.id, title: schema.jobs.title, location: schema.jobs.location,
      fitScore: schema.jobs.fitScore, gapAnalysis: schema.jobs.gapAnalysis,
      companyName: schema.companies.name,
    }).from(schema.jobs)
      .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
      .where(inArray(schema.jobs.tier, [1, 2, 3]))
      .orderBy(desc(schema.jobs.fitScore), desc(schema.jobs.discoveredAt)).limit(1),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.jobs).where(gte(schema.jobs.discoveredAt, since24h)),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.jobs)
      .where(and(inArray(schema.jobs.tier, [1, 2, 3]), gte(schema.jobs.fitScore, "80"))),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.jobs).where(inArray(schema.jobs.tier, [1, 2, 3])),
  ]);

  return {
    name: firstName(profile[0]?.fullName ?? null),
    featured: featured[0] ?? null,
    newToday: newToday[0]?.count ?? 0,
    strongCount: strongCount[0]?.count ?? 0,
    totalInbox: totalT123[0]?.count ?? 0,
  };
}

export default async function HomePage() {
  const d = await loadHome();
  const f = d.featured;
  const strengths = (f?.gapAnalysis as GapAnalysis)?.strengths ?? [];
  const score = f?.fitScore != null ? Math.round(Number(f.fitScore)) : null;

  return (
    <div className="home">
      {/* Floating doc illustrations */}
      <div className="home-float home-float-cv" aria-hidden="true">
        <svg width="48" height="60" viewBox="0 0 48 60" fill="none">
          <rect x="0.5" y="0.5" width="47" height="59" rx="3" stroke="var(--border)" fill="var(--surface)" />
          <line x1="10" y1="16" x2="38" y2="16" stroke="var(--border-h)" strokeWidth="1.5" />
          <line x1="10" y1="22" x2="32" y2="22" stroke="var(--border)" strokeWidth="1" />
          <line x1="10" y1="27" x2="35" y2="27" stroke="var(--border)" strokeWidth="1" />
          <line x1="10" y1="32" x2="28" y2="32" stroke="var(--border)" strokeWidth="1" />
        </svg>
        <span className="home-float-label">CV</span>
      </div>
      <div className="home-float home-float-cover" aria-hidden="true">
        <svg width="44" height="56" viewBox="0 0 44 56" fill="none">
          <rect x="0.5" y="0.5" width="43" height="55" rx="3" stroke="var(--border)" fill="var(--surface)" />
          <line x1="8" y1="14" x2="36" y2="14" stroke="var(--border-h)" strokeWidth="1.5" />
          <line x1="8" y1="20" x2="30" y2="20" stroke="var(--border)" strokeWidth="1" />
          <line x1="8" y1="25" x2="33" y2="25" stroke="var(--border)" strokeWidth="1" />
          <line x1="8" y1="30" x2="26" y2="30" stroke="var(--border)" strokeWidth="1" />
          <line x1="8" y1="35" x2="30" y2="35" stroke="var(--border)" strokeWidth="1" />
        </svg>
        <span className="home-float-label">COVER LETTER</span>
      </div>
      <div className="home-float home-float-plan" aria-hidden="true">
        <svg width="46" height="58" viewBox="0 0 46 58" fill="none">
          <rect x="0.5" y="0.5" width="45" height="57" rx="3" stroke="var(--border)" fill="var(--surface)" />
          <line x1="9" y1="15" x2="37" y2="15" stroke="var(--border-h)" strokeWidth="1.5" />
          <line x1="9" y1="21" x2="31" y2="21" stroke="var(--border)" strokeWidth="1" />
          <line x1="9" y1="26" x2="34" y2="26" stroke="var(--border)" strokeWidth="1" />
        </svg>
        <span className="home-float-label">30-60-90</span>
      </div>

      {/* Accent dots */}
      <span className="home-dot home-dot-1" aria-hidden="true" />
      <span className="home-dot home-dot-2" aria-hidden="true" />
      <span className="home-dot home-dot-3" aria-hidden="true" />

      {/* Growth curve */}
      <svg className="home-growth" aria-hidden="true" viewBox="0 0 720 400" fill="none" preserveAspectRatio="none">
        <path d="M0 380 C180 370, 300 340, 400 280 S560 120, 720 40" stroke="var(--accent)" strokeWidth="2" />
      </svg>

      {/* Narrative column */}
      <div className="home-narrative">
        {/* 1. Date */}
        <div className="home-date">{fmtDate(new Date())}</div>

        {/* 2. Greeting */}
        <h1 className="home-greeting">
          {greeting()},<br />
          {d.name}<span className="home-accent-dot">.</span>
        </h1>

        {/* 3. Subtext */}
        {d.strongCount > 0 || d.totalInbox > 0 ? (
          <p className="home-sub">
            You have <strong>{d.strongCount}</strong> strong match{d.strongCount === 1 ? "" : "es"} waiting.{" "}
            <strong>{d.newToday}</strong> new roles arrived overnight.
          </p>
        ) : (
          <p className="home-sub">Discovery runs overnight. Check back in the morning.</p>
        )}

        {f ? (
          <>
            {/* 4. Transition */}
            <div className="home-transition">
              <span className="home-transition-line" />
              One stands out
            </div>

            {/* 5. Featured card */}
            <Link href={`/inbox/${f.id}`} className="home-featured">
              <div className="home-featured-left">
                <div className="home-featured-company">{f.companyName ?? "Unknown"}</div>
                <h2 className="home-featured-title">{f.title}</h2>
                <p className="home-featured-reason">
                  {strengths.length > 0
                    ? strengths.slice(0, 2).join(". ") + "."
                    : "Strong profile match on skills, tools, and seniority."}
                </p>
                <span className="home-featured-cta">Open this role &rarr;</span>
              </div>
              {score != null && (
                <div className="home-featured-right">
                  <span className="home-featured-score">{score}</span>
                  <span className="home-featured-pct">% match</span>
                </div>
              )}
            </Link>
          </>
        ) : (
          <div className="home-empty">
            Discovery runs overnight. Check back in the morning.
          </div>
        )}

        {/* 6. KPI pills */}
        <div className="home-pills">
          <Link href="/inbox" className="home-pill">
            <strong>{d.totalInbox}</strong> in your inbox
          </Link>
          <Link href="/inbox?filter=strong" className="home-pill home-pill-accent">
            <strong>{d.strongCount}</strong> strong matches
          </Link>
          <Link href="/analytics" className="home-pill">
            <strong>{d.newToday}</strong> discovered
          </Link>
        </div>
      </div>
    </div>
  );
}
