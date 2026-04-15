export default function BudgetPage() {
  return (
    <>
      <header className="app-header">
        <div>
          <span className="label">LLM spend</span>
          <h1>Budget</h1>
        </div>
        <div className="app-header-meta">€20/mo cap, Sonnet→Haiku downgrade at 80%.</div>
      </header>
      <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
        <p style={{ color: "var(--text-2)" }}>Budget detail view. For now, see the admin page.</p>
      </div>
    </>
  );
}
