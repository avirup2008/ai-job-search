import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { generateScreeningQA } from "@/lib/generate/screening-qa";
import { storeScreeningQA } from "@/lib/generate/storage";

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

    const gen = await generateScreeningQA(jobId);
    const doc = await storeScreeningQA({
      applicationId: app.id,
      markdown: gen.markdown,
      tokenCostEur: gen.costEur,
      tier: job.tier ?? null,
    });

    return NextResponse.json({
      ok: true,
      document: doc,
      pickedQuestions: gen.pickedQuestions,
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
