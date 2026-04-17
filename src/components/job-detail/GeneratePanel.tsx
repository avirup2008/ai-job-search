"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";

interface GenRowSpec {
  key: "cover-letter" | "cv" | "artifact" | "screening-qa" | "interview-prep";
  label: string;
  endpoint: string;
  loadingMsg: string;
}

const ROWS: GenRowSpec[] = [
  { key: "cover-letter", label: "Cover letter", endpoint: "cover-letter", loadingMsg: "Writing letter…" },
  { key: "cv", label: "CV (tailored)", endpoint: "cv", loadingMsg: "Tailoring CV…" },
  { key: "artifact", label: "Proof artifacts", endpoint: "artifact", loadingMsg: "Building artifacts…" },
  { key: "screening-qa", label: "Screening Q&A", endpoint: "screening-qa", loadingMsg: "Picking questions…" },
  { key: "interview-prep", label: "Interview prep", endpoint: "interview-prep", loadingMsg: "Drafting interview prep…" },
];

const PROGRESS_MESSAGES = [
  "Reading the job description...",
  "Reviewing your experience...",
  "Matching skills to requirements...",
  "Writing your {type}...",
  "Running quality checks...",
];
const PROGRESS_PCTS = [15, 35, 55, 80, 95];

export interface DocSummary {
  kind: "cover" | "cv" | "artifact" | "screening" | "interview-prep";
  artifactType: string | null;
  url: string | null;
  version: number;
}

export function GeneratePanel({ jobId, docs }: { jobId: string; docs: DocSummary[] }) {
  const router = useRouter();
  const [generating, setGenerating] = useState<string | null>(null);
  const [progressIdx, setProgressIdx] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [summary, setSummary] = useState<{ key: string; text: string } | null>(null);
  const [error, setError] = useState<{ key: string; msg: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cycle progress messages while generating
  useEffect(() => {
    if (generating === null) return;

    setProgressIdx(0);
    setProgressPct(PROGRESS_PCTS[0]);

    intervalRef.current = setInterval(() => {
      setProgressIdx((prev) => {
        const next = Math.min(prev + 1, PROGRESS_MESSAGES.length - 1);
        setProgressPct(PROGRESS_PCTS[next]);
        return next;
      });
    }, 3000);

    return clearTimer;
  }, [generating, clearTimer]);

  function resolveMessage(idx: number, label: string): string {
    return PROGRESS_MESSAGES[idx].replace("{type}", label.toLowerCase());
  }

  async function run(spec: GenRowSpec) {
    setGenerating(spec.key);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch(`/api/generate/${spec.endpoint}/${jobId}`, { method: "POST" });
      const body = await res.json().catch(() => ({ ok: false, error: "bad response" }));
      if (!res.ok || !body.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      // Complete: fill bar to 100%
      clearTimer();
      setProgressPct(100);

      // Brief pause then show summary
      await new Promise((r) => setTimeout(r, 300));
      setGenerating(null);

      const summaryText =
        body.summary ??
        body.firstStrength ??
        `Your ${spec.label.toLowerCase()} is ready for review.`;
      setSummary({ key: spec.key, text: summaryText });

      router.refresh();
    } catch (e) {
      clearTimer();
      setGenerating(null);
      setError({ key: spec.key, msg: e instanceof Error ? e.message : String(e) });
    }
  }

  function docsFor(key: GenRowSpec["key"]): DocSummary[] {
    if (key === "cover-letter") return docs.filter((d) => d.kind === "cover");
    if (key === "cv") return docs.filter((d) => d.kind === "cv");
    if (key === "artifact") return docs.filter((d) => d.kind === "artifact");
    if (key === "interview-prep") return docs.filter((d) => d.kind === "interview-prep");
    return docs.filter((d) => d.kind === "screening");
  }

  return (
    <div className="gen-panel">
      <h2>Generate</h2>
      {ROWS.map((spec) => {
        const existing = docsFor(spec.key);
        const isGenerating = generating === spec.key;
        const hasSummary = summary !== null && summary.key === spec.key;
        const ready = existing.length > 0 || hasSummary;
        return (
          <div key={spec.key} className="gen-row">
            <div className="gen-row-head">
              <span className="gen-row-name">{spec.label}</span>
              <span className="gen-row-status" data-ready={ready}>
                {isGenerating
                  ? spec.loadingMsg
                  : ready
                    ? `${existing.length} version${existing.length !== 1 ? "s" : ""}`
                    : "Not yet"}
              </span>
            </div>
            <div className="gen-row-actions">
              <button
                className={`gen-btn${isGenerating ? " loading" : ""}`}
                onClick={() => run(spec)}
                disabled={isGenerating || generating !== null}
                aria-busy={isGenerating}
              >
                {ready ? "Regenerate" : "Generate"}
              </button>
              {existing.length > 0 && (
                <a className="gen-link" href={`/inbox/${jobId}/docs?doc=${spec.key === "cover-letter" ? "cover" : spec.key === "screening-qa" ? "screening" : spec.key === "interview-prep" ? "interview-prep" : spec.key}`}>
                  Review in app
                </a>
              )}
            </div>

            {/* Progress indicator */}
            {isGenerating && (
              <div className="gen-progress">
                <div className="gen-progress-msg">
                  <span className="gen-progress-dot" />
                  {resolveMessage(progressIdx, spec.label)}
                </div>
                <div className="gen-progress-bar">
                  <div
                    className="gen-progress-fill"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Completion summary */}
            {hasSummary && (
              <div className="gen-summary">
                <div className="gen-summary-label">
                  What&apos;s in your {spec.label.toLowerCase()}
                </div>
                <div className="gen-summary-text">{summary.text}</div>
                <div className="gen-summary-stats">
                  <span>&#10003; Quality passed</span>
                  <span>&middot;</span>
                  <span>&#10003; No AI tells</span>
                </div>
                <div className="gen-summary-actions">
                  <a
                    className="gen-link"
                    href={`/inbox/${jobId}/docs?doc=${spec.key === "cover-letter" ? "cover" : spec.key === "screening-qa" ? "screening" : spec.key === "interview-prep" ? "interview-prep" : spec.key}`}
                  >
                    Review
                  </a>
                  {existing.slice(-1).map((d) =>
                    d.url ? (
                      <a
                        key={`download-${d.kind}-${d.version}`}
                        className="gen-link"
                        href={d.url}
                        download
                      >
                        Download
                      </a>
                    ) : null,
                  )}
                </div>
              </div>
            )}

            {error && error.key === spec.key && (
              <div className="gen-error">Failed: {error.msg}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
