import { z } from "zod";
import { ArtifactHeaderSchema } from "./types";
import { loadArtifactContext, runAntiAiLoop } from "./base";

const ThirtySixtyNinetyBody = z.object({
  header: ArtifactHeaderSchema,
  premise: z.string().describe("2-3 sentence framing — what assumption underlies this plan"),
  phases: z.array(z.object({
    phase: z.enum(["0-30", "31-60", "61-90"]),
    theme: z.string().describe("One-line theme for the phase"),
    goals: z.array(z.string()).min(2).max(4).describe("2-4 outcome-oriented goals"),
    initiatives: z.array(z.object({
      name: z.string(),
      description: z.string().describe("2-3 sentences describing what and why"),
      successMetric: z.string().describe("Concrete metric that signals success"),
    })).min(2).max(4),
  })).length(3),
  openQuestions: z.array(z.string()).max(4).describe("Questions the candidate would want to answer in week 1 to sharpen this plan"),
});
export type ThirtySixtyNinetyStruct = z.infer<typeof ThirtySixtyNinetyBody>;

const SYSTEM = `You produce a 30-60-90 day plan as a proof-of-work artifact for a specific job application.

HARD RULES:
- Ground every initiative in the candidate's actual profile (tools they know, methods they have used). Never fabricate capabilities.
- Reference the specific company + role + what you know of their business from the dossier.
- Plans are hypotheses. Signal that with phrasing like "my starting hypothesis is" — not fake certainty.
- No fabricated metrics about the company. If unsure, frame a metric as a target, not a claim about their status quo.

ANTI-AI WRITING RULES (STRICT):
- ZERO em-dashes (—). Use commas, periods, colons, parentheses.
- ZERO negative parallelisms (not just X but Y / not only / not merely / more than just / rather than X-ing).
- ZERO "maps to / mapped to / mapping to" constructions.
- BANNED words: delve, pivotal, crucial, underscore, showcase, leverage, foster, tapestry, landscape (figurative), intricate, enduring, vibrant, robust, seamless, elevate, transformative, dynamic, at the intersection of, sits at the heart of, stands as, serves as, additionally, moreover, furthermore, ultimately, it is worth noting.
- Rule-of-three flourishes banned.

LENGTH AND SHAPE:
- Three phases: 0-30, 31-60, 61-90.
- Each phase has 2-4 initiatives. Each initiative has a name, 2-3 sentences of description, and a concrete success metric.
- Premise: 2-3 sentences.
- Open questions: 2-4, sharp enough that an interviewer would want to answer them.
- Header title: "{role}: 30-60-90 Day Plan".
- Subtitle: A short line grounding the plan in the company context.`;

function narrativeOf(d: ThirtySixtyNinetyStruct): string {
  const parts: string[] = [d.header.title, d.header.subtitle, d.premise];
  for (const p of d.phases) {
    parts.push(p.theme);
    parts.push(...p.goals);
    for (const i of p.initiatives) {
      parts.push(i.name, i.description, i.successMetric);
    }
  }
  parts.push(...d.openQuestions);
  return parts.join("\n");
}

export async function generateThirtySixtyNinety(jobId: string) {
  const ctx = await loadArtifactContext(jobId);
  const prompt = [
    `COMPANY: ${ctx.companyName}`,
    `ROLE: ${ctx.job.title}`,
    `JD:\n${(ctx.job.jdText ?? "").slice(0, 4000)}`,
    "",
    `===COMPANY_DOSSIER===`,
    `Product: ${ctx.dossier.productOneLiner}`,
    `Stage: ${ctx.dossier.stage} | Industry: ${ctx.dossier.industry}`,
    `Narrative: ${ctx.dossier.narrative}`,
    `===END_DOSSIER===`,
    "",
    `===CANDIDATE_PROFILE===`,
    ctx.profileText,
    `===END_PROFILE===`,
    "",
    `Produce a 30-60-90 day plan as structured output. Header authorName = candidate fullName from profile. Date = today ISO.`,
  ].join("\n");
  return runAntiAiLoop<ThirtySixtyNinetyStruct>({
    systemPrompt: SYSTEM,
    userPrompt: prompt,
    schema: ThirtySixtyNinetyBody,
    maxTokens: 3000,
    narrativeOf,
  });
}
