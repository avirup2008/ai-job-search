import { db, schema } from "@/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { JobCard, type JobCardData } from "@/components/inbox/JobCard";
import "@/components/inbox/inbox.css";

type GapAnalysis = { strengths?: string[]; gaps?: string[] } | null;

const ALLOWED_TIERS = [1, 2, 3] as const;

interface TierCount { tier: number; count: number }

async function loadJobs(tier: number | "all"): Promise<JobCardData[]> {
  const tierFilter = tier === "all"
    ? inArray(schema.jobs.tier, [...ALLOWED_TIERS])
    : eq(schema.jobs.tier, tier);

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
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .where(and(tierFilter))
    .orderBy(desc(schema.jobs.fitScore), desc(schema.jobs.postedAt))
    .limit(100);

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

async function loadTierCounts(): Promise<TierCount[]> {
  const rows = await db
    .select({ tier: schema.jobs.tier, count: sql<number>`count(*)::int` })
    .from(schema.jobs)
    .where(inArray(schema.jobs.tier, [...ALLOWED_TIERS]))
    .groupBy(schema.jobs.tier);
  return rows
    .filter((r): r is { tier: number; count: number } => r.tier != null)
    .sort((a, b) => a.tier - b.tier);
}

function parseTier(raw: string | string[] | undefined): number | "all" {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || v === "all") return "all";
  const n = Number(v);
  return ALLOWED_TIERS.includes(n as 1 | 2 | 3) ? n : "all";
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");

  const { tier: tierRaw } = await searchParams;
  const tier = parseTier(tierRaw);
  const [jobs, counts] = await Promise.all([loadJobs(tier), loadTierCounts()]);
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  const byTier = Object.fromEntries(counts.map((c) => [c.tier, c.count]));

  const tabs: Array<{ key: number | "all"; label: string; count: number }> = [
    { key: "all", label: "All", count: total },
    { key: 1, label: "Tier 1", count: byTier[1] ?? 0 },
    { key: 2, label: "Tier 2", count: byTier[2] ?? 0 },
    { key: 3, label: "Tier 3", count: byTier[3] ?? 0 },
  ];

  return (
    <>
      <header className="app-header">
        <div>
          <span className="label">Matched roles</span>
          <h1>Inbox</h1>
        </div>
        <div className="app-header-meta">
          {total} role{total === 1 ? "" : "s"} worth a look, sorted by match score.
        </div>
      </header>

      <div className="inbox-toolbar">
        <div className="tab-group" role="tablist" aria-label="Filter by tier">
          {tabs.map((t) => {
            const active = tier === t.key;
            const href = t.key === "all" ? "/inbox" : `/inbox?tier=${t.key}`;
            return (
              <a
                key={String(t.key)}
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
            The nightly cron discovers jobs overnight (02:00–07:00 Amsterdam time).
            When a run finishes, matched jobs land here with a fit score.
          </p>
        </div>
      ) : (
        <div className="inbox-grid">
          {jobs.map((job) => <JobCard key={job.id} job={job} />)}
        </div>
      )}
    </>
  );
}
