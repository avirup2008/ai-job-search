export default function ProfilePage() {
  return (
    <>
      <header className="app-header">
        <div>
          <span className="label">Candidate</span>
          <h1>Profile</h1>
        </div>
        <div className="app-header-meta">Source of truth for generation.</div>
      </header>
      <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
        <p style={{ color: "var(--text-2)" }}>Profile editor. For now, see the admin page.</p>
      </div>
    </>
  );
}
