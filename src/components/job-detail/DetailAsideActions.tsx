"use client";

import { useState, useTransition } from "react";
import { saveJobToPipeline, flagJobAsBadMatch } from "@/app/(app)/pipeline/actions";
import type { FlagReason } from "@/lib/scoring/multipliers";

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  flagged: "Not a fit",
  expired: "Expired",
};

const STATUS_COLORS: Record<string, string> = {
  applied: "var(--accent)",
  screening: "#D4A84B",
  interview: "var(--accent)",
  offer: "var(--accent)",
  rejected: "var(--text-3)",
  flagged: "var(--text-3)",
  expired: "var(--text-3)",
};

const FLAG_REASON_LABELS: { value: FlagReason; label: string }[] = [
  { value: "distance",           label: "Too far / wrong location" },
  { value: "dutch_required",     label: "Dutch required" },
  { value: "european_language",  label: "European language required" },
  { value: "skill_mismatch",     label: "Wrong skill set" },
  { value: "seniority_mismatch", label: "Too senior / too junior" },
  { value: "other",              label: "Other" },
];

type Props = {
  jobId: string;
  sourceUrl: string;
  source: string;
  status: string | null;
};

export function DetailAsideActions({ jobId, sourceUrl, source, status }: Props) {
  const [isSavePending, startSaveTransition] = useTransition();
  const [isFlagPending, startFlagTransition] = useTransition();
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const anyPending = isSavePending || isFlagPending;

  const inPipeline = status != null && status !== "new";

  function confirmFlag(reason: FlagReason) {
    setShowReasonPicker(false);
    startFlagTransition(() => flagJobAsBadMatch(jobId, reason));
  }

  return (
    <div className="detail-aside-actions">
      {/* Apply CTA */}
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="detail-apply-aside-btn"
      >
        Apply on {source} ↗
      </a>

      {/* Pipeline status or save */}
      {inPipeline ? (
        <div className="detail-aside-status">
          <span className="detail-aside-status-dot" style={{ background: STATUS_COLORS[status!] ?? "var(--text-3)" }} />
          <span className="detail-aside-status-label">{STATUS_LABELS[status!] ?? status}</span>
        </div>
      ) : (
        <button
          className="detail-aside-save-btn"
          disabled={anyPending}
          onClick={() => startSaveTransition(() => saveJobToPipeline(jobId))}
        >
          {isSavePending ? "Saving…" : "Save to pipeline →"}
        </button>
      )}

      {/* Flag as not a fit — only when not already in pipeline */}
      {status == null && !showReasonPicker && (
        <button
          className="detail-aside-flag-btn"
          disabled={anyPending}
          onClick={() => setShowReasonPicker(true)}
        >
          {isFlagPending ? "…" : "Not a fit"}
        </button>
      )}

      {/* Inline reason picker */}
      {showReasonPicker && (
        <div className="detail-aside-reason-picker">
          <p className="detail-aside-reason-label">Why isn&rsquo;t this a fit?</p>
          <div className="detail-aside-reason-chips">
            {FLAG_REASON_LABELS.map(({ value, label }) => (
              <button
                key={value}
                className="detail-aside-reason-chip"
                disabled={isFlagPending}
                onClick={() => confirmFlag(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="detail-aside-reason-cancel"
            onClick={() => setShowReasonPicker(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
