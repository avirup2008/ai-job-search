import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { generateCV } from "@/lib/generate/cv";
import { renderCvDocx } from "@/lib/generate/cv-docx";
import { storeCv } from "@/lib/generate/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

interface Params { jobId: string }

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  }
  const { jobId } = await ctx.params;
  try {
    // Ensure application row exists for this job
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

    // Generate structured CV via Sonnet
    const gen = await generateCV(jobId);

    // Render DOCX (PDF deferred to Phase 9 UI — client-side print or future pdfkit migration)
    const docxBuffer = await renderCvDocx(gen.cv);

    const doc = await storeCv({
      applicationId: app.id,
      docxBuffer,
      tokenCostEur: gen.costEur,
      tier: job.tier ?? null,
    });

    return NextResponse.json({
      ok: true,
      document: doc,
      tokens: gen.tokens,
      costEur: gen.costEur,
      attempts: gen.attempts,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
