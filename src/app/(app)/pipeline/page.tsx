import { db, schema } from "@/db";
import { eq, desc, ne, and, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { PipelineCard, type PipelineCardData } from "@/components/pipeline/PipelineCard";
import "@/components/pipeline/pipeline.css";

/* ── types ── */
type ActionGroup = "prepare" | "waiting" | "interview";

interface TimelineEvent {
  description: string;
  color: "green" | "amber" | "blue";
  relativeTime: string;
}

interface FocusRole extends PipelineCardData {
  docCount: number;
}

/* ── helpers ── */
function relativeTime(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const mins = Math.floor((Date.now() - dt.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function daysAgo(d: Date | string | null): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  const days = Math.floor((Date.now() - dt.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function focusPrompt(docCount: number): string {
  if (docCount === 0) return "Generate a tailored CV and cover letter for this role.";
  if (docCount === 1) return "One doc is ready. Generate the other, then review and apply.";
  return "Your cover letter and CV are ready. Review them, then apply.";
}

function focusCta(docCount: number): string {
  if (docCount >= 2) return "Review & apply";
  return "Generate docs";
}

/* ── data loading ── */
async function loadPipelineData() {
  // Applications with status NOT 'new' and NOT 'rejected'
  const apps = await db
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
    .where(
      and(
        ne(schema.applications.status, "new"),
        ne(schema.applications.status, "rejected"),
      ),
    )
    .orderBy(desc(schema.applications.lastEventAt));

  // Doc counts per application
  const docCounts = await db
    .select({
      applicationId: schema.documents.applicationId,
      docCount: count(schema.documents.id),
    })
    .from(schema.documents)
    .groupBy(schema.documents.applicationId);

  const docMap = new Map(docCounts.map((d) => [d.applicationId, Number(d.docCount)]));

  // Recent documents for timeline
  const recentDocs = await db
    .select({
      applicationId: schema.documents.applicationId,
      kind: schema.documents.kind,
      createdAt: schema.documents.createdAt,
    })
    .from(schema.documents)
    .orderBy(desc(schema.documents.createdAt))
    .limit(4);

  const mapped: PipelineCardData[] = apps.map((r) => ({
    applicationId: r.applicationId,
    jobId: r.jobId,
    title: r.title,
    companyName: r.companyName ?? "Unknown company",
    status: r.status as PipelineCardData["status"],
    fitScore: r.fitScore == null ? null : Number(r.fitScore),
    lastEventAt: r.lastEventAt,
    docCount: docMap.get(r.applicationId) ?? 0,
  }));

  return { apps: mapped, docMap, recentDocs };
}

/* ── page ── */
export default async function PipelinePage() {
  const { apps, docMap, recentDocs } = await loadPipelineData();

  if (apps.length === 0) {
    return (
      <div className="pipe-empty-state">
        <div className="pipe-empty-icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        </div>
        <h1 className="pipe-empty-title">Your pipeline</h1>
        <p className="pipe-empty-text">
          Save roles from your inbox to start building your pipeline.
        </p>
      </div>
    );
  }

  // Stats
  const saved = apps.filter((a) => a.status === "saved");
  const applied = apps.filter((a) => a.status === "applied");
  const interviews = apps.filter((a) => a.status === "interview");
  const offers = apps.filter((a) => a.status === "offer");
  const totalDocs = [...docMap.values()].reduce((s, n) => s + n, 0);

  // Focus card: highest fitScore among saved roles with fewest generated docs
  const focusRole: FocusRole | null = saved.length > 0
    ? saved
        .map((a) => ({ ...a, docCount: docMap.get(a.applicationId) ?? 0 }))
        .sort((a, b) => {
          // Fewest docs first, then highest score
          if (a.docCount !== b.docCount) return a.docCount - b.docCount;
          return (b.fitScore ?? 0) - (a.fitScore ?? 0);
        })[0]
    : null;

  // Action groups (excluding the focus role from the saved group)
  const prepareRoles = saved.filter(
    (a) => !focusRole || a.applicationId !== focusRole.applicationId,
  );
  const waitingRoles = applied;
  const interviewRoles = [...interviews, ...offers];

  const groupedCount = prepareRoles.length + waitingRoles.length + interviewRoles.length;

  // Timeline events
  const timeline: TimelineEvent[] = recentDocs.map((d) => ({
    description: `${d.kind} generated`,
    color: "green" as const,
    relativeTime: relativeTime(d.createdAt),
  }));

  return (
    <>
      {/* Header */}
      <header className="pipe-header">
        <h1 className="pipe-heading">Your pipeline</h1>
        <p className="pipe-meta">
          {apps.length} role{apps.length === 1 ? "" : "s"} in motion. Here&apos;s where to focus.
        </p>
      </header>

      {/* Top row: focus + progress */}
      <div className="pipe-top-row">
        {/* Focus card */}
        {focusRole && (
          <section className="pipe-focus" aria-label="Focus role">
            <span className="pipe-section-label">
              <span className="pipe-label-line" aria-hidden="true" />
              Do this next
            </span>
            <div className="pipe-focus-card">
              <div className="pipe-focus-rail" aria-hidden="true" />
              <div className="pipe-focus-body">
                <div className="pipe-focus-top">
                  <div className="pipe-focus-info">
                    <span className="pipe-focus-company">{focusRole.companyName}</span>
                    <a href={`/inbox/${focusRole.jobId}`} className="pipe-focus-title">
                      {focusRole.title}
                    </a>
                  </div>
                  {focusRole.fitScore != null && (
                    <span className="pipe-focus-score mono">{Math.round(focusRole.fitScore)}%</span>
                  )}
                </div>
                <p className="pipe-focus-prompt">{focusPrompt(focusRole.docCount)}</p>
                <div className="pipe-focus-actions">
                  <a href={`/inbox/${focusRole.jobId}`} className="pipe-btn pipe-btn-primary">
                    {focusCta(focusRole.docCount)} <span aria-hidden="true">&rarr;</span>
                  </a>
                  <PipelineCard
                    data={focusRole}
                    variant="ghost-select"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Progress panel */}
        <section className="pipe-progress" aria-label="Your progress">
          <span className="pipe-section-label">Your progress</span>
          <div className="pipe-stats">
            <div className="pipe-stat">
              <span className="pipe-stat-num mono">{saved.length + applied.length + interviews.length + offers.length}</span>
              <span className="pipe-stat-label">roles saved</span>
            </div>
            <div className="pipe-stat">
              <span className="pipe-stat-num mono">{totalDocs}</span>
              <span className="pipe-stat-label">docs generated</span>
            </div>
            <div className="pipe-stat">
              <span className="pipe-stat-num mono">{applied.length}</span>
              <span className="pipe-stat-label">applied</span>
            </div>
            <div className="pipe-stat">
              <span className="pipe-stat-num mono">{interviews.length}</span>
              <span className="pipe-stat-label">interviews</span>
              {interviews.length > 0 && (
                <span className="pipe-stat-sub">it&apos;s working &#x2726;</span>
              )}
            </div>
          </div>

          {timeline.length > 0 && (
            <div className="pipe-timeline">
              {timeline.map((ev, i) => (
                <div key={i} className="pipe-timeline-event">
                  <span className={`pipe-timeline-dot pipe-timeline-dot--${ev.color}`} aria-hidden="true" />
                  <span className="pipe-timeline-desc">{ev.description}</span>
                  <span className="pipe-timeline-time mono">{ev.relativeTime}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Bottom: action-grouped role list */}
      {groupedCount > 0 && (
        <section className="pipe-roles" aria-label="Pipeline roles">
          <div className="pipe-roles-header">
            <span className="pipe-roles-title">
              Also in your pipeline ({groupedCount} role{groupedCount === 1 ? "" : "s"})
            </span>
            <span className="pipe-roles-line" aria-hidden="true" />
          </div>

          {prepareRoles.length > 0 && (
            <div className="pipe-group">
              <div className="pipe-group-header">
                <span className="pipe-group-name">Review &amp; prepare</span>
                <span className="pipe-badge pipe-badge--green">{prepareRoles.length}</span>
              </div>
              <div className="pipe-group-list">
                {prepareRoles.map((a) => (
                  <PipelineCard key={a.applicationId} data={a} variant="row" groupColor="green" />
                ))}
              </div>
            </div>
          )}

          {waitingRoles.length > 0 && (
            <div className="pipe-group">
              <div className="pipe-group-header">
                <span className="pipe-group-name">Waiting to hear back</span>
                <span className="pipe-badge pipe-badge--amber">{waitingRoles.length}</span>
              </div>
              <div className="pipe-group-list">
                {waitingRoles.map((a) => (
                  <PipelineCard key={a.applicationId} data={a} variant="row" groupColor="amber" />
                ))}
              </div>
            </div>
          )}

          {interviewRoles.length > 0 && (
            <div className="pipe-group">
              <div className="pipe-group-header">
                <span className="pipe-group-name">Interview coming up</span>
                <span className="pipe-badge pipe-badge--blue">{interviewRoles.length}</span>
              </div>
              <div className="pipe-group-list">
                {interviewRoles.map((a) => (
                  <PipelineCard key={a.applicationId} data={a} variant="row" groupColor="blue" />
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
