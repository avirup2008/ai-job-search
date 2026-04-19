"use client";
import { useState } from "react";

function ActionButton({
  label,
  runningLabel,
  endpoint,
  formatResult,
}: {
  label: string;
  runningLabel: string;
  endpoint: string;
  formatResult: (body: unknown) => string;
}) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setState("running");
    setMsg(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        setState("done");
        setMsg(formatResult(body));
      } else {
        setState("error");
        setMsg(`Error ${res.status}: ${(body as { error?: string }).error ?? "unknown"}`);
      }
    } catch (e) {
      setState("error");
      setMsg(String(e));
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={run}
        disabled={state === "running"}
        style={{
          padding: "8px 16px",
          fontSize: 14,
          cursor: state === "running" ? "wait" : "pointer",
          background: state === "error" ? "#fcc" : state === "done" ? "#cfc" : "#eee",
          border: "1px solid #999",
          borderRadius: 4,
        }}
      >
        {state === "running" ? runningLabel : label}
      </button>
      {msg && <div style={{ marginTop: 6, fontSize: 12, fontFamily: "monospace" }}>{msg}</div>}
    </div>
  );
}

export default function TriggerRunClient() {
  return (
    <div>
      <ActionButton
        label="Trigger nightly run now"
        runningLabel="Running… (may take up to 5 min)"
        endpoint="/api/admin/trigger-run"
        formatResult={(body) =>
          `Done — ${JSON.stringify(((body as { summary?: { counts?: unknown } }).summary)?.counts ?? {})}`
        }
      />
      <ActionButton
        label="Clean filtered jobs from inbox"
        runningLabel="Cleaning…"
        endpoint="/api/admin/clean-filtered"
        formatResult={(body) => {
          const b = body as { cleaned?: number };
          return `Removed tier from ${b.cleaned ?? 0} filtered jobs ✓`;
        }}
      />
      <ActionButton
        label="Rescore next 12 jobs"
        runningLabel="Rescoring batch… (~30s)"
        endpoint="/api/admin/rescore-all"
        formatResult={(body) => {
          const b = body as { updated?: number; costEur?: number; ms?: number; profileFound?: boolean; jobCount?: number; remaining?: number; totalEligible?: number; firstError?: string };
          if (b.profileFound === false) return `No profile found in DB — nothing to rescore`;
          if (b.jobCount === 0) return `All ${b.totalEligible ?? 0} eligible jobs already scored ✓`;
          if (b.firstError) return `ERROR: ${b.firstError}`;
          const rem = b.remaining ?? 0;
          const secs = ((b.ms ?? 0) / 1000).toFixed(1);
          const progress = `${(b.totalEligible ?? 0) - rem} / ${b.totalEligible ?? "?"} scored`;
          const suffix = rem > 0 ? ` — ${rem} remaining, click again` : ` — all done ✓`;
          return `Batch: ${b.updated ?? 0} scored — €${(b.costEur ?? 0).toFixed(4)} — ${secs}s — ${progress}${suffix}`;
        }}
      />
    </div>
  );
}
