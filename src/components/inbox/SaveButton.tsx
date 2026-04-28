"use client";

import { useState, useTransition } from "react";
import { saveJobToPipeline, flagJobAsBadMatch, markAsExpired } from "@/app/(app)/pipeline/actions";
import type { FlagReason } from "@/lib/scoring/multipliers";

const FLAG_REASON_LABELS: { value: FlagReason; label: string }[] = [
  { value: "distance",           label: "Too far / wrong location" },
  { value: "dutch_required",     label: "Dutch required" },
  { value: "european_language",  label: "European language required" },
  { value: "skill_mismatch",     label: "Wrong skill set" },
  { value: "seniority_mismatch", label: "Too senior / too junior" },
  { value: "other",              label: "Other" },
];

export function SaveButton({ jobId }: { jobId: string }) {
  const [isSavePending, startSaveTransition] = useTransition();
  const [isFlagPending, startFlagTransition] = useTransition();
  const [isExpiredPending, startExpiredTransition] = useTransition();
  const [showReasonPicker, setShowReasonPicker] = useState(false);

  const anyPending = isSavePending || isFlagPending || isExpiredPending;

  function confirmFlag(reason: FlagReason) {
    setShowReasonPicker(false);
    startFlagTransition(() => flagJobAsBadMatch(jobId, reason));
  }

  if (showReasonPicker) {
    return (
      <div className="flag-reason-picker" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <p className="flag-reason-label">Why isn&rsquo;t this a fit?</p>
        <div className="flag-reason-chips">
          {FLAG_REASON_LABELS.map(({ value, label }) => (
            <button
              key={value}
              className="flag-reason-chip"
              disabled={isFlagPending}
              onClick={() => confirmFlag(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="flag-reason-cancel"
          onClick={() => setShowReasonPicker(false)}
        >
          Cancel
        </button>
      </div>
    );
  }

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
          setShowReasonPicker(true);
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
