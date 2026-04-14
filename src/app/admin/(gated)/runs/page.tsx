import { db, schema } from "@/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const rows = await db.select().from(schema.runs).orderBy(desc(schema.runs.startedAt)).limit(50);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Runs ({rows.length})</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
            <th style={th}>Started</th>
            <th style={th}>Ended</th>
            <th style={th}>Duration</th>
            <th style={th}>Status</th>
            <th style={th}>Summary / Error</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const durMs = r.startedAt && r.endedAt
              ? new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime()
              : null;
            const payload = r.stageMetrics ?? r.errorJson ?? {};
            return (
              <tr key={r.id} style={{ borderBottom: "1px solid #eee", background: statusBg(r.status) }}>
                <td style={td}>{r.startedAt ? new Date(r.startedAt).toLocaleString() : ""}</td>
                <td style={td}>{r.endedAt ? new Date(r.endedAt).toLocaleString() : "—"}</td>
                <td style={td}>{durMs !== null ? `${Math.round(durMs / 1000)}s` : "—"}</td>
                <td style={td}><strong>{r.status}</strong></td>
                <td style={td}>
                  <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontFamily: "monospace", fontSize: 11 }}>
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}

const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "6px 8px", verticalAlign: "top" };

function statusBg(status: string | null): string {
  if (status === "succeeded") return "#e6ffe6";
  if (status === "partial") return "#fffbe6";
  if (status === "failed") return "#ffe6e6";
  if (status === "running") return "#e6f0ff";
  return "#fff";
}
