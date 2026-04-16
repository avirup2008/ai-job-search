"use client";

import { saveJobToPipeline } from "@/app/(app)/pipeline/actions";
import { useTransition } from "react";

export function SaveButton({ jobId }: { jobId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className="save-btn"
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(() => saveJobToPipeline(jobId));
      }}
    >
      {isPending ? "Saving\u2026" : "Save \u2192"}
    </button>
  );
}
