import { db, schema } from "@/db";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [row] = await db.select().from(schema.profile).limit(1);

  if (!row) {
    return (
      <main style={{ fontFamily: "system-ui, sans-serif", padding: 16 }}>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>Profile</h1>
        <p>No profile row found. Run <code>scripts/seed-profile.ts</code> to seed.</p>
      </main>
    );
  }

  const roles = (row.roles as Array<{ company: string; title: string; dates: string; achievements: string[] }>) ?? [];
  const tools = row.toolStack as Record<string, string>;
  const constraints = row.constraints as Record<string, unknown>;
  const preferences = row.preferences as Record<string, unknown>;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Profile</h1>
      <p style={{ color: "#666", marginBottom: 16, fontSize: 13 }}>
        Last updated: {new Date(row.updatedAt).toLocaleString()} by {row.updatedBy}
      </p>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Roles ({roles.length})</h2>
        {roles.map((r, i) => (
          <div key={i} style={{ marginBottom: 12, padding: 12, background: "#f7f7f7", borderRadius: 4 }}>
            <div style={{ fontWeight: 600 }}>{r.title} @ {r.company}</div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{r.dates}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {(r.achievements ?? []).slice(0, 3).map((a, j) => (<li key={j}>{a}</li>))}
              {(r.achievements ?? []).length > 3 && <li><em>+{r.achievements.length - 3} more</em></li>}
            </ul>
          </div>
        ))}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Tool stack ({Object.keys(tools ?? {}).length})</h2>
        <div style={{ fontSize: 13 }}>
          {Object.entries(tools ?? {}).map(([t, lvl]) => (
            <span key={t} style={{ display: "inline-block", margin: "2px 4px", padding: "2px 6px", background: "#eef", borderRadius: 3 }}>
              {t} <span style={{ color: "#666", fontSize: 11 }}>({String(lvl).split(" — ")[0]})</span>
            </span>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Constraints</h2>
        <pre style={{ fontSize: 12, background: "#f7f7f7", padding: 8, borderRadius: 4 }}>
          {JSON.stringify(constraints, null, 2)}
        </pre>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Preferences</h2>
        <pre style={{ fontSize: 12, background: "#f7f7f7", padding: 8, borderRadius: 4 }}>
          {JSON.stringify(preferences, null, 2)}
        </pre>
      </section>

      <p style={{ fontSize: 12, color: "#666" }}>
        Editing UI will land in a later phase. For now, update via <code>scripts/seed-profile.ts</code> and re-run.
      </p>
    </main>
  );
}
