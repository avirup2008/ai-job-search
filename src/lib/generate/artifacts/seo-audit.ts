import { z } from "zod";
import { ArtifactHeaderSchema } from "./types";
import { loadArtifactContext, runAntiAiLoop } from "./base";

const SeoAuditBody = z.object({
  header: ArtifactHeaderSchema,
  premise: z.string().describe("2-3 sentences framing the audit"),
  findings: z.array(z.object({
    area: z.enum(["technical", "on-page", "content", "authority", "local", "international"]),
    observation: z.string().describe("What was observed or inferred (hypothesis, not claim)"),
    impact: z.string().describe("Why this matters for organic performance"),
    recommendation: z.string().describe("Concrete fix or improvement"),
  })).min(3).max(6),
  quickWins: z.array(z.string()).min(2).max(4).describe("2-4 specific changes prototypable in week 1"),
  caveats: z.array(z.string()).max(3).describe("Assumptions behind this audit"),
});
export type SeoAuditStruct = z.infer<typeof SeoAuditBody>;

const SYSTEM = `You produce a concise mini SEO audit as a proof-of-work artifact for a specific job application.

HARD RULES:
- This is a hypothesis document. Do not fabricate rankings, traffic numbers, or backlink counts unless they come from the dossier. Phrase inferences as hypotheses ("my read is", "assuming", "without running a full crawl").
- Ground recommendations in the candidate's real toolbox (SEMrush, Ahrefs, Screaming Frog, GSC etc.). Do not invent expertise.
- Reference the specific company + role + dossier signals.
- Be specific where possible, honest about uncertainty where not.

ANTI-AI WRITING RULES (STRICT):
- ZERO em-dashes (—). Use commas, periods, colons, parentheses.
- ZERO negative parallelisms (not just X but Y / not only / not merely / more than just / rather than X-ing).
- ZERO "maps to / mapped to / mapping to" constructions.
- BANNED words: delve, pivotal, crucial, underscore, showcase, leverage, foster, tapestry, landscape (figurative), intricate, enduring, vibrant, robust, seamless, elevate, transformative, dynamic, at the intersection of, sits at the heart of, stands as, serves as, additionally, moreover, furthermore, ultimately, it is worth noting.
- Rule-of-three flourishes banned.

SHAPE:
- 3-6 findings, each with {area, observation, impact, recommendation}.
- Premise: 2-3 sentences.
- 2-4 quickWins.
- Up to 3 caveats.
- Header title: "{role}: SEO Mini-Audit".`;

function narrativeOf(d: SeoAuditStruct): string {
  const parts: string[] = [d.header.title, d.header.subtitle, d.premise];
  for (const f of d.findings) parts.push(f.observation, f.impact, f.recommendation);
  parts.push(...d.quickWins);
  parts.push(...d.caveats);
  return parts.join("\n");
}

export async function generateSeoAudit(jobId: string) {
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
    `Produce a structured mini SEO audit. Header authorName = candidate fullName. Date = today ISO.`,
  ].join("\n");
  return runAntiAiLoop<SeoAuditStruct>({
    systemPrompt: SYSTEM,
    userPrompt: prompt,
    schema: SeoAuditBody,
    maxTokens: 3000,
    narrativeOf,
  });
}
