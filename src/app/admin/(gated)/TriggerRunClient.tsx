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
        label="Rescore all jobs (new weights / prompt)"
        runningLabel="Rescoring… (may take a minute)"
        endpoint="/api/admin/rescore-all"
        formatResult={(body) => {
          const b = body as { updated?: number; costEur?: number; ms?: number };
          return `Rescored ${b.updated ?? 0} jobs — €${(b.costEur ?? 0).toFixed(4)} — ${b.ms ?? 0}ms`;
        }}
      />
    </div>
  );
}
