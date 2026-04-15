import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { generateCV } from "@/lib/generate/cv";
import { renderCvDocx } from "@/lib/generate/cv-docx";
import { renderCvPdf } from "@/lib/generate/cv-pdf";
import { storeCv } from "@/lib/generate/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

interface Params { jobId: string }

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
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

    // Render DOCX and PDF in parallel
    const [docxBuffer, pdfBuffer] = await Promise.all([
      renderCvDocx(gen.cv),
      renderCvPdf(gen.cv),
    ]);

    // Store both blobs and insert documents row
    const doc = await storeCv({
      applicationId: app.id,
      docxBuffer,
      pdfBuffer,
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
