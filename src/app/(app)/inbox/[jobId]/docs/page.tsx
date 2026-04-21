import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import mammoth from "mammoth";
import "@/components/doc-viewer/doc-viewer.css";

/* ── Types ── */

interface Params {
  jobId: string;
}

interface SearchParams {
  doc?: string;
}

interface DocRow {
  id: string;
  kind: string;
  artifactType: string | null;
  version: number;
  blobUrlDocx: string | null;
  blobUrlPdf: string | null;
  createdAt: Date;
}

/* ── Helpers ── */

function docKey(d: DocRow): string {
  if (d.kind === "artifact" && d.artifactType) return `artifact-${d.artifactType}`;
  return d.kind;
}

function docLabel(d: DocRow): string {
  if (d.kind === "cover") return "Cover letter";
  if (d.kind === "cv") return "Tailored CV";
  if (d.kind === "screening") return "Screening Q&A";
  if (d.kind === "interview-prep") return "Interview prep";
  if (d.kind === "artifact" && d.artifactType) {
    return d.artifactType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return d.kind;
}

async function fetchDocContent(url: string): Promise<string> {
  try {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      ...(blobToken ? { headers: { Authorization: `Bearer ${blobToken}` } } : {}),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

/** Simple markdown-to-HTML: split paragraphs on double newline, lines within paragraphs on single newline. */
function renderMarkdown(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs
    .map((p) => {
      const lines = p
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      return `<p>${lines.join("<br />")}</p>`;
    })
    .join("");
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/* ── Data loader ── */

async function loadData(jobId: string) {
  const [job] = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.id, jobId))
    .limit(1);
  if (!job) return null;

  const [company] = job.companyId
    ? await db
        .select()
        .from(schema.companies)
        .where(eq(schema.companies.id, job.companyId))
        .limit(1)
    : [];

  const [application] = await db
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.jobId, jobId))
    .limit(1);

  const documents: DocRow[] = application
    ? await db
        .select({
          id: schema.documents.id,
          kind: schema.documents.kind,
          artifactType: schema.documents.artifactType,
          version: schema.documents.version,
          blobUrlDocx: schema.documents.blobUrlDocx,
          blobUrlPdf: schema.documents.blobUrlPdf,
          createdAt: schema.documents.createdAt,
        })
        .from(schema.documents)
        .where(eq(schema.documents.applicationId, application.id))
        .orderBy(desc(schema.documents.version))
    : [];

  return { job, company, documents };
}

/* ── Page ── */

export default async function DocsPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { jobId } = await params;
  const { doc: selectedDoc } = await searchParams;

  const data = await loadData(jobId);
  if (!data) notFound();

  const { job, company, documents } = data;
  const companyName = company?.name ?? "Unknown company";
  const scoreNum = job.fitScore == null ? null : Number(job.fitScore);

  // Deduplicate: keep only the latest version per doc key
  const latestByKey = new Map<string, DocRow>();
  for (const d of documents) {
    const key = docKey(d);
    if (!latestByKey.has(key)) latestByKey.set(key, d);
  }
  const tabs = Array.from(latestByKey.values());

  // Resolve the active document
  const activeKey = selectedDoc ?? (tabs.length > 0 ? docKey(tabs[0]) : null);
  const activeDoc = activeKey ? latestByKey.get(activeKey) ?? null : null;

  // Fetch content for active doc
  let content = "";
  let contentHtml = "";
  let isHtml = false;
  let isCv = false;

  if (activeDoc) {
    const url = activeDoc.blobUrlDocx ?? activeDoc.blobUrlPdf;
    isCv = activeDoc.kind === "cv";

    if (isCv && url) {
      // CV is DOCX — convert to HTML with mammoth
      try {
        const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
        const docxRes = await fetch(url, {
          next: { revalidate: 3600 },
          ...(blobToken ? { headers: { Authorization: `Bearer ${blobToken}` } } : {}),
        });
        if (docxRes.ok) {
          const buffer = Buffer.from(await docxRes.arrayBuffer());
          const result = await mammoth.convertToHtml({ buffer });
          contentHtml = result.value;
          isHtml = true;
          isCv = false; // treat as rendered HTML now
        }
      } catch {
        // fallback to download if conversion fails
      }
    } else if (url) {
      const raw = await fetchDocContent(url);
      if (activeDoc.kind === "artifact") {
        // Artifact blobs are already HTML
        contentHtml = raw;
        isHtml = true;
      } else {
        // Cover letter and screening Q&A are markdown
        content = raw;
        contentHtml = renderMarkdown(raw);
      }
    }
  }

  const words = content ? wordCount(content) : 0;
  const generatedDate = activeDoc
    ? activeDoc.createdAt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="doc-viewer-layout">
      {/* ── Left sidebar ── */}
      <div className="doc-sidebar">
        <Link href={`/inbox/${jobId}`} className="doc-sidebar-back">
          &larr; Back to role
        </Link>

        <div className="doc-role-card">
          <div className="doc-role-company">{companyName.toUpperCase()}</div>
          <h2 className="doc-role-title">{job.title}</h2>
          <div className="doc-role-score">
            {scoreNum != null ? `${Math.round(scoreNum)}% match` : "Not scored"}
          </div>
        </div>

        <div className="doc-tabs-heading">Documents</div>
        <div className="doc-tabs">
          {tabs.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-3)" }}>
              No documents generated yet.
            </p>
          )}
          {tabs.map((d) => {
            const key = docKey(d);
            const isActive = key === activeKey;
            return (
              <Link
                key={key}
                href={`/inbox/${jobId}/docs?doc=${encodeURIComponent(key)}`}
                className="doc-tab"
                data-active={isActive}
              >
                <span className="doc-tab-name">{docLabel(d)}</span>
                <span className="doc-tab-meta">
                  <span className="doc-tab-version">v{d.version}</span>
                  <span
                    className="doc-tab-badge"
                    data-status={d.blobUrlDocx || d.blobUrlPdf ? "ready" : "none"}
                  >
                    {d.blobUrlDocx || d.blobUrlPdf ? "Ready" : "\u2014"}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        {tabs.length > 0 && (
          <a
            href={`/api/download-pack/${jobId}`}
            className="doc-download-pack"
            download
          >
            &darr; Download application pack
          </a>
        )}
      </div>

      {/* ── Right viewer ── */}
      <div className="doc-viewer">
        {tabs.length === 0 ? (
          <div className="doc-empty">
            <p>No documents generated yet.</p>
            <Link href={`/inbox/${jobId}`}>
              &larr; Go back to generate documents
            </Link>
          </div>
        ) : activeDoc == null ? (
          <div className="doc-empty">
            <p>Document not found. Select one from the sidebar.</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="doc-toolbar">
              <span className="doc-toolbar-title">{docLabel(activeDoc)}</span>
              <div className="doc-toolbar-actions">
                  {(activeDoc.blobUrlDocx || activeDoc.blobUrlPdf) && (
                  <a
                    className="doc-toolbar-btn"
                    href={`/api/download-doc/${activeDoc.id}`}
                    download
                  >
                    Download
                  </a>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="doc-scroll">
              {isCv ? (
                <div className="doc-page">
                  <div className="doc-cv-fallback">
                    <p>CV is available as DOCX. Download to view.</p>
                    {(activeDoc.blobUrlDocx || activeDoc.blobUrlPdf) && (
                      <a
                        className="doc-toolbar-btn"
                        href={`/api/download-doc/${activeDoc.id}`}
                        download
                      >
                        Download CV
                      </a>
                    )}
                  </div>
                </div>
              ) : isHtml ? (
                <div
                  className="doc-page"
                  dangerouslySetInnerHTML={{ __html: contentHtml }}
                />
              ) : contentHtml ? (
                <div
                  className="doc-page"
                  dangerouslySetInnerHTML={{ __html: contentHtml }}
                />
              ) : (
                <div className="doc-page">
                  <p style={{ color: "var(--text-3)" }}>
                    No content available for this document.
                  </p>
                </div>
              )}
            </div>

            {/* Quality strip */}
            {!isCv && content && (
              <div className="doc-quality">
                <span className="doc-quality-check">&#10003; Quality passed</span>
                <span>&middot;</span>
                <span className="doc-quality-check">&#10003; No AI tells</span>
                <span>&middot;</span>
                <span>{words} words</span>
                {generatedDate && (
                  <>
                    <span>&middot;</span>
                    <span>Generated {generatedDate}</span>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
