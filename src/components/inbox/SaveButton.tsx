"use client";

import { saveJobToPipeline, flagJobAsBadMatch, markAsExpired } from "@/app/(app)/pipeline/actions";
import { useTransition } from "react";

export function SaveButton({ jobId }: { jobId: string }) {
  const [isSavePending, startSaveTransition] = useTransition();
  const [isFlagPending, startFlagTransition] = useTransition();
  const [isExpiredPending, startExpiredTransition] = useTransition();

  const anyPending = isSavePending || isFlagPending || isExpiredPending;

  return (
    <div className="job-card-actions-col">
      <button
        className="job-card-save-btn"
        disabled={anyPending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startSaveTransition(() => saveJobToPipeline(jobId));
        }}
      >
        {isSavePending ? "Saving…" : "Save →"}
      </button>
      <div className="job-card-secondary-actions">
        <button
          className="job-card-ghost-btn"
          disabled={anyPending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startFlagTransition(() => flagJobAsBadMatch(jobId));
          }}
        >
          {isFlagPending ? "…" : "Not a fit"}
        </button>
        <span className="job-card-ghost-sep">·</span>
        <button
          className="job-card-ghost-btn"
          disabled={anyPending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startExpiredTransition(() => markAsExpired(jobId));
          }}
        >
          {isExpiredPending ? "…" : "Expired"}
        </button>
      </div>
    </div>
  );
}
