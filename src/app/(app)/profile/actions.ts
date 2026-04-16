"use server";

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { rescoreMatchedJobs } from "@/lib/profile/rescore";

type ProfileRow = typeof schema.profile.$inferSelect;

async function loadRow(): Promise<ProfileRow> {
  const [row] = await db.select().from(schema.profile).limit(1);
  if (!row) throw new Error("no profile row found");
  return row;
}

function triggerRescore() {
  // Fire and forget — don't block the action. Log failures.
  rescoreMatchedJobs()
    .then((r) => {
      console.log(`[rescore] updated=${r.updated} costEur=${r.costEur.toFixed(4)}`);
      // Revalidate once the rescore finishes so the inbox reflects new tiers/scores.
      revalidatePath("/inbox");
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[rescore] failed: ${msg}`);
    });
}

export async function addTool(tool: string): Promise<void> {
  const trimmed = tool.trim();
  if (!trimmed) return;

  const row = await loadRow();
  const toolStack = { ...(row.toolStack as Record<string, string>) };
  if (toolStack[trimmed]) return; // already present
  toolStack[trimmed] = "proficient";

  await db.update(schema.profile).set({ toolStack, updatedAt: new Date() }).where(eq(schema.profile.id, row.id));
  revalidatePath("/profile");
  revalidatePath("/inbox");
  triggerRescore();
}

export async function removeTool(tool: string): Promise<void> {
  const row = await loadRow();
  const toolStack = { ...(row.toolStack as Record<string, string>) };
  if (!(tool in toolStack)) return;
  delete toolStack[tool];

  await db.update(schema.profile).set({ toolStack, updatedAt: new Date() }).where(eq(schema.profile.id, row.id));
  revalidatePath("/profile");
  revalidatePath("/inbox");
  triggerRescore();
}

export async function addAchievement(description: string, metric: string): Promise<void> {
  const desc = description.trim();
  const met = metric.trim();
  if (!desc) return;

  const row = await loadRow();
  const achievements = [...((row.achievements as unknown[]) ?? [])];
  achievements.push({ description: desc, metric: met || undefined });

  await db.update(schema.profile).set({ achievements, updatedAt: new Date() }).where(eq(schema.profile.id, row.id));
  revalidatePath("/profile");
  revalidatePath("/inbox");
  triggerRescore();
}

export async function removeAchievement(index: number): Promise<void> {
  const row = await loadRow();
  const achievements = [...((row.achievements as unknown[]) ?? [])];
  if (index < 0 || index >= achievements.length) return;
  achievements.splice(index, 1);

  await db.update(schema.profile).set({ achievements, updatedAt: new Date() }).where(eq(schema.profile.id, row.id));
  revalidatePath("/profile");
  revalidatePath("/inbox");
  triggerRescore();
}

export async function updatePreferences(
  prefs: Partial<{
    salaryFloorEur: number;
    commuteMaxMinutes: number;
    workModes: string[];
  }>,
): Promise<void> {

  const row = await loadRow();
  const preferences = { ...((row.preferences as Record<string, unknown>) ?? {}) };
  const constraints = { ...((row.constraints as Record<string, unknown>) ?? {}) };

  if (prefs.salaryFloorEur !== undefined) {
    preferences.salaryFloorEur = prefs.salaryFloorEur;
  }
  if (prefs.workModes !== undefined) {
    preferences.workModes = prefs.workModes;
  }
  if (prefs.commuteMaxMinutes !== undefined) {
    constraints.commuteMaxMinutesCar = prefs.commuteMaxMinutes;
    constraints.commuteMaxMinutesTrain = prefs.commuteMaxMinutes;
  }

  await db
    .update(schema.profile)
    .set({ preferences, constraints, updatedAt: new Date() })
    .where(eq(schema.profile.id, row.id));
  revalidatePath("/profile");
  revalidatePath("/inbox");
  triggerRescore();
}
