import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { pickArtifacts, generateArtifact } from "@/lib/generate/artifacts";
import { storeArtifact } from "@/lib/generate/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  try {
    const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1);
    if (!job) return NextResponse.json({ ok: false, error: "job not found" }, { status: 404 });
    let [app] = await db.select().from(schema.applications).where(eq(schema.applications.jobId, jobId)).limit(1);
    if (!app) [app] = await db.insert(schema.applications).values({ jobId, status: "new" }).returning();

    const picker = await pickArtifacts({ jobTitle: job.title, jdText: job.jdText ?? "" });
    const primary = await generateArtifact(jobId, picker.primary);
    const storedPrimary = await storeArtifact({
      applicationId: app.id,
      artifactType: picker.primary,
      html: primary.html,
      tokenCostEur: primary.costEur,
      tier: job.tier ?? null,
    });

    let secondaryInfo: { type: string; htmlUrl: string; publicSlug: string } | null = null;
    if (picker.secondary) {
      const sec = await generateArtifact(jobId, picker.secondary);
      const storedSec = await storeArtifact({
        applicationId: app.id,
        artifactType: picker.secondary,
        html: sec.html,
        tokenCostEur: sec.costEur,
        tier: job.tier ?? null,
      });
      secondaryInfo = { type: picker.secondary, htmlUrl: storedSec.htmlUrl, publicSlug: storedSec.publicSlug };
    }

    return NextResponse.json({
      ok: true,
      picker,
      primary: { type: picker.primary, ...storedPrimary, attempts: primary.attempts, costEur: primary.costEur },
      secondary: secondaryInfo,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
