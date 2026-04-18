"use client";

import { saveJobToPipeline, flagJobAsBadMatch, markAsExpired } from "@/app/(app)/pipeline/actions";
import { useTransition } from "react";

export function SaveButton({ jobId }: { jobId: string }) {
  const [isSavePending, startSaveTransition] = useTransition();
  const [isFlagPending, startFlagTransition] = useTransition();
  const [isExpiredPending, startExpiredTransition] = useTransition();

  const anyPending = isSavePending || isFlagPending || isExpiredPending;

  return (
    <>
      <button
        className="save-btn"
        disabled={anyPending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startSaveTransition(() => saveJobToPipeline(jobId));
        }}
      >
        {isSavePending ? "Saving\u2026" : "Save \u2192"}
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
        {isFlagPending ? "Flagging\u2026" : "Not a fit"}
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
        {isExpiredPending ? "Removing\u2026" : "No longer available"}
      </button>
    </>
  );
}
