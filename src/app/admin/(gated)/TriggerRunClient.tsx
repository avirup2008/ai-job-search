"use client";
import { useState } from "react";

export default function TriggerRunClient() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setState("running");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/trigger-run", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        setState("done");
        setMsg(`Done — ${JSON.stringify((body.summary as { counts?: unknown })?.counts ?? {})}`);
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
    <div>
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
        {state === "running" ? "Running… (may take up to 5 min)" : "Trigger nightly run now"}
      </button>
      {msg && <div style={{ marginTop: 8, fontSize: 12, fontFamily: "monospace" }}>{msg}</div>}
    </div>
  );
}
