import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { PipelineCard, type PipelineCardData } from "@/components/pipeline/PipelineCard";
import { PIPELINE_STAGES, type PipelineStage } from "./stages";
import "@/components/pipeline/pipeline.css";

const STAGE_LABEL: Record<PipelineStage, string> = {
  new: "New",
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

async function loadApplications(): Promise<PipelineCardData[]> {
  const rows = await db
    .select({
      applicationId: schema.applications.id,
      jobId: schema.jobs.id,
      title: schema.jobs.title,
      companyName: schema.companies.name,
      status: schema.applications.status,
      fitScore: schema.jobs.fitScore,
      lastEventAt: schema.applications.lastEventAt,
    })
    .from(schema.applications)
    .innerJoin(schema.jobs, eq(schema.applications.jobId, schema.jobs.id))
    .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
    .orderBy(desc(schema.applications.lastEventAt))
    .limit(300);

  return rows.map((r) => ({
    applicationId: r.applicationId,
    jobId: r.jobId,
    title: r.title,
    companyName: r.companyName ?? "Unknown company",
    status: (PIPELINE_STAGES as readonly string[]).includes(r.status) ? (r.status as PipelineStage) : "new",
    fitScore: r.fitScore == null ? null : Number(r.fitScore),
    lastEventAt: r.lastEventAt,
  }));
}

export default async function PipelinePage() {
  if (!(await isAdmin())) redirect("/admin");
  const apps = await loadApplications();
  const byStage: Record<PipelineStage, PipelineCardData[]> = {
    new: [],
    saved: [],
    applied: [],
    interview: [],
    offer: [],
    rejected: [],
  };
  for (const a of apps) byStage[a.status].push(a);

  return (
    <>
      <header className="app-header">
        <div>
          <span className="label">Applications</span>
          <h1>Pipeline</h1>
        </div>
        <div className="app-header-meta">
          {apps.length} application{apps.length === 1 ? "" : "s"}. Use the stage selector on a card to move it.
        </div>
      </header>

      <div className="kanban" role="list" aria-label="Application pipeline">
        {PIPELINE_STAGES.map((stage) => (
          <section key={stage} className="kanban-col" role="listitem" aria-label={STAGE_LABEL[stage]}>
            <div className="kanban-col-head">
              <span className="kanban-col-title">{STAGE_LABEL[stage]}</span>
              <span className="kanban-col-count">{byStage[stage].length}</span>
            </div>
            <div className="kanban-list">
              {byStage[stage].length === 0 ? (
                <div className="kanban-empty">—</div>
              ) : (
                byStage[stage].map((a) => (
                  <PipelineCard key={a.applicationId} data={a} />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
