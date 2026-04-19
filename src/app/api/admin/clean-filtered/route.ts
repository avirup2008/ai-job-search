import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { db, schema } from "@/db";
import { isNotNull, sql } from "drizzle-orm";

export const runtime = "nodejs";

// Admin-only: remove tier/score from jobs that have a hard_filter_reason set.
// These were incorrectly scored by an earlier rescore pass that didn't respect filters.
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  try {
    const result = await db.execute(sql`
      UPDATE ${schema.jobs}
      SET tier = NULL,
          fit_score = NULL,
          fit_breakdown = NULL,
          gap_analysis = NULL
      WHERE hard_filter_reason IS NOT NULL
        AND tier IS NOT NULL
    `);
    const cleaned = (result as { rowCount?: number }).rowCount ?? 0;
    return NextResponse.json({ ok: true, cleaned });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
