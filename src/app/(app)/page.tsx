import { db, schema } from "@/db";
import { desc, eq, gte, inArray, sql, and, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/auth/admin";
import { companyAvatar } from "@/lib/ui/avatar";
import "@/components/home/home.css";

type GapAnalysis = { strengths?: string[]; gaps?: string[]; recommendationReason?: string } | null;

function firstNameFrom(full: string | null): string {
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

  const profileRow = await db.select({ fullName: schema.profile.fullName }).from(schema.profile).limit(1);

  const [featuredRow] = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.title,
      location: schema.jobs.location,
      fitScore: schema.jobs.fitScore,
      gapAnalysis: schema.jobs.gapAnalysis,
      tier: schema.jobs.tier,
      companyName: schema.companies.name,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(inArray(schema.jobs.tier, [1, 2, 3]))
    .orderBy(desc(schema.jobs.fitScore), desc(schema.jobs.discoveredAt))
    .limit(1);

  const [newTodayRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.jobs)
    .where(gte(schema.jobs.discoveredAt, since24h));

  const [strongCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.jobs)
    .where(and(inArray(schema.jobs.tier, [1, 2, 3]), gte(schema.jobs.fitScore, "80")));

  const [inPipelineRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.applications)
    .where(and(ne(schema.applications.status, "rejected"), ne(schema.applications.status, "new")));

  const [docsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.documents)
    .where(gte(schema.documents.createdAt, since24h));

  const recent = await db
    .select({
      createdAt: schema.documents.createdAt,
      kind: schema.documents.kind,
      artifactType: schema.documents.artifactType,
      jobTitle: schema.jobs.title,
      companyName: schema.companies.name,
      jobId: schema.jobs.id,
    })
    .from(schema.documents)
    .innerJoin(schema.applications, eq(schema.documents.applicationId, schema.applications.id))
    .innerJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .orderBy(desc(schema.documents.createdAt))
    .limit(5);

  return {
    name: firstNameFrom(profileRow[0]?.fullName ?? null),
    featured: featuredRow ?? null,
    newToday: newTodayRow?.count ?? 0,
    strongCount: strongCountRow?.count ?? 0,
    inPipeline: inPipelineRow?.count ?? 0,
    docsToday: docsRow?.count ?? 0,
    recent,
  };
}

function humanRelative(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const mins = Math.floor((Date.now() - dt.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const DOC_LABEL: Record<string, string> = {
  cover: "Cover letter",
  cv: "CV",
  artifact: "Artifact",
  screening: "Screening Q&A",
};

export default async function HomePage() {
  if (!(await isAdmin())) redirect("/admin");
  const data = await loadHome();
  const f = data.featured;
  const strengths = (f?.gapAnalysis as GapAnalysis)?.strengths ?? [];
  const reason = (f?.gapAnalysis as GapAnalysis)?.recommendationReason ?? null;

  return (
    <div style={{ maxWidth: 960 }}>
      <div className="home-hero">
        <div className="home-date">{formatDate(new Date())}</div>
        <h1 className="home-greeting">
          {greeting()}, {data.name}<span className="accent-period">.</span>
        </h1>
        <p className="home-sub">
          {data.strongCount > 0 ? (
            <>
              <strong>{data.strongCount}</strong> strong match{data.strongCount === 1 ? "" : "es"} sitting in your inbox
              {data.newToday > 0 ? <>, <strong>{data.newToday}</strong> discovered in the last day</> : null}.
            </>
          ) : data.newToday > 0 ? (
            <>
              <strong>{data.newToday}</strong> job{data.newToday === 1 ? "" : "s"} discovered in the last day. No 80%+ matches yet today.
            </>
          ) : (
            "The next discovery run kicks off overnight. Check back in the morning."
          )}
        </p>
      </div>

      {f ? (
        <section className="featured-wrap">
          <div className="featured-label">One stands out today</div>
          <Link href={`/inbox/${f.id}`} className="featured">
            <div>
              <div className="featured-head">
                <span className="featured-company">{f.companyName ?? "Unknown"}</span>
                <span className="featured-meta">
                  {f.location && <><span className="sep">·</span>{f.location}</>}
                  {f.tier && <><span className="sep">·</span>Tier {f.tier}</>}
                </span>
              </div>
              <h2 className="featured-title">{f.title}</h2>
              <p className="featured-reason">
                {strengths.length > 0 ? (
                  <><strong>Lead with:</strong> {strengths.slice(0, 2).join(". ")}.</>
                ) : reason ? (
                  reason
                ) : (
                  "A strong profile match based on skills, tools, and seniority."
                )}
              </p>
              <span className="featured-cta">Review this role →</span>
            </div>
            <div className="featured-score">
              <span className="featured-score-num">{f.fitScore != null ? Math.round(Number(f.fitScore)) : "—"}</span>
              <span className="featured-score-label">% match</span>
            </div>
          </Link>
        </section>
      ) : (
        <section className="home-empty">
          <h2>Nothing in view yet.</h2>
          <p>Your first nightly run will populate this page with a top match and a picked shortlist.</p>
        </section>
      )}

      <section className="glance">
        <Link className="glance-tile" href="/inbox">
          <span className="glance-label">In the inbox</span>
          <span className="glance-value">{data.strongCount + data.newToday > 0 ? data.strongCount : "—"}</span>
          <span className="glance-sub">{data.newToday} new in 24h</span>
        </Link>
        <Link className="glance-tile" href="/pipeline">
          <span className="glance-label">In the pipeline</span>
          <span className="glance-value">{data.inPipeline}</span>
          <span className="glance-sub">saved, applied, interviewing</span>
        </Link>
        <Link className="glance-tile" href="/dashboard">
          <span className="glance-label">Docs generated</span>
          <span className="glance-value">{data.docsToday}</span>
          <span className="glance-sub">in the last 24 hours</span>
        </Link>
      </section>

      {data.recent.length > 0 && (
        <section className="activity-section">
          <h2>Recent activity</h2>
          <div className="activity-rail">
            {data.recent.map((r, i) => {
              const label = DOC_LABEL[r.kind] ?? r.kind;
              const suffix = r.kind === "artifact" && r.artifactType ? ` · ${r.artifactType.replace(/_/g, " ")}` : "";
              return (
                <div key={i} className="activity-item">
                  <span className="activity-time">{humanRelative(r.createdAt)}</span>
                  <span className="activity-body">
                    {label}{suffix} for <Link href={`/inbox/${r.jobId}`}>{r.jobTitle}</Link>
                    {r.companyName && <> at <span style={{ fontWeight: 600 }}>{r.companyName}</span></>}
                  </span>
                  <span className="activity-type">{r.kind}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
