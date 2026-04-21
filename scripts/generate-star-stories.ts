// scripts/generate-star-stories.ts — one-shot STAR story generation.
// Reads profile from DB, calls Anthropic, saves stories back to DB.
// Run: source .env.local && npx tsx scripts/generate-star-stories.ts

import Anthropic from "@anthropic-ai/sdk";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const [row] = await db.select().from(schema.profile).limit(1);
  if (!row) throw new Error("No profile row found");

  type Role = { company: string; title: string; dates: string; achievements: string[] };
  type Achievement = { description?: string; metric?: string; context?: string; narrative?: string };

  const roles = (row.roles ?? []) as Role[];
  const achievements = (row.achievements ?? []) as Achievement[];

  const rolesText = roles
    .map(
      (r) =>
        `${r.company} — ${r.title} (${r.dates})\n${(r.achievements ?? []).map((a) => `• ${a}`).join("\n")}`,
    )
    .join("\n\n");

  const achievementsText = achievements
    .map((a) => {
      const parts = [a.metric ?? a.description ?? ""];
      if (a.context) parts.push(`Context: ${a.context}`);
      if (a.narrative) parts.push(a.narrative);
      return parts.filter(Boolean).join(" — ");
    })
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

  console.log("Calling Anthropic (claude-haiku-4-5-20251001)…");
  const client = new Anthropic();
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

  let stories: unknown[];
  try {
    stories = JSON.parse(cleaned);
    if (!Array.isArray(stories)) throw new Error("Not an array");
  } catch (e) {
    console.error("Failed to parse response:\n", text);
    throw e;
  }

  console.log(`\nGenerated ${stories.length} stories:`);
  for (const s of stories as Array<{ headline: string }>) {
    console.log(`  • ${s.headline}`);
  }

  await db
    .update(schema.profile)
    .set({ stories: stories as unknown, updatedAt: new Date() })
    .where(eq(schema.profile.id, row.id));

  console.log("\n✓ Stories saved to profile row");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
