import { db, schema } from "@/db";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const rows = await db
    .select({
      id: schema.jobs.id,
      source: schema.jobs.source,
      title: schema.jobs.title,
      sourceUrl: schema.jobs.sourceUrl,
      location: schema.jobs.location,
      fitScore: schema.jobs.fitScore,
      tier: schema.jobs.tier,
      hardFilterReason: schema.jobs.hardFilterReason,
      gapAnalysis: schema.jobs.gapAnalysis,
      discoveredAt: schema.jobs.discoveredAt,
      companyName: schema.companies.name,
    })
    .from(schema.jobs)
    .leftJoin(schema.companies, sql`${schema.companies.id} = ${schema.jobs.companyId}`)
    .orderBy(desc(schema.jobs.tier), desc(schema.jobs.fitScore))
    .limit(500);

  const tierCounts = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.hardFilterReason ? "filtered" : r.tier ? `T${r.tier}` : "no-tier";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Jobs ({rows.length})</h1>
      <p style={{ marginBottom: 16, color: "#555" }}>
        {Object.entries(tierCounts).map(([k, v]) => `${k}: ${v}`).join(" · ")}
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
            <th style={th}>Tier</th>
            <th style={th}>Fit</th>
            <th style={th}>Title</th>
            <th style={th}>Company</th>
            <th style={th}>Location</th>
            <th style={th}>Source</th>
            <th style={th}>Status</th>
            <th style={th}>Link</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #eee", background: tierBg(r.tier, r.hardFilterReason) }}>
              <td style={td}>{r.tier ? `T${r.tier}` : "—"}</td>
              <td style={td}>{r.fitScore ?? "—"}</td>
              <td style={td}>{r.title}</td>
              <td style={td}>{r.companyName ?? "?"}</td>
              <td style={td}>{r.location ?? ""}</td>
              <td style={td}>{r.source}</td>
              <td style={td}>{r.hardFilterReason ?? (r.tier ? "ranked" : "rank-failed")}</td>
              <td style={td}>
                <a href={r.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#06f" }}>open</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "6px 8px", verticalAlign: "top" };

function tierBg(tier: number | null, filter: string | null): string {
  if (filter) return "#fafafa";
  if (tier === 1) return "#e6ffe6";
  if (tier === 2) return "#f0f8ff";
  if (tier === 3) return "#fffef0";
  return "#fff";
}
