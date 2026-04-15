import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { generateArtifact, type ArtifactType } from "@/lib/generate/artifacts";
import { storeArtifact } from "@/lib/generate/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const VALID_TYPES: ArtifactType[] = ["thirty_sixty_ninety", "email_crm_teardown"];

export async function POST(_req: Request, ctx: { params: Promise<{ jobId: string; type: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const { jobId, type } = await ctx.params;
  if (!VALID_TYPES.includes(type as ArtifactType)) {
    return NextResponse.json({ ok: false, error: `unsupported artifact type: ${type}` }, { status: 400 });
  }
  try {
    const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1);
    if (!job) return NextResponse.json({ ok: false, error: "job not found" }, { status: 404 });
    let [app] = await db.select().from(schema.applications).where(eq(schema.applications.jobId, jobId)).limit(1);
    if (!app) [app] = await db.insert(schema.applications).values({ jobId, status: "new" }).returning();

    const art = await generateArtifact(jobId, type as ArtifactType);
    const stored = await storeArtifact({
      applicationId: app.id,
      artifactType: type,
      html: art.html,
      tokenCostEur: art.costEur,
      tier: job.tier ?? null,
    });
    return NextResponse.json({ ok: true, type, ...stored, attempts: art.attempts, costEur: art.costEur });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
