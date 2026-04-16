import { db, schema } from "@/db";
import { desc, eq, gte, inArray, sql, and, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/auth/admin";
import "@/components/home/home.css";

type GapAnalysis = { strengths?: string[]; gaps?: string[]; recommendationReason?: string } | null;

function firstName(full: string | null): string {
  if (!full) return "there";
  return full.trim().split(/\s+/)[0] ?? "there";
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

async function loadHome() {
  const since24h = new Date(Date.now() - 24 * 3600_000);

  const [profile, featured, newToday, strongCount, inPipeline] = await Promise.all([
    db.select({ fullName: schema.profile.fullName }).from(schema.profile).limit(1),

    db
      .select({
        id: schema.jobs.id,
        title: schema.jobs.title,
        location: schema.jobs.location,
        fitScore: schema.jobs.fitScore,
        gapAnalysis: schema.jobs.gapAnalysis,
        companyName: schema.companies.name,
      })
      .from(schema.jobs)
      .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
      .where(inArray(schema.jobs.tier, [1, 2, 3]))
      .orderBy(desc(schema.jobs.fitScore), desc(schema.jobs.discoveredAt))
      .limit(1),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.jobs)
      .where(gte(schema.jobs.discoveredAt, since24h)),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.jobs)
      .where(and(inArray(schema.jobs.tier, [1, 2, 3]), gte(schema.jobs.fitScore, "80"))),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.applications)
      .where(and(ne(schema.applications.status, "rejected"), ne(schema.applications.status, "new"))),
  ]);

  const [totalT123] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.jobs)
    .where(inArray(schema.jobs.tier, [1, 2, 3]));

  return {
    name: firstName(profile[0]?.fullName ?? null),
    featured: featured[0] ?? null,
    newToday: newToday[0]?.count ?? 0,
    strongCount: strongCount[0]?.count ?? 0,
    inPipeline: inPipeline[0]?.count ?? 0,
    totalInbox: totalT123?.count ?? 0,
  };
}

export default async function HomePage() {
  if (!(await isAdmin())) redirect("/admin");
  const d = await loadHome();
  const f = d.featured;
  const strengths = (f?.gapAnalysis as GapAnalysis)?.strengths ?? [];
  const score = f?.fitScore != null ? Math.round(Number(f.fitScore)) : null;

  return (
    <div className="home">
      {/* ─── Hero zone ─── */}
      <section className="home-hero">
        <div className="home-date">{formatDate(new Date())}</div>
        <h1 className="home-greeting">
          {greeting()},<br />{d.name}<span className="accent-dot">.</span>
        </h1>
        <p className="home-sub">
          {d.strongCount > 0 ? (
            <>
              You have <strong>{d.strongCount}</strong> strong match{d.strongCount === 1 ? "" : "es"} waiting.
              {d.newToday > 0 && <><br /><strong>{d.newToday}</strong> new since yesterday.</>}
            </>
          ) : d.totalInbox > 0 ? (
            <>
              <strong>{d.totalInbox}</strong> roles in your inbox, sorted by fit.
              {d.newToday > 0 && <> <strong>{d.newToday}</strong> arrived overnight.</>}
            </>
          ) : (
            <>The next discovery run kicks off tonight.<br />Check back in the morning.</>
          )}
        </p>
      </section>

      {/* ─── Featured pick ─── */}
      <section className="home-pick">
        {f ? (
          <>
            <div className="home-pick-label">Picked for you</div>
            <Link href={`/inbox/${f.id}`} className="home-featured">
              {score != null && (
                <span className="home-featured-watermark" aria-hidden="true">{score}</span>
              )}
              <div className="home-featured-company">
                {f.companyName ?? "Unknown"}
                {f.location && <><span className="sep">·</span><span className="loc">{f.location}</span></>}
              </div>
              <h2 className="home-featured-title">{f.title}</h2>
              {score != null && (
                <div className="home-featured-score">
                  <span className="home-featured-score-num">{score}</span>
                  <span className="home-featured-score-label">% match</span>
                </div>
              )}
              <p className="home-featured-reason">
                {strengths.length > 0 ? (
                  <>{strengths.slice(0, 2).join(". ")}.</>
                ) : (
                  "Strong profile match on skills, tools, and seniority."
                )}
              </p>
              <span className="home-featured-cta">Open this role →</span>
            </Link>
          </>
        ) : (
          <div className="home-empty">
            <div className="home-empty-icon" aria-hidden="true">○</div>
            <h2>Nothing here yet.</h2>
            <p>
              Your first nightly run will surface a top match here.
              The cron runs between 02:00 and 07:00 Amsterdam time.
            </p>
          </div>
        )}
      </section>

      {/* ─── Glance tiles — below the fold ─── */}
      <div className="home-glance-divider" />
      <section className="home-glance">
        <Link className="home-glance-tile" href="/inbox">
          <span className="home-glance-label">Inbox</span>
          <span className="home-glance-value">{d.totalInbox}</span>
          <span className="home-glance-sub">roles worth reviewing</span>
          <span className="home-glance-link">See all →</span>
        </Link>
        <Link className="home-glance-tile" href="/pipeline">
          <span className="home-glance-label">Pipeline</span>
          <span className="home-glance-value">{d.inPipeline}</span>
          <span className="home-glance-sub">saved or applied</span>
          <span className="home-glance-link">View pipeline →</span>
        </Link>
        <Link className="home-glance-tile" href="/dashboard">
          <span className="home-glance-label">Discovered</span>
          <span className="home-glance-value">{d.newToday > 0 ? `+${d.newToday}` : "—"}</span>
          <span className="home-glance-sub">in the last 24 hours</span>
          <span className="home-glance-link">Dashboard →</span>
        </Link>
      </section>
    </div>
  );
}
