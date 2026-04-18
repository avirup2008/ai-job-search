import { db, schema } from "@/db";
import { eq, desc, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { companyAvatar, matchBand } from "@/lib/ui/avatar";
import { GeneratePanel, type DocSummary } from "@/components/job-detail/GeneratePanel";
import { ScoreBreakdown } from "@/components/job-detail/ScoreBreakdown";
import { InterviewPromptPanel } from "@/components/job-detail/InterviewPromptPanel";
import { InterviewBriefDownload } from "@/components/job-detail/InterviewBriefDownload";
import { InterviewWeakPoints } from "@/components/job-detail/InterviewWeakPoints";
import "@/components/job-detail/detail.css";

type FitBreakdown = { skills?: number; tools?: number; seniority?: number; industry?: number } | null;
type GapAnalysis = { strengths?: string[]; gaps?: string[]; recommendation?: string; recommendationReason?: string } | null;
type DossierData = { productOneLiner?: string; stage?: string; industry?: string; marketingStack?: string[]; narrative?: string; lowSignal?: boolean } | null;

/** Format raw JD text into paragraphs with basic structure detection */
function formatJd(raw: string): string[] {
  // Split on double newlines or lines that look like headers
  const blocks = raw.split(/\n{2,}/).filter((b) => b.trim());
  return blocks.map((b) => b.trim());
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

  // Use cached research only — never block page load with a live Sonnet call
  const dossier = company?.researchJson
    ? (company.researchJson as { productOneLiner?: string; stage?: string; industry?: string; marketingStack?: string[]; narrative?: string; lowSignal?: boolean })
    : null;

  return { job, company, documents, dossier, status: application?.status ?? null };
}

export default async function JobDetailPage({ params }: { params: Promise<Params> }) {
  const { jobId } = await params;

  const detail = await loadDetail(jobId);
  if (!detail) notFound();

  const { job, company, documents, dossier, status } = detail;
  const companyName = company?.name ?? "Unknown company";
  const avatar = companyAvatar(companyName);
  const scoreNum = job.fitScore == null ? null : Number(job.fitScore);
  const scoreBand = matchBand(scoreNum);
  const breakdown = (job.fitBreakdown ?? null) as FitBreakdown;
  const gap = (job.gapAnalysis ?? null) as GapAnalysis;

  const fitSnippet = (gap?.strengths ?? []).slice(0, 2).join(". ");

  return (
    <>
      <Link href="/inbox" className="detail-back">&larr; Inbox</Link>

      {/* 1. Header with apply button */}
      <div className="detail-head">
        <div className="detail-head-avatar" style={{ background: avatar.bg }} aria-hidden="true">
          {avatar.letter}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{job.title}</h1>
          <div className="detail-head-meta">
            <span>{companyName}</span>
            {job.location && <><span className="sep">&middot;</span><span>{job.location}</span></>}
            {job.dutchRequired && <><span className="sep">&middot;</span><span>Dutch required</span></>}
          </div>
        </div>
        <div className="detail-head-right">
          <div className="detail-score">
            <span className="detail-score-num mono" data-band={scoreBand}>
              {scoreNum != null ? `${Math.round(scoreNum)}%` : "\u2014"}
            </span>
            <span className="detail-score-label">Match</span>
          </div>
          <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="detail-apply-btn">
            Apply on {job.source} &#8599;
          </a>
        </div>
      </div>

      <div className="detail-layout">
        <div>
          {/* 2. Why you're a strong fit — LEADS the page */}
          {(gap?.strengths?.length || gap?.gaps?.length) && (
            <section className="detail-section">
              <h2>Why you&rsquo;re a strong fit</h2>
              <div className="fit-hero">
                <p className="fit-hero-headline">
                  This role plays directly to your strongest skills.
                </p>
                {(gap.strengths ?? []).length > 0 && (
                  <ul className="fit-list fit-list-strengths">
                    {(gap.strengths ?? []).map((s, i) => (
                      <li key={i}><span className="fit-marker">&#10022;</span><span>{s}</span></li>
                    ))}
                  </ul>
                )}
                {(gap.gaps ?? []).length > 0 && (
                  <>
                    <span className="fit-prep-label">Areas to prepare for</span>
                    <ul className="fit-list fit-list-prep">
                      {(gap.gaps ?? []).map((s, i) => (
                        <li key={i}><span className="fit-marker">&#9675;</span><span>{s}</span></li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              {gap.recommendationReason && (
                <p className="meta" style={{ marginTop: 12, fontStyle: "italic" }}>{gap.recommendationReason}</p>
              )}
              <ScoreBreakdown breakdown={breakdown} matched={gap?.strengths ?? []} missing={gap?.gaps ?? []} />
            </section>
          )}

          {status === "interview" && (
            <InterviewPromptPanel
              role={job.title}
              companyName={companyName}
              jdText={job.jdText ?? ""}
              dossier={dossier}
            />
          )}

          {status === "interview" && (
            <InterviewBriefDownload jobId={jobId} />
          )}

          {status === "interview" && <InterviewWeakPoints />}

          {/* 3. Your application — doc cards */}
          <section className="detail-section detail-section-docs">
            <h2>Your application</h2>
            <GeneratePanel jobId={jobId} docs={documents} />
          </section>

          {/* 4. About the role — formatted JD text */}
          <section className="detail-section">
            <h2>About the role</h2>
            <div className="jd-text">
              {job.jdText ? (
                formatJd(job.jdText).map((block, i) => {
                  const trimmed = block.trim();
                  // Detect bullet lines
                  if (trimmed.match(/^[•\-\*]\s/m)) {
                    const items = trimmed.split(/\n/).filter((l) => l.trim());
                    return (
                      <ul key={i} className="jd-bullets">
                        {items.map((item, j) => (
                          <li key={j}>{item.replace(/^[•\-\*]\s*/, "")}</li>
                        ))}
                      </ul>
                    );
                  }
                  // Detect section headers (short lines, possibly uppercase or ending with :)
                  if (trimmed.length < 60 && (trimmed === trimmed.toUpperCase() || trimmed.endsWith(":"))) {
                    return <h3 key={i} className="jd-heading">{trimmed}</h3>;
                  }
                  return <p key={i}>{trimmed}</p>;
                })
              ) : (
                <p className="meta">(no description captured)</p>
              )}
            </div>
            <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="jd-source-link">
              Read full listing on {job.source} &#8599;
            </a>
          </section>

          {/* 5. About the company — snapshot from cache only */}
          {dossier && (
            <section className="detail-section">
              <h2>About the company</h2>
              {dossier.productOneLiner && <p className="dossier-oneliner">{dossier.productOneLiner}</p>}
              <div className="dossier-meta-row">
                {dossier.stage && <span className="dossier-tag">{dossier.stage}</span>}
                {dossier.industry && <span className="dossier-tag">{dossier.industry}</span>}
                {dossier.lowSignal && <span className="dossier-tag dossier-tag-warn">Low signal</span>}
              </div>
              {(dossier.marketingStack ?? []).length > 0 && (
                <div className="dossier-meta-row">
                  {(dossier.marketingStack ?? []).map((tool) => (
                    <span key={tool} className="dossier-tag">{tool}</span>
                  ))}
                </div>
              )}
              {fitSnippet && (
                <div className="snapshot-fit">
                  <div className="snapshot-fit-label">Why this company fits you</div>
                  <div className="snapshot-fit-text">{fitSnippet}.</div>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="detail-col-aside">
          {/* Sticky bottom bar within aside for now */}
          <div className="sticky-pursue">
            <p className="sticky-pursue-text">Ready to pursue this role?</p>
            <button className="btn btn-ghost" disabled>Save to pipeline &rarr;</button>
          </div>
        </aside>
      </div>
    </>
  );
}
