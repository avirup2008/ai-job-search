import { z } from "zod";
import { ArtifactHeaderSchema } from "./types";
import { loadArtifactContext, runAntiAiLoop } from "./base";

const FunnelTeardownBody = z.object({
  header: ArtifactHeaderSchema,
  premise: z.string().describe("2-3 sentences — what assumption underlies this teardown"),
  funnelStages: z.array(z.object({
    stage: z.string().describe("Funnel stage name, e.g. Awareness, Consideration, Activation, Retention"),
    observation: z.string().describe("What the candidate observes or infers at this stage (hypothesis, not fact)"),
    frictionPoint: z.string().describe("The specific friction or drop-off risk at this stage"),
    experiment: z.string().describe("Concrete test or experiment to run to address the friction"),
  })).min(3).max(6),
  measurementPlan: z.string().describe("One paragraph: what the candidate would measure to know the funnel is improving"),
  caveats: z.array(z.string()).max(3).describe("Assumptions behind this teardown"),
});
export type FunnelTeardownStruct = z.infer<typeof FunnelTeardownBody>;

const SYSTEM = `You produce a concise end-to-end funnel teardown as a proof-of-work artifact for a specific job application.

HARD RULES:
- This is a hypothesis document. Do not fabricate internal funnel numbers, conversion rates, or activation metrics. Phrase inferences as hypotheses.
- Ground experiments in the candidate's actual toolbox (A/B testing platforms, analytics, CRO methods they have used). Do not invent expertise.
- Reference the specific company + role + dossier signals.
- Be specific where possible, honest about uncertainty where not.

ANTI-AI WRITING RULES (STRICT):
- ZERO em-dashes (—). Use commas, periods, colons, parentheses.
- ZERO negative parallelisms (not just X but Y / not only / not merely / more than just / rather than X-ing).
- ZERO "maps to / mapped to / mapping to" constructions.
- BANNED words: delve, pivotal, crucial, underscore, showcase, leverage, foster, tapestry, landscape (figurative), intricate, enduring, vibrant, robust, seamless, elevate, transformative, dynamic, at the intersection of, sits at the heart of, stands as, serves as, additionally, moreover, furthermore, ultimately, it is worth noting.
- Rule-of-three flourishes banned.

SHAPE:
- 3-6 funnel stages, each with {stage, observation, frictionPoint, experiment}.
- Premise: 2-3 sentences.
- 1 measurement paragraph.
- Up to 3 caveats.
- Header title: "{role}: Funnel Teardown".`;

function narrativeOf(d: FunnelTeardownStruct): string {
  const parts: string[] = [d.header.title, d.header.subtitle, d.premise, d.measurementPlan];
  for (const s of d.funnelStages) parts.push(s.stage, s.observation, s.frictionPoint, s.experiment);
  parts.push(...d.caveats);
  return parts.join("\n");
}

export async function generateFunnelTeardown(jobId: string) {
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
    `Produce a structured funnel teardown. Header authorName = candidate fullName. Date = today ISO.`,
  ].join("\n");
  return runAntiAiLoop<FunnelTeardownStruct>({
    systemPrompt: SYSTEM,
    userPrompt: prompt,
    schema: FunnelTeardownBody,
    maxTokens: 3000,
    narrativeOf,
  });
}
