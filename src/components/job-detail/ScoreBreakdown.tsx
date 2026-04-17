import { WEIGHTS } from "@/lib/pipeline/rank";

interface Props {
  breakdown: { skills?: number; tools?: number; seniority?: number; industry?: number } | null;
  matched: string[];
  missing: string[];
}

const ROW_DEFS: Array<{ key: keyof NonNullable<Props["breakdown"]> & string; label: string }> = [
  { key: "skills",    label: "Skills" },
  { key: "tools",     label: "Tools" },
  { key: "seniority", label: "Seniority" },
  { key: "industry",  label: "Industry" },
];

function bandOf(v: number): "strong" | "medium" | "weak" {
  if (v >= 0.75) return "strong";
  if (v >= 0.5) return "medium";
  return "weak";
}

export function ScoreBreakdown({ breakdown, matched, missing }: Props) {
  if (!breakdown) return null;
  return (
    <div className="score-breakdown">
      <div className="score-breakdown-rows">
        {ROW_DEFS.map(({ key, label }) => {
          const raw = breakdown[key] ?? 0;
          const weight = WEIGHTS[key as keyof typeof WEIGHTS];
          const pct = Math.round(raw * 100);
          return (
            <div key={key} className="breakdown-row">
              <span className="breakdown-label">
                {label} <span className="breakdown-weight">({Math.round(weight * 100)}%)</span>
              </span>
              <div className="breakdown-bar">
                <div className="breakdown-fill" data-band={bandOf(raw)} style={{ width: `${pct}%` }} aria-label={`${label} ${pct}%`} />
              </div>
              <span className="breakdown-value">{pct}%</span>
            </div>
          );
        })}
      </div>
      {(matched.length > 0 || missing.length > 0) && (
        <div className="score-breakdown-fields">
          {matched.length > 0 && (
            <div className="score-fields-col">
              <span className="score-fields-label score-fields-label-matched">Matched</span>
              <ul className="score-fields-list">
                {matched.map((m, i) => <li key={`m${i}`}>{m}</li>)}
              </ul>
            </div>
          )}
          {missing.length > 0 && (
            <div className="score-fields-col">
              <span className="score-fields-label score-fields-label-missing">Missing</span>
              <ul className="score-fields-list">
                {missing.map((g, i) => <li key={`g${i}`}>{g}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
