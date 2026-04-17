import { NextResponse } from "next/server";
import { loadCronEnv } from "@/lib/env";
import { generateWeeklyBrief } from "@/lib/analytics/weekly-brief";
import { db, schema } from "@/db";
import { sql } from "drizzle-orm";

// Fluid Compute runtime. 30s budget is plenty for a lightweight DB-only brief;
// no LLM calls, no external HTTP requests.
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const cronEnv = loadCronEnv();

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${cronEnv.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Day-of-week guard: only run on Mondays (UTC). Skips if GitHub Actions fires
  // slightly off-schedule, or if manually triggered on a non-Monday.
  const today = new Date();
  if (today.getUTCDay() !== 1) {
    return NextResponse.json({ ok: true, skipped: "not monday" });
  }

  try {
    const brief = await generateWeeklyBrief();
    console.log("[cron:weekly-brief]", JSON.stringify({ weekStarting: brief.weekStarting, callout: brief.callout }));

    await db.insert(schema.runs).values({
      status: "weekly-brief",
      endedAt: sql`now()`,
      stageMetrics: brief,
    });

    return NextResponse.json({ ok: true, brief });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron:weekly-brief] error", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
