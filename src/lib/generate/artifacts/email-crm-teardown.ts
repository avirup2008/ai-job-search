import { z } from "zod";
import { ArtifactHeaderSchema } from "./types";
import { loadArtifactContext, runAntiAiLoop } from "./base";

const EmailCrmTeardownBody = z.object({
  header: ArtifactHeaderSchema,
  observations: z.array(z.object({
    area: z.enum(["acquisition", "onboarding", "activation", "retention", "loyalty", "reactivation", "cross-channel"]),
    signal: z.string().describe("What was observed — grounded in the dossier / candidate inference. Do not fabricate specific emails unless cited."),
    gap: z.string().describe("What might be missing or suboptimal (hypothesis, not fact)"),
    suggestion: z.string().describe("Concrete improvement the candidate would test"),
  })).min(3).max(6),
  quickWins: z.array(z.string()).min(2).max(4).describe("2-4 specific changes the candidate would prototype in week 1"),
  measurementPlan: z.string().describe("One paragraph: what the candidate would measure to know this is working — LTV, CLV, activation rate, nurture conversion, etc."),
  caveats: z.array(z.string()).max(3).describe("What assumptions this is based on, so the reader can challenge them"),
});
export type EmailCrmTeardownStruct = z.infer<typeof EmailCrmTeardownBody>;

const SYSTEM = `You produce a concise email/CRM teardown as a proof-of-work artifact for a specific job application.

HARD RULES:
- This is a hypothesis document. Do not fabricate specific email content, subject lines, or signup-flow details unless they come from the dossier.
- Phrase inferences as hypotheses ("my read is", "assuming", "without access to your internal funnel data").
- Ground suggestions in the candidate's real toolbox (HubSpot, Unbounce, A/B testing etc.). Do not invent expertise.
- Be specific where possible, honest about uncertainty where not.

ANTI-AI WRITING RULES (STRICT):
- ZERO em-dashes (—).
- ZERO negative parallelisms (not just X but Y / not only / not merely / more than just / rather than X-ing).
- ZERO "maps to / mapped to / mapping to" constructions.
- BANNED words: delve, pivotal, crucial, underscore, showcase, leverage, foster, tapestry, landscape (figurative), intricate, enduring, vibrant, robust, seamless, elevate, transformative, dynamic, at the intersection of, sits at the heart of, stands as, serves as, additionally, moreover, furthermore, ultimately, it is worth noting.
- Rule-of-three flourishes banned.

SHAPE:
- 3-6 observations, each with {area, signal, gap, suggestion}.
- 2-4 quickWins (specific changes prototypable in week 1).
- 1 measurement paragraph.
- Up to 3 caveats (assumptions being made).
- Header title: "{role}: Email & CRM Teardown".`;

function narrativeOf(d: EmailCrmTeardownStruct): string {
  const parts: string[] = [d.header.title, d.header.subtitle, d.measurementPlan];
  for (const o of d.observations) parts.push(o.signal, o.gap, o.suggestion);
  parts.push(...d.quickWins);
  parts.push(...d.caveats);
  return parts.join("\n");
}

export async function generateEmailCrmTeardown(jobId: string) {
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
    `Produce a structured email/CRM teardown. Header authorName = candidate fullName. Date = today ISO.`,
  ].join("\n");
  return runAntiAiLoop<EmailCrmTeardownStruct>({
    systemPrompt: SYSTEM,
    userPrompt: prompt,
    schema: EmailCrmTeardownBody,
    maxTokens: 3000,
    narrativeOf,
  });
}
