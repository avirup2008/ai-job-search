export default function PipelinePage() {
  return (
    <>
      <header className="app-header">
        <div>
          <span className="label">Applications</span>
          <h1>Pipeline</h1>
        </div>
        <div className="app-header-meta">Sub-plan 9.4 ships the kanban.</div>
      </header>
      <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
        <p style={{ color: "var(--text-2)" }}>
          Kanban columns will appear here: New · Saved · Applied · Interview · Offer / Rejected.
        </p>
      </div>
    </>
  );
}
