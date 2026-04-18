"use client";

import { saveJobToPipeline, flagJobAsBadMatch, markAsExpired } from "@/app/(app)/pipeline/actions";
import { useTransition } from "react";

export function SaveButton({ jobId }: { jobId: string }) {
  const [isSavePending, startSaveTransition] = useTransition();
  const [isFlagPending, startFlagTransition] = useTransition();
  const [isExpiredPending, startExpiredTransition] = useTransition();

  const anyPending = isSavePending || isFlagPending || isExpiredPending;

  return (
    <div className="job-card-btn-stack">
      <button
        className="save-btn"
        disabled={anyPending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startSaveTransition(() => saveJobToPipeline(jobId));
        }}
      >
        {isSavePending ? "Saving…" : "Save →"}
      </button>
      <button
        className="flag-btn"
        disabled={anyPending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startFlagTransition(() => flagJobAsBadMatch(jobId));
        }}
      >
        {isFlagPending ? "Flagging…" : "Not a fit"}
      </button>
      <button
        className="expired-btn"
        disabled={anyPending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startExpiredTransition(() => markAsExpired(jobId));
        }}
      >
        {isExpiredPending ? "Removing…" : "No longer available"}
      </button>
    </div>
  );
}
