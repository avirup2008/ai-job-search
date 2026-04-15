export default function InboxPage() {
  return (
    <>
      <header className="app-header">
        <div>
          <span className="label">Today</span>
          <h1>Inbox</h1>
        </div>
        <div className="app-header-meta">Sub-plan 9.2 ships the populated view.</div>
      </header>
      <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
        <p className="meta" style={{ marginBottom: 12 }}>No jobs in view yet</p>
        <p style={{ color: "var(--text-2)" }}>
          The nightly cron discovers jobs at 02:00–07:00 Amsterdam time.
          When a run finishes, matched jobs land here with a fit score.
        </p>
      </div>
    </>
  );
}
