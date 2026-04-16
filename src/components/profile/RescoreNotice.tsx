"use client";

import { useEffect } from "react";

interface RescoreNoticeProps {
  onDismiss: () => void;
  durationMs?: number;
}

export function RescoreNotice({ onDismiss, durationMs = 3000 }: RescoreNoticeProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [onDismiss, durationMs]);

  return (
    <div
      className="profile-rescore-notice"
      role="status"
      aria-live="polite"
      onClick={onDismiss}
    >
      <span className="profile-rescore-dot" aria-hidden="true" />
      Updating your match scores…
    </div>
  );
}
