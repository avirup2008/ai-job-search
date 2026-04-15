import { z } from "zod";
import { ArtifactHeaderSchema } from "./types";
import { loadArtifactContext, runAntiAiLoop } from "./base";

const PaidAuditBody = z.object({
  header: ArtifactHeaderSchema,
  premise: z.string().describe("2-3 sentences framing the audit"),
  channels: z.array(z.object({
    channel: z.enum(["meta", "google_search", "google_pmax", "linkedin", "youtube", "tiktok", "display", "affiliate", "other"]),
    currentState: z.string().describe("Hypothesis about how this channel is currently running"),
    opportunity: z.string().describe("Where the biggest lever sits"),
    testPlan: z.string().describe("Concrete test or experiment to run"),
  })).min(2).max(5),
  budgetHypothesis: z.string().describe("One paragraph: how the candidate would think about budget allocation across channels"),
  caveats: z.array(z.string()).max(3).describe("Assumptions behind this audit"),
});
export type PaidAuditStruct = z.infer<typeof PaidAuditBody>;

const SYSTEM = `You produce a concise paid-media channel-by-channel audit as a proof-of-work artifact for a specific job application.

HARD RULES:
- This is a hypothesis document. Do not fabricate spend, CAC, ROAS, or creative details unless they come from the dossier. Phrase inferences as hypotheses ("my read is", "assuming", "without access to the ad accounts").
- Ground test plans in the candidate's real toolbox (Meta Ads Manager, Google Ads, LinkedIn Campaign Manager, attribution tools they have used). Do not invent expertise.
- Reference the specific company + role + dossier signals.
- Be specific where possible, honest about uncertainty where not.

ANTI-AI WRITING RULES (STRICT):
- ZERO em-dashes (—). Use commas, periods, colons, parentheses.
- ZERO negative parallelisms (not just X but Y / not only / not merely / more than just / rather than X-ing).
- ZERO "maps to / mapped to / mapping to" constructions.
- BANNED words: delve, pivotal, crucial, underscore, showcase, leverage, foster, tapestry, landscape (figurative), intricate, enduring, vibrant, robust, seamless, elevate, transformative, dynamic, at the intersection of, sits at the heart of, stands as, serves as, additionally, moreover, furthermore, ultimately, it is worth noting.
- Rule-of-three flourishes banned.

SHAPE:
- 2-5 channels, each with {channel, currentState, opportunity, testPlan}.
- Premise: 2-3 sentences.
- 1 budget hypothesis paragraph.
- Up to 3 caveats.
- Header title: "{role}: Paid Media Audit".`;

function narrativeOf(d: PaidAuditStruct): string {
  const parts: string[] = [d.header.title, d.header.subtitle, d.premise, d.budgetHypothesis];
  for (const c of d.channels) parts.push(c.currentState, c.opportunity, c.testPlan);
  parts.push(...d.caveats);
  return parts.join("\n");
}

export async function generatePaidAudit(jobId: string) {
  const ctx = await loadArtifactContext(jobId);
  const prompt = [
    `COMPANY: ${ctx.companyName}`,
    `ROLE: ${ctx.job.title}`,
    `JD:\n${(ctx.job.jdText ?? "").slice(0, 4000)}`,
    "",
    `===COMPANY_DOSSIER===`,
    `Product: ${ctx.dossier.productOneLiner}`,
    `Stage: ${ctx.dossier.stage} | Industry: ${ctx.dossier.industry}`,
    `Marketing stack seen: ${ctx.dossier.marketingStack.join(", ") || "none detected — frame this as a caveat"}`,
    `Narrative: ${ctx.dossier.narrative}`,
    `===END_DOSSIER===`,
    "",
    `===CANDIDATE_PROFILE===`,
    ctx.profileText,
    `===END_PROFILE===`,
    "",
    `Produce a structured paid-media audit. Header authorName = candidate fullName. Date = today ISO.`,
  ].join("\n");
  return runAntiAiLoop<PaidAuditStruct>({
    systemPrompt: SYSTEM,
    userPrompt: prompt,
    schema: PaidAuditBody,
    maxTokens: 3000,
    narrativeOf,
  });
}
