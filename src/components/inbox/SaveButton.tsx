"use client";

import { saveJobToPipeline, flagJobAsBadMatch } from "@/app/(app)/pipeline/actions";
import { useTransition } from "react";

export function SaveButton({ jobId }: { jobId: string }) {
  const [isSavePending, startSaveTransition] = useTransition();
  const [isFlagPending, startFlagTransition] = useTransition();

  return (
    <>
      <button
        className="save-btn"
        disabled={isSavePending || isFlagPending}
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
        disabled={isSavePending || isFlagPending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startFlagTransition(() => flagJobAsBadMatch(jobId));
        }}
      >
        {isFlagPending ? "Flagging\u2026" : "Not a fit"}
      </button>
    </>
  );
}
