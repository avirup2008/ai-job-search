import { NextResponse } from "next/server";
import { loadCronEnv, loadRetentionEnv } from "@/lib/env";
import { purgeOldJobs } from "@/lib/retention/purge";
import { db, schema } from "@/db";
import { sql } from "drizzle-orm";

// Fluid Compute runtime. 60s budget is plenty for Disha's scale (single-user,
// low-hundreds of jobs); a full purge pass historically completes in <5s even
// in dry-run mode.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const cronEnv = loadCronEnv();
  const retentionEnv = loadRetentionEnv();

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${cronEnv.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Dry-run resolution: env TRUE forces dry-run regardless of query string (D-05).
  // Env FALSE allows the caller to opt into dry-run via ?dryRun=1.
  const url = new URL(req.url);
  const queryDryRun = url.searchParams.get("dryRun") === "1";
  const dryRun = retentionEnv.RETENTION_DRY_RUN === "true" ? true : queryDryRun;

  try {
    const result = await purgeOldJobs({ dryRun });
    // Structured single-line log — this is the whole point of the dry-run gate
    // on first deploy. Must be greppable from Vercel logs without a JSON parser.
    console.log("[cron:purge]", JSON.stringify(result));

    // Insert a runs row so the purge is observable via /api/admin/last-run.
    await db.insert(schema.runs).values({
      status: "purge",
      endedAt: sql`now()`,
      stageMetrics: {
        deletedJobs: (result as { deletedJobs?: number }).deletedJobs ?? 0,
        deletedDocuments: (result as { deletedDocuments?: number }).deletedDocuments ?? 0,
        ranAt: new Date().toISOString(),
        dryRun,
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron:purge] error", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
