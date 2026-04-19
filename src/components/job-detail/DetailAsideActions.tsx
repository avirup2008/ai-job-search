"use client";

import { useTransition } from "react";
import { saveJobToPipeline, flagJobAsBadMatch } from "@/app/(app)/pipeline/actions";

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

type Props = {
  jobId: string;
  sourceUrl: string;
  source: string;
  status: string | null;
};

export function DetailAsideActions({ jobId, sourceUrl, source, status }: Props) {
  const [isSavePending, startSaveTransition] = useTransition();
  const [isFlagPending, startFlagTransition] = useTransition();
  const anyPending = isSavePending || isFlagPending;

  const inPipeline = status != null && status !== "new";

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

      {/* Flag as not a fit — only when not already flagged/expired */}
      {status == null && (
        <button
          className="detail-aside-flag-btn"
          disabled={anyPending}
          onClick={() => startFlagTransition(() => flagJobAsBadMatch(jobId))}
        >
          {isFlagPending ? "…" : "Not a fit"}
        </button>
      )}
    </div>
  );
}
