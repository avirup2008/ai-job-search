import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

// Public health endpoint. No auth (it's a status probe). Pings the DB
// to ensure the full read path works.
export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await db.execute(sql`SELECT 1 as ok`);
    const dbOk = Array.isArray(rows) ? rows.length > 0 : ((rows as { rowCount?: number }).rowCount ?? 0) > 0;
    return NextResponse.json({ ok: dbOk, ts: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg, ts: new Date().toISOString() }, { status: 500 });
  }
}
