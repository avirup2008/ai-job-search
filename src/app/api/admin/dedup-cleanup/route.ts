import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { isAdmin } from "@/lib/auth/admin";
import { sql, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find dedupeHashes that appear more than once
  const dupes = await db.execute(sql`
    SELECT dedupe_hash, COUNT(*) as cnt
    FROM jobs
    WHERE dedupe_hash IS NOT NULL
    GROUP BY dedupe_hash
    HAVING COUNT(*) > 1
  `);

  let deleted = 0;

  for (const row of dupes.rows as { dedupe_hash: string; cnt: string }[]) {
    const hash = row.dedupe_hash;

    // Get all jobs with this hash, ordered by jdText length desc (keep the best)
    const jobs = await db.execute(sql`
      SELECT id, LENGTH(jd_text) as jd_len
      FROM jobs
      WHERE dedupe_hash = ${hash}
      ORDER BY LENGTH(jd_text) DESC
    `);

    const rows = jobs.rows as { id: string; jd_len: number }[];
    const toDelete = rows.slice(1).map((r) => r.id); // keep first (longest jdText)

    for (const id of toDelete) {
      // Delete applications first (FK constraint)
      await db.delete(schema.applications).where(eq(schema.applications.jobId, id));
      await db.delete(schema.jobs).where(eq(schema.jobs.id, id));
      deleted++;
    }
  }

  return NextResponse.json({ ok: true, deleted, duplicateGroups: dupes.rows.length });
}
