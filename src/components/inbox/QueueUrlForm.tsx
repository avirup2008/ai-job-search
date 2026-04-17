"use client";

import { useState } from "react";
import "./QueueUrlForm.css";

type Status =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export const LINKEDIN_MESSAGE =
  "LinkedIn requires login to view job listings. Please copy and paste the job description text directly instead of the URL.";

/**
 * Pure validation helper — exported so unit tests can exercise it without DOM.
 * Returns { ok: true } if the URL should proceed to POST, or { ok: false, error } otherwise.
 */
export function validateQueueUrl(raw: string): { ok: true } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Paste a job URL first." };
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: "URL must start with http:// or https://" };
  }
  if (trimmed.toLowerCase().includes("linkedin.com")) {
    return { ok: false, error: LINKEDIN_MESSAGE };
  }
  return { ok: true };
}

export function QueueUrlForm() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateQueueUrl(url);
    if (!validation.ok) {
      setStatus({ kind: "error", message: validation.error });
      return;
    }

    setStatus({ kind: "pending" });
    try {
      const res = await fetch("/api/queue-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json()) as
        | { ok: true; queued: true; jobId: string; alreadyQueued: boolean }
        | { ok: false; error: string };
      if (data.ok) {
        setStatus({
          kind: "success",
          message: data.alreadyQueued
            ? "This URL is already in the queue."
            : "Queued for tonight's run — tier and fit score will appear here tomorrow.",
        });
        setUrl("");
      } else {
        setStatus({ kind: "error", message: data.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setStatus({ kind: "error", message: msg });
    }
  }

  const busy = status.kind === "pending";

  return (
    <form className="queue-url-form" onSubmit={handleSubmit}>
      <div className="queue-url-row">
        <input
          id="queue-url-input"
          aria-label="Queue a job URL"
          className="queue-url-input"
          type="url"
          placeholder="https://... — queue a job for tonight"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="queue-url-submit" disabled={busy}>
          {busy ? "Queuing..." : "Queue for tonight"}
        </button>
      </div>
      {status.kind === "success" && (
        <div className="queue-url-msg queue-url-msg-success" role="status">
          {status.message}
        </div>
      )}
      {status.kind === "error" && (
        <div className="queue-url-msg queue-url-msg-error" role="alert">
          {status.message}
        </div>
      )}
    </form>
  );
}
