import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { generateCoverLetter } from "@/lib/generate/cover-letter";
import { storeCoverLetter } from "@/lib/generate/storage";

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

    // Generate + store
    const gen = await generateCoverLetter({ jobId });
    const doc = await storeCoverLetter({
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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
