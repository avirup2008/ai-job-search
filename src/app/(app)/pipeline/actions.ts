"use server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/auth/admin";
import { revalidatePath } from "next/cache";
import { PIPELINE_STAGES, type PipelineStage } from "./stages";

export async function updateApplicationStatus(applicationId: string, status: PipelineStage) {
  if (!(await isAdmin())) throw new Error("forbidden");
  if (!PIPELINE_STAGES.includes(status)) throw new Error("invalid stage");
  await db
    .update(schema.applications)
    .set({
      status,
      lastEventAt: new Date(),
      appliedAt: status === "applied" ? new Date() : undefined,
    })
    .where(eq(schema.applications.id, applicationId));
  revalidatePath("/pipeline");
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
