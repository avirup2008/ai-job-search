"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import "./paste-role.css";

type PanelState = "input" | "scoring" | "result" | "saved";

interface PasteResult {
  jobId: string;
  title: string;
  companyName: string;
  fitScore: number;
  strengths: string[];
  gaps: string[];
}

const SCORING_STEPS = [
  { msg: "Reading the role...", duration: 2000, progress: 40 },
  { msg: "Scoring against your profile...", duration: 3000, progress: 85 },
];

export function PasteRolePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  const [state, setState] = useState<PanelState>("input");
  const [text, setText] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [scoringStep, setScoringStep] = useState(0);
  const [result, setResult] = useState<PasteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* Reset when panel closes */
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setState("input");
        setText("");
        setCompanyName("");
        setRoleTitle("");
        setScoringStep(0);
        setResult(null);
        setError(null);
      }, 300); // wait for slide-out animation
      return () => clearTimeout(t);
    }
    // Focus textarea when opening
    const t = setTimeout(() => textareaRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [open]);

  /* Escape key handler */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* Scoring step cycling */
  useEffect(() => {
    if (state !== "scoring") return;
    if (scoringStep >= SCORING_STEPS.length) return;

    const timer = setTimeout(() => {
      setScoringStep((s) => s + 1);
    }, SCORING_STEPS[scoringStep].duration);

    return () => clearTimeout(timer);
  }, [state, scoringStep]);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return;
    setError(null);
    setState("scoring");
    setScoringStep(0);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/paste-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          companyName: companyName.trim() || undefined,
          roleTitle: roleTitle.trim() || undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setResult({
        jobId: data.jobId,
        title: data.title,
        companyName: data.companyName,
        fitScore: data.fitScore,
        strengths: data.strengths ?? [],
        gaps: data.gaps ?? [],
      });
      setState("result");
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("input");
    }
  }, [text, companyName, roleTitle]);

  const handleSave = useCallback(async () => {
    if (!result) return;
    // The API already saved it; transition to saved state
    setState("saved");
  }, [result]);

  const handleOpenRole = useCallback(() => {
    if (!result) return;
    router.push(`/inbox/${result.jobId}`);
    onClose();
  }, [result, router, onClose]);

  const handlePasteAnother = useCallback(() => {
    setState("input");
    setText("");
    setCompanyName("");
    setRoleTitle("");
    setScoringStep(0);
    setResult(null);
    setError(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const currentStep =
    scoringStep < SCORING_STEPS.length
      ? SCORING_STEPS[scoringStep]
      : SCORING_STEPS[SCORING_STEPS.length - 1];

  return (
    <>
      {/* Overlay */}
      <div
        className={`paste-overlay${open ? " open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`paste-panel${open ? " open" : ""}`}
        role="dialog"
        aria-label="Paste a role"
        aria-modal="true"
      >
        <div className="paste-header">
          <span className="paste-title">Paste a role</span>
          <button
            className="paste-close"
            onClick={onClose}
            aria-label="Close panel"
          >
            &times;
          </button>
        </div>

        <div className="paste-body">
          {/* ── Input state ── */}
          {state === "input" && (
            <>
              <textarea
                ref={textareaRef}
                className="paste-textarea"
                placeholder="Paste a LinkedIn URL or copy the full JD text here"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="paste-fields">
                <div className="paste-field-group">
                  <label className="paste-field-label">Company name</label>
                  <input
                    className="paste-field-input"
                    placeholder="Optional"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="paste-field-group">
                  <label className="paste-field-label">Role title</label>
                  <input
                    className="paste-field-input"
                    placeholder="Optional"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                  />
                </div>
              </div>
              <button
                className="paste-submit"
                onClick={handleSubmit}
                disabled={!text.trim()}
              >
                Score this role &rarr;
              </button>
              {error && (
                <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>
              )}
              <p className="paste-hint">
                Paste a URL or the full job description text
              </p>
            </>
          )}

          {/* ── Scoring state ── */}
          {state === "scoring" && (
            <div className="paste-scoring">
              <p className="paste-scoring-msg">{currentStep.msg}</p>
              <div className="paste-progress-track">
                <div
                  className="paste-progress-bar"
                  style={{ width: `${currentStep.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Result state ── */}
          {state === "result" && result && (
            <>
              <p className="paste-result-company">{result.companyName}</p>
              <h2 className="paste-result-title">{result.title}</h2>
              <div className="paste-score-row">
                <span className="paste-result-score">{result.fitScore}</span>
                <span className="paste-result-pct">match score</span>
              </div>

              {result.strengths.length > 0 && (
                <div className="paste-fit-callout">
                  <p className="paste-fit-heading">Why this fits you</p>
                  <ul className="paste-fit-list">
                    {result.strengths.slice(0, 2).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.gaps.length > 0 && (
                <>
                  <p className="paste-gaps-heading">Gaps</p>
                  <ul className="paste-gaps-list">
                    {result.gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </>
              )}

              <div className="paste-actions">
                <button className="paste-btn-primary" onClick={handleSave}>
                  Save to pipeline &rarr;
                </button>
                <button className="paste-btn-ghost" onClick={onClose}>
                  Close
                </button>
              </div>
            </>
          )}

          {/* ── Saved state ── */}
          {state === "saved" && result && (
            <div className="paste-saved">
              <div className="paste-saved-check" aria-hidden="true">
                &#10003;
              </div>
              <p className="paste-saved-title">Saved to pipeline</p>
              <p className="paste-saved-detail">
                {result.title} &middot; {result.companyName}
              </p>
              <div className="paste-saved-links">
                <button
                  className="paste-saved-link paste-saved-link-primary"
                  onClick={handleOpenRole}
                >
                  Open role &amp; generate docs &rarr;
                </button>
                <button
                  className="paste-saved-link paste-saved-link-secondary"
                  onClick={handlePasteAnother}
                >
                  Paste another role
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
