"use server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { isAdmin } from "@/lib/auth/admin";
import { revalidatePath } from "next/cache";
import { PIPELINE_STAGES, type PipelineStage } from "./stages";
import { generateInterviewPrep } from "@/lib/generate/interview-prep";
import { storeInterviewPrep } from "@/lib/generate/storage";

export async function updateApplicationStatus(applicationId: string, status: PipelineStage) {
  if (!(await isAdmin())) throw new Error("forbidden");
  if (!PIPELINE_STAGES.includes(status)) throw new Error("invalid stage");

  // Fetch the application row so we have jobId for the auto-trigger
  const [app] = await db
    .select({ jobId: schema.applications.jobId })
    .from(schema.applications)
    .where(eq(schema.applications.id, applicationId))
    .limit(1);

  await db
    .update(schema.applications)
    .set({
      status,
      lastEventAt: new Date(),
      appliedAt: status === "applied" ? new Date() : undefined,
    })
    .where(eq(schema.applications.id, applicationId));

  revalidatePath("/pipeline");

  // Auto-generate interview prep when moving to "interview" stage
  if (status === "interview" && app) {
    // Check whether a prep doc already exists — skip if it does
    const existing = await db
      .select({ id: schema.documents.id })
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.applicationId, applicationId),
          eq(schema.documents.kind, "interview-prep"),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      // Fetch tier for cost tracking (null is acceptable)
      const [job] = await db
        .select({ tier: schema.jobs.tier })
        .from(schema.jobs)
        .where(eq(schema.jobs.id, app.jobId))
        .limit(1);

      void (async () => {
        try {
          const gen = await generateInterviewPrep(app.jobId);
          await storeInterviewPrep({
            applicationId,
            markdown: gen.markdown,
            tokenCostEur: gen.costEur,
            tier: job?.tier ?? null,
          });
          console.log(`[interview-prep-autogen] done for applicationId=${applicationId}`);
        } catch (err) {
          console.error("[interview-prep-autogen]", err);
        }
      })();
    }
  }
}

export async function saveJobToPipeline(jobId: string) {
  if (!(await isAdmin())) throw new Error("forbidden");
  const existing = await db
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.jobId, jobId))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(schema.applications)
      .set({ status: "saved", lastEventAt: new Date() })
      .where(eq(schema.applications.id, existing[0].id));
  } else {
    await db.insert(schema.applications).values({ jobId, status: "saved" });
  }
  revalidatePath("/pipeline");
  revalidatePath(`/inbox/${jobId}`);
}
