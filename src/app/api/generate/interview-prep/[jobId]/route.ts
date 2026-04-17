import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { generateInterviewPrep } from "@/lib/generate/interview-prep";
import { storeInterviewPrep, deleteInterviewPrep } from "@/lib/generate/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

interface Params { jobId: string }

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  const { jobId } = await ctx.params;
  try {
    const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1);
    if (!job) {
      return NextResponse.json({ ok: false, error: "job not found" }, { status: 404 });
    }
    let [app] = await db
      .select()
      .from(schema.applications)
      .where(eq(schema.applications.jobId, jobId))
      .limit(1);
    if (!app) {
      [app] = await db
        .insert(schema.applications)
        .values({ jobId, status: "new" })
        .returning();
    }

    // Delete old blob + row first so regenerate always starts clean
    await deleteInterviewPrep(app.id);

    const gen = await generateInterviewPrep(jobId);
    const doc = await storeInterviewPrep({
      applicationId: app.id,
      markdown: gen.markdown,
      tokenCostEur: gen.costEur,
      tier: job.tier ?? null,
    });

    return NextResponse.json({
      ok: true,
      document: doc,
      markdownPreview: gen.markdown.slice(0, 500),
      tokens: gen.tokens,
      costEur: gen.costEur,
      attempts: gen.attempts,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
