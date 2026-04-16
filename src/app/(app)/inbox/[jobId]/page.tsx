import { db, schema } from "@/db";
import { eq, desc, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/auth/admin";
import { getCompanyDossier } from "@/lib/research";
import { companyAvatar, matchBand } from "@/lib/ui/avatar";
import { GeneratePanel, type DocSummary } from "@/components/job-detail/GeneratePanel";
import "@/components/job-detail/detail.css";

type FitBreakdown = { skills?: number; tools?: number; seniority?: number; industry?: number } | null;
type GapAnalysis = { strengths?: string[]; gaps?: string[]; recommendation?: string; recommendationReason?: string } | null;

function bandOf(v: number | undefined): "strong" | "medium" | "weak" {
  if (v == null) return "weak";
  if (v >= 0.75) return "strong";
  if (v >= 0.5) return "medium";
  return "weak";
}

interface Params { jobId: string }

async function loadDetail(jobId: string) {
  const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1);
  if (!job) return null;

  const [company] = job.companyId
    ? await db.select().from(schema.companies).where(eq(schema.companies.id, job.companyId)).limit(1)
    : [];

  const [application] = await db
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.jobId, jobId))
    .limit(1);

  let documents: DocSummary[] = [];
  if (application) {
    const docRows = await db
      .select({
        kind: schema.documents.kind,
        artifactType: schema.documents.artifactType,
        blobUrlDocx: schema.documents.blobUrlDocx,
        blobUrlPdf: schema.documents.blobUrlPdf,
        version: schema.documents.version,
      })
      .from(schema.documents)
      .where(and(eq(schema.documents.applicationId, application.id)))
      .orderBy(desc(schema.documents.version));
    documents = docRows.map((d) => ({
      kind: d.kind as DocSummary["kind"],
      artifactType: d.artifactType,
      url: d.blobUrlDocx ?? d.blobUrlPdf ?? null,
      version: d.version,
    }));
  }

  const dossier = await getCompanyDossier({
    companyName: company?.name ?? "the company",
    domain: company?.domain ?? null,
  });

  return { job, company, documents, dossier };
}

export default async function JobDetailPage({ params }: { params: Promise<Params> }) {
  if (!(await isAdmin())) redirect("/admin");
  const { jobId } = await params;

  const detail = await loadDetail(jobId);
  if (!detail) notFound();

  const { job, company, documents, dossier } = detail;
  const companyName = company?.name ?? "Unknown company";
  const avatar = companyAvatar(companyName);
  const scoreNum = job.fitScore == null ? null : Number(job.fitScore);
  const scoreBand = matchBand(scoreNum);
  const breakdown = (job.fitBreakdown ?? null) as FitBreakdown;
  const gap = (job.gapAnalysis ?? null) as GapAnalysis;

  const breakdownRows: Array<{ label: string; value: number }> = breakdown
    ? [
        { label: "Skills", value: breakdown.skills ?? 0 },
        { label: "Tools", value: breakdown.tools ?? 0 },
        { label: "Seniority", value: breakdown.seniority ?? 0 },
        { label: "Industry", value: breakdown.industry ?? 0 },
      ]
    : [];

  return (
    <>
      <Link href="/inbox" className="detail-back">← Inbox</Link>

      <div className="detail-head">
        <div className="detail-head-avatar" style={{ background: avatar.bg }} aria-hidden="true">
          {avatar.letter}
        </div>
        <div>
          <h1>{job.title}</h1>
          <div className="detail-head-meta">
            <span>{companyName}</span>
            {job.location && <><span className="sep">·</span><span>{job.location}</span></>}
            {job.tier != null && <><span className="sep">·</span><span>Tier {job.tier}</span></>}
            {job.dutchRequired && <><span className="sep">·</span><span>Dutch required</span></>}
            <span className="sep">·</span>
            <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">{job.source} ↗</a>
          </div>
        </div>
        <div className="detail-score">
          <span className="detail-score-num mono" data-band={scoreBand}>
            {scoreNum != null ? `${Math.round(scoreNum)}%` : "—"}
          </span>
          <span className="detail-score-label">Match</span>
        </div>
      </div>

      <div className="detail-layout">
        <div>
          {breakdownRows.length > 0 && (
            <section className="detail-section">
              <h2>Match breakdown</h2>
              <div className="breakdown">
                {breakdownRows.map((r) => {
                  const pct = Math.round(r.value * 100);
                  const band = bandOf(r.value);
                  return (
                    <div key={r.label} className="breakdown-row">
                      <span className="breakdown-label">{r.label}</span>
                      <div className="breakdown-bar">
                        <div
                          className="breakdown-fill"
                          data-band={band}
                          style={{ width: `${pct}%` }}
                          aria-label={`${r.label} ${pct}%`}
                        />
                      </div>
                      <span className="breakdown-value">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {(gap?.strengths?.length || gap?.gaps?.length) && (
            <section className="detail-section">
              <h2>Signals</h2>
              <div className="two-col">
                <div>
                  <span className="label" style={{ marginBottom: 8, display: "block" }}>Lead with</span>
                  <ul className="signal-list signal-list-strong">
                    {(gap.strengths ?? []).map((s, i) => (
                      <li key={i}><span className="marker">+</span><span>{s}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="label" style={{ marginBottom: 8, display: "block" }}>Acknowledge</span>
                  <ul className="signal-list signal-list-weak">
                    {(gap.gaps ?? []).map((s, i) => (
                      <li key={i}><span className="marker">!</span><span>{s}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
              {gap.recommendationReason && (
                <p className="meta" style={{ marginTop: 12, fontStyle: "italic" }}>{gap.recommendationReason}</p>
              )}
            </section>
          )}

          <section className="detail-section">
            <h2>Company snapshot</h2>
            <p className="dossier-oneliner">{dossier.productOneLiner}</p>
            <div className="dossier-meta-row">
              <span className="dossier-tag">{dossier.stage}</span>
              <span className="dossier-tag">{dossier.industry}</span>
              {dossier.lowSignal && <span className="dossier-tag dossier-tag-warn">Low signal</span>}
            </div>
            {dossier.marketingStack.length > 0 && (
              <div className="dossier-stack-row">
                <span className="label">Stack</span>
                <div className="dossier-stack">
                  {dossier.marketingStack.map((tool) => (
                    <span key={tool} className="dossier-chip">{tool}</span>
                  ))}
                </div>
              </div>
            )}
            {dossier.narrative && (
              <p className="dossier-insight">
                {dossier.narrative.split(/\.\s+/).slice(0, 2).join(". ")}.
              </p>
            )}
          </section>

          <section className="detail-section">
            <h2>Job description</h2>
            <div className="jd-text">
              {job.jdText ?? "(no description captured)"}
            </div>
          </section>
        </div>

        <aside className="detail-col-aside">
          <GeneratePanel jobId={jobId} docs={documents} />
        </aside>
      </div>
    </>
  );
}
