import Link from "next/link";
import { companyAvatar } from "@/lib/ui/avatar";

export interface GapCoachRaw {
  id: string;
  title: string;
  companyName: string | null;
  fitScore: string | number | null;
  fitBreakdown: { skills?: number; tools?: number; seniority?: number; industry?: number } | null;
  gapAnalysis: { strengths?: string[]; gaps?: string[]; recommendation?: string; recommendationReason?: string } | null;
}

export interface GapCoachRow {
  id: string;
  title: string;
  companyName: string;
  fitScore: number;
  closenessDelta: number;
  gaps: string[];
  breakdown: { skills?: number; tools?: number; seniority?: number; industry?: number };
}

export function shapeGapCoachRow(raw: GapCoachRaw): GapCoachRow {
  const score = raw.fitScore == null ? 0 : Number(raw.fitScore);
  return {
    id: raw.id,
    title: raw.title,
    companyName: raw.companyName ?? "Unknown company",
    fitScore: score,
    closenessDelta: Math.max(0, 85 - score),
    gaps: Array.isArray(raw.gapAnalysis?.gaps) ? raw.gapAnalysis!.gaps! : [],
    breakdown: raw.fitBreakdown ?? {},
  };
}

export function sortGapCoachRows(rows: GapCoachRow[]): GapCoachRow[] {
  return [...rows].sort((a, b) => b.fitScore - a.fitScore);
}

export function GapCoachList({ rows }: { rows: GapCoachRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="gap-coach-empty">
        <h3>No T2 jobs yet</h3>
        <p>
          Once Disha scores more matches, closeness-to-T1 candidates will appear here.
        </p>
      </div>
    );
  }
  return (
    <ul className="gap-coach-list">
      {rows.map((r) => {
        const avatar = companyAvatar(r.companyName);
        return (
          <li key={r.id} className="gap-coach-row">
            <Link href={`/inbox/${r.id}`} className="gap-coach-link">
              <div
                className="gap-coach-avatar"
                style={{ background: avatar.bg }}
                aria-hidden="true"
              >
                {avatar.letter}
              </div>
              <div className="gap-coach-main">
                <div className="gap-coach-title">{r.title}</div>
                <div className="gap-coach-company">{r.companyName}</div>
                {r.gaps.length > 0 && (
                  <div className="gap-coach-gaps">
                    <span className="gap-coach-gaps-label">
                      What&rsquo;s holding this back
                    </span>
                    <ul>
                      {r.gaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="gap-coach-score">
                <div className="gap-coach-score-num mono">
                  {Math.round(r.fitScore)}%
                </div>
                <div className="gap-coach-score-delta">
                  &minus;{r.closenessDelta} pts to T1
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
