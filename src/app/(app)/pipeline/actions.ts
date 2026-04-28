"use server";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { isAdmin } from "@/lib/auth/admin";
import { revalidatePath } from "next/cache";
import { PIPELINE_STAGES, type PipelineStage } from "./stages";
import { generateInterviewPrep } from "@/lib/generate/interview-prep";
import { storeInterviewPrep } from "@/lib/generate/storage";
import {
  applyOutcome,
  applyFlaggedOutcome,
  readMultipliersFromProfile,
  writeMultipliersToProfile,
  type FlagReason,
} from "@/lib/scoring/multipliers";

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
  // Flagging from pipeline should also clear the job from inbox
  if (status === "flagged") {
    revalidatePath("/inbox");
    revalidatePath(`/inbox/${app?.jobId ?? ""}`);
  }

  // R-79: outcome feedback hook — adjust scoring multipliers on terminal outcomes.
  if ((status === "rejected" || status === "interview" || status === "offer") && app) {
    try {
      const [jobRow] = await db
        .select({ seniority: schema.jobs.seniority, gapAnalysis: schema.jobs.gapAnalysis })
        .from(schema.jobs)
        .where(eq(schema.jobs.id, app.jobId))
        .limit(1);
      if (jobRow) {
        const ga = jobRow.gapAnalysis as { industries?: unknown } | null;
        const industries = Array.isArray(ga?.industries)
          ? (ga!.industries as unknown[]).filter((s): s is string => typeof s === "string")
          : [];
        const [profileRow] = await db
          .select({ id: schema.profile.id, preferences: schema.profile.preferences })
          .from(schema.profile)
          .limit(1);
        if (profileRow) {
          const current = readMultipliersFromProfile(profileRow.preferences);
          const next = applyOutcome(current, status, industries, jobRow.seniority ?? "");
          const updatedPrefs = writeMultipliersToProfile(profileRow.preferences, next);
          await db
            .update(schema.profile)
            .set({ preferences: updatedPrefs })
            .where(eq(schema.profile.id, profileRow.id));
        }
      }
    } catch (err) {
      console.error("[feedback-multiplier-hook]", err);
    }
  }

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
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${jobId}`);
}

export async function flagJobAsBadMatch(jobId: string, reason?: FlagReason) {
  if (!(await isAdmin())) throw new Error("forbidden");
  const existing = await db
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.jobId, jobId))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(schema.applications)
      .set({ status: "flagged", flagReason: reason ?? null, lastEventAt: new Date() })
      .where(eq(schema.applications.id, existing[0].id));
  } else {
    await db.insert(schema.applications).values({ jobId, status: "flagged", flagReason: reason ?? null });
  }

  // Feedback learning: adjust multipliers for content-quality reasons
  if (reason) {
    try {
      const [jobRow] = await db
        .select({ seniority: schema.jobs.seniority, gapAnalysis: schema.jobs.gapAnalysis })
        .from(schema.jobs)
        .where(eq(schema.jobs.id, jobId))
        .limit(1);
      if (jobRow) {
        const ga = jobRow.gapAnalysis as { industries?: unknown } | null;
        const industries = Array.isArray(ga?.industries)
          ? (ga!.industries as unknown[]).filter((s): s is string => typeof s === "string")
          : [];
        const [profileRow] = await db
          .select({ id: schema.profile.id, preferences: schema.profile.preferences })
          .from(schema.profile)
          .limit(1);
        if (profileRow) {
          const current = readMultipliersFromProfile(profileRow.preferences);
          const next = applyFlaggedOutcome(current, reason, industries, jobRow.seniority ?? "");
          const updatedPrefs = writeMultipliersToProfile(profileRow.preferences, next);
          await db
            .update(schema.profile)
            .set({ preferences: updatedPrefs })
            .where(eq(schema.profile.id, profileRow.id));
        }
      }
    } catch (err) {
      console.error("[flag-multiplier-hook]", err);
    }
  }

  revalidatePath("/pipeline");
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${jobId}`);
}

/**
 * Paste or replace the job description for a job that had missing/thin JD text.
 * Clears fitScore/tier/gap so the next rescore batch picks it up fresh.
 */
export async function patchJobJd(jobId: string, jdText: string) {
  if (!(await isAdmin())) throw new Error("forbidden");
  const trimmed = jdText.trim();
  if (!trimmed) throw new Error("jdText is empty");
  await db
    .update(schema.jobs)
    .set({
      jdText: trimmed,
      fitScore: null,
      tier: null,
      gapAnalysis: null,
      fitBreakdown: null,
    })
    .where(eq(schema.jobs.id, jobId));
  revalidatePath(`/inbox/${jobId}`);
  revalidatePath("/inbox");
}

export async function markAsExpired(jobId: string) {
  if (!(await isAdmin())) throw new Error("forbidden");
  const existing = await db
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.jobId, jobId))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(schema.applications)
      .set({ status: "expired", lastEventAt: new Date() })
      .where(eq(schema.applications.id, existing[0].id));
  } else {
    await db.insert(schema.applications).values({ jobId, status: "expired" });
  }
  revalidatePath("/pipeline");
  revalidatePath("/inbox");
  revalidatePath(`/inbox/${jobId}`);
}
