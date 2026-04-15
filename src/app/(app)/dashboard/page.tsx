export default function DashboardPage() {
  return (
    <>
      <header className="app-header">
        <div>
          <span className="label">Overview</span>
          <h1>Dashboard</h1>
        </div>
        <div className="app-header-meta">Sub-plan 9.5 ships KPIs + budget burndown.</div>
      </header>
      <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
        <p style={{ color: "var(--text-2)" }}>
          Counts (jobs discovered, docs generated, applications sent) and budget burndown land here.
        </p>
      </div>
    </>
  );
}
