"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface GenRowSpec {
  key: "cover-letter" | "cv" | "artifact" | "screening-qa";
  label: string;
  endpoint: string;
  loadingMsg: string;
}

const ROWS: GenRowSpec[] = [
  { key: "cover-letter", label: "Cover letter", endpoint: "cover-letter", loadingMsg: "Writing letter…" },
  { key: "cv", label: "CV (tailored)", endpoint: "cv", loadingMsg: "Tailoring CV…" },
  { key: "artifact", label: "Proof artifacts", endpoint: "artifact", loadingMsg: "Building artifacts…" },
  { key: "screening-qa", label: "Screening Q&A", endpoint: "screening-qa", loadingMsg: "Picking questions…" },
];

export interface DocSummary {
  kind: "cover" | "cv" | "artifact" | "screening";
  artifactType: string | null;
  url: string | null;
  version: number;
}

export function GeneratePanel({ jobId, docs }: { jobId: string; docs: DocSummary[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; msg: string } | null>(null);

  async function run(spec: GenRowSpec) {
    setLoading(spec.key);
    setError(null);
    try {
      const res = await fetch(`/api/generate/${spec.endpoint}/${jobId}`, { method: "POST" });
      const body = await res.json().catch(() => ({ ok: false, error: "bad response" }));
      if (!res.ok || !body.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError({ key: spec.key, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(null);
    }
  }

  function docsFor(key: GenRowSpec["key"]): DocSummary[] {
    if (key === "cover-letter") return docs.filter((d) => d.kind === "cover");
    if (key === "cv") return docs.filter((d) => d.kind === "cv");
    if (key === "artifact") return docs.filter((d) => d.kind === "artifact");
    return docs.filter((d) => d.kind === "screening");
  }

  return (
    <div className="gen-panel">
      <h2>Generate</h2>
      {ROWS.map((spec) => {
        const existing = docsFor(spec.key);
        const isLoading = loading === spec.key;
        const ready = existing.length > 0;
        return (
          <div key={spec.key} className="gen-row">
            <div className="gen-row-head">
              <span className="gen-row-name">{spec.label}</span>
              <span className="gen-row-status" data-ready={ready}>
                {isLoading ? spec.loadingMsg : ready ? `${existing.length} version${existing.length > 1 ? "s" : ""}` : "Not yet"}
              </span>
            </div>
            <div className="gen-row-actions">
              <button
                className={`gen-btn${isLoading ? " loading" : ""}`}
                onClick={() => run(spec)}
                disabled={isLoading || loading !== null}
                aria-busy={isLoading}
              >
                {ready ? "Regenerate" : "Generate"}
              </button>
              {existing.slice(-2).map((d) =>
                d.url ? (
                  <a key={`${d.kind}-${d.artifactType ?? ""}-${d.version}`} className="gen-link" href={d.url} target="_blank" rel="noopener noreferrer">
                    v{d.version}{d.artifactType ? ` · ${d.artifactType.replace(/_/g, " ")}` : ""}
                  </a>
                ) : null,
              )}
            </div>
            {error && error.key === spec.key && (
              <div className="gen-error">Failed: {error.msg}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
