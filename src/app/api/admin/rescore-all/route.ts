import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { rescoreMatchedJobs } from "@/lib/profile/rescore";

// Admin-only: rescore all tier 1/2/3 jobs against the current profile
// and current scoring weights. Use after changing WEIGHTS or the prompt.
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const start = Date.now();
  console.log("[rescore-all] triggered");
  try {
    const result = await rescoreMatchedJobs();
    const ms = Date.now() - start;
    console.log(`[rescore-all] done — updated=${result.updated} costEur=${result.costEur.toFixed(4)} ms=${ms}`);
    return NextResponse.json({ ok: true, ...result, ms });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[rescore-all] failed after ${Date.now() - start}ms: ${msg}`);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
