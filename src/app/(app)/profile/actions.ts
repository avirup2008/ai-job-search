"use server";

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { rescoreMatchedJobs } from "@/lib/profile/rescore";
import Anthropic from "@anthropic-ai/sdk";

type ProfileRow = typeof schema.profile.$inferSelect;

async function loadRow(): Promise<ProfileRow> {
  const [row] = await db.select().from(schema.profile).limit(1);
  if (!row) throw new Error("no profile row found");
  return row;
}

async function triggerRescore() {
  try {
    const r = await rescoreMatchedJobs();
    console.log(`[rescore] updated=${r.updated} costEur=${r.costEur.toFixed(4)}`);
    revalidatePath("/inbox");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[rescore] failed: ${msg}`);
  }
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
  await triggerRescore();
}

export async function removeTool(tool: string): Promise<void> {
  const row = await loadRow();
  const toolStack = { ...(row.toolStack as Record<string, string>) };
  if (!(tool in toolStack)) return;
  delete toolStack[tool];

  await db.update(schema.profile).set({ toolStack, updatedAt: new Date() }).where(eq(schema.profile.id, row.id));
  revalidatePath("/profile");
  revalidatePath("/inbox");
  await triggerRescore();
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
  await triggerRescore();
}

export async function removeAchievement(index: number): Promise<void> {
  const row = await loadRow();
  const achievements = [...((row.achievements as unknown[]) ?? [])];
  if (index < 0 || index >= achievements.length) return;
  achievements.splice(index, 1);

  await db.update(schema.profile).set({ achievements, updatedAt: new Date() }).where(eq(schema.profile.id, row.id));
  revalidatePath("/profile");
  revalidatePath("/inbox");
  await triggerRescore();
}

export async function generateStarStories(): Promise<void> {
  const row = await loadRow();

  const roles = (row.roles ?? []) as Array<{ company: string; title: string; dates: string; achievements: string[] }>;
  const achievements = (row.achievements ?? []) as Array<{ description: string; metric?: string; context?: string }>;

  const client = new Anthropic();

  const rolesText = roles
    .map((r) => `${r.company} — ${r.title} (${r.dates})\n${(r.achievements ?? []).map((a) => `• ${a}`).join("\n")}`)
    .join("\n\n");

  const achievementsText = achievements
    .map((a) => `${a.description}${a.metric ? ` (${a.metric})` : ""}${a.context ? ` — ${a.context}` : ""}`)
    .join("\n");

  const prompt = `You are helping a job seeker prepare interview answers using the STAR method (Situation, Task, Action, Result).

Based on this person's career history, generate exactly 4 compelling STAR stories they can use in interviews. Choose the 4 most impressive, specific, and results-driven stories from their experience.

CAREER HISTORY:
${rolesText}

KEY ACHIEVEMENTS:
${achievementsText}

Return a JSON array of exactly 4 objects with this structure:
[
  {
    "headline": "One punchy sentence summarising the result (max 12 words)",
    "situation": "1-2 sentences: what was the context and challenge",
    "task": "1 sentence: what was your specific responsibility",
    "action": "2-3 sentences: exactly what you did, be specific",
    "result": "1-2 sentences: quantified outcome with numbers where possible"
  }
]

Rules:
- headline must lead with the result/number (e.g. "Cut CPL to €1.29 on Meta Ads generating 212 leads")
- Use first person ("I built", "I led")
- Be specific — name tools, percentages, timelines
- Do not invent numbers not in the source data
- Return ONLY valid JSON, no markdown fences`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "[]";
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const stories = JSON.parse(cleaned);

  await db.update(schema.profile).set({ stories, updatedAt: new Date() }).where(eq(schema.profile.id, row.id));
  revalidatePath("/profile");
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
  await triggerRescore();
}
