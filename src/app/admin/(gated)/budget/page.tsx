import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { loadLlmEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const rows = await db.select().from(schema.llmBudget).orderBy(desc(schema.llmBudget.period)).limit(12);
  const cap = loadLlmEnv().MONTHLY_LLM_CAP_EUR;
  const current = rows[0];
  const spent = current ? Number(current.eurSpent) : 0;
  const util = cap > 0 ? spent / cap : 0;
  const bar = Math.min(100, Math.round(util * 100));

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>LLM Budget</h1>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, marginBottom: 6 }}>
          Current month ({current?.period ?? "—"}): <strong>€{spent.toFixed(2)}</strong> / €{cap.toFixed(2)} ({(util * 100).toFixed(1)}%)
        </div>
        <div style={{ width: "100%", maxWidth: 400, height: 18, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              width: `${bar}%`,
              height: "100%",
              background: util >= 0.95 ? "#c00" : util >= 0.8 ? "#e80" : "#0a0",
              transition: "width 0.3s",
            }}
          />
        </div>
        {current && (
          <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
            {current.requests} requests · {Number(current.tokensIn).toLocaleString()} in · {Number(current.tokensOut).toLocaleString()} out
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 8 }}>History</h2>
      <table style={{ width: "100%", maxWidth: 600, borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
            <th style={th}>Period</th>
            <th style={th}>Spent</th>
            <th style={th}>Cap</th>
            <th style={th}>Requests</th>
            <th style={th}>Tokens in</th>
            <th style={th}>Tokens out</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.period} style={{ borderBottom: "1px solid #eee" }}>
              <td style={td}>{r.period}</td>
              <td style={td}>€{Number(r.eurSpent).toFixed(2)}</td>
              <td style={td}>€{Number(r.capEur).toFixed(2)}</td>
              <td style={td}>{r.requests}</td>
              <td style={td}>{Number(r.tokensIn).toLocaleString()}</td>
              <td style={td}>{Number(r.tokensOut).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "6px 8px" };
