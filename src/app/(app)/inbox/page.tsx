import { db, schema } from "@/db";
import { and, desc, gte, inArray, lt, sql } from "drizzle-orm";
import { JobCard, type JobCardData } from "@/components/inbox/JobCard";
import "@/components/inbox/inbox.css";

type GapAnalysis = { strengths?: string[]; gaps?: string[] } | null;

type Band = "all" | "strong" | "medium" | "stretch";

const ALLOWED_TIERS = [1, 2, 3] as const;

interface BandCount {
  band: Band;
  count: number;
}

function bandFilter(band: Band) {
  const tierBase = inArray(schema.jobs.tier, [...ALLOWED_TIERS]);
  switch (band) {
    case "strong":
      return and(tierBase, gte(schema.jobs.fitScore, "80"));
    case "medium":
      return and(tierBase, gte(schema.jobs.fitScore, "65"), lt(schema.jobs.fitScore, "80"));
    case "stretch":
      return and(tierBase, gte(schema.jobs.fitScore, "40"), lt(schema.jobs.fitScore, "65"));
    case "all":
    default:
      return tierBase;
  }
}

async function loadJobs(band: Band): Promise<JobCardData[]> {
  const rows = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.title,
      location: schema.jobs.location,
      source: schema.jobs.source,
      sourceUrl: schema.jobs.sourceUrl,
      postedAt: schema.jobs.postedAt,
      tier: schema.jobs.tier,
      fitScore: schema.jobs.fitScore,
      gapAnalysis: schema.jobs.gapAnalysis,
      dutchRequired: schema.jobs.dutchRequired,
      companyName: schema.companies.name,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, sql`${schema.jobs.companyId} = ${schema.companies.id}`)
    .where(bandFilter(band))
    .orderBy(desc(schema.jobs.fitScore), desc(schema.jobs.postedAt))
    .limit(200);

  return rows.map((r) => {
    const ga = (r.gapAnalysis ?? null) as GapAnalysis;
    const scoreNum = r.fitScore == null ? null : Number(r.fitScore);
    return {
      id: r.id,
      title: r.title,
      companyName: r.companyName ?? "Unknown company",
      location: r.location,
      source: r.source,
      sourceUrl: r.sourceUrl,
      postedAt: r.postedAt,
      tier: r.tier,
      fitScore: scoreNum,
      strengths: ga?.strengths ?? null,
      gaps: ga?.gaps ?? null,
      dutchRequired: r.dutchRequired,
    };
  });
}

async function loadBandCounts(): Promise<Record<Band, number>> {
  const [strongRows, mediumRows, stretchRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.jobs)
      .where(bandFilter("strong")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.jobs)
      .where(bandFilter("medium")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.jobs)
      .where(bandFilter("stretch")),
  ]);

  const strong = strongRows[0]?.count ?? 0;
  const medium = mediumRows[0]?.count ?? 0;
  const stretch = stretchRows[0]?.count ?? 0;

  return {
    all: strong + medium + stretch,
    strong,
    medium,
    stretch,
  };
}

function parseBand(raw: string | string[] | undefined): Band {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || v === "all") return "all";
  if (v === "strong" || v === "medium" || v === "stretch") return v;
  return "all";
}

function groupByBand(jobs: JobCardData[]): {
  strong: JobCardData[];
  medium: JobCardData[];
  stretch: JobCardData[];
} {
  const strong: JobCardData[] = [];
  const medium: JobCardData[] = [];
  const stretch: JobCardData[] = [];
  for (const job of jobs) {
    const s = job.fitScore;
    if (s != null && s >= 80) strong.push(job);
    else if (s != null && s >= 65) medium.push(job);
    else stretch.push(job);
  }
  return { strong, medium, stretch };
}

const SECTION_LABELS: Record<"strong" | "medium" | "stretch", string> = {
  strong: "Ready to apply \u2014 strong fit with your profile",
  medium: "Worth exploring \u2014 good fit, some areas to address",
  stretch: "Stretch \u2014 lower confidence, but could surprise you",
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ band?: string }>;
}) {

  const { band: bandRaw } = await searchParams;
  const band = parseBand(bandRaw);
  const [jobs, counts] = await Promise.all([loadJobs(band), loadBandCounts()]);

  const tabs: Array<{ key: Band; label: string; count: number }> = [
    { key: "all", label: "All", count: counts.all },
    { key: "strong", label: "Ready to apply", count: counts.strong },
    { key: "medium", label: "Worth exploring", count: counts.medium },
    { key: "stretch", label: "Stretch", count: counts.stretch },
  ];

  const isAll = band === "all";
  const grouped = isAll ? groupByBand(jobs) : null;

  return (
    <>
      <header className="app-header">
        <div>
          <h1 className="inbox-title">Your matches</h1>
        </div>
        <div className="app-header-meta">
          {counts.all} role{counts.all === 1 ? "" : "s"}, sorted by fit
        </div>
      </header>

      <div className="inbox-toolbar">
        <div className="tab-group" role="tablist" aria-label="Filter by score band">
          {tabs.map((t) => {
            const active = band === t.key;
            const href = t.key === "all" ? "/inbox" : `/inbox?band=${t.key}`;
            return (
              <a
                key={t.key}
                href={href}
                role="tab"
                aria-selected={active}
                className={`tab${active ? " tab-active" : ""}`}
              >
                {t.label}
                <span className="tab-count">{t.count}</span>
              </a>
            );
          })}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="inbox-empty">
          <h3>No jobs in this view yet</h3>
          <p>
            The nightly cron discovers jobs overnight (02:00-07:00 Amsterdam time).
            When a run finishes, matched jobs land here with a fit score.
          </p>
        </div>
      ) : isAll && grouped ? (
        <div className="inbox-list">
          {(["strong", "medium", "stretch"] as const).map((b) => {
            const section = grouped[b];
            if (section.length === 0) return null;
            return (
              <section key={b} className="inbox-section">
                <h2 className="inbox-section-label">
                  {SECTION_LABELS[b]} ({section.length})
                </h2>
                <div className="inbox-cards">
                  {section.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="inbox-list">
          <div className="inbox-cards">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
