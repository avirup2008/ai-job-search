import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";

export async function GET() {
  const [run] = await db
    .select({
      id: schema.runs.id,
      startedAt: schema.runs.startedAt,
      endedAt: schema.runs.endedAt,
      status: schema.runs.status,
      stageMetrics: schema.runs.stageMetrics,
      errorJson: schema.runs.errorJson,
    })
    .from(schema.runs)
    .orderBy(desc(schema.runs.startedAt))
    .limit(1);

  if (!run) {
    return NextResponse.json({ ok: false, error: "no runs yet" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, run });
}
