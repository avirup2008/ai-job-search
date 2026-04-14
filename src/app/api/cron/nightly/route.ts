import { NextResponse } from "next/server";
import { runNightly } from "@/lib/pipeline/orchestrator";
import { loadCronEnv } from "@/lib/env";

// Fluid Compute — allows up to 300s on Hobby. Orchestrator is idempotent,
// so getting killed at 300s is fine — next cron tick picks up where we
// left off. Work window runs this route every 15 min for 6 hours.
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const env = loadCronEnv();
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runNightly();
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
