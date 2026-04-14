import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { runNightly } from "@/lib/pipeline/orchestrator";

// Admin-authenticated manual trigger. Same 300s cap; multiple clicks
// (or clicks spaced by >300s) converge the pipeline faster than waiting
// for the next cron tick.
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  try {
    const summary = await runNightly();
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
