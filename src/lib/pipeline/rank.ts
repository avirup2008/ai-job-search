import { z } from "zod";
import { profileToCompactText, type Profile } from "@/lib/profile/types";

export interface FitComponents {
  skills: number;     // 0..1 — core responsibilities / domain match
  tools: number;      // 0..1 — tool stack overlap
  seniority: number;  // 0..1 — level match (mid/senior = 1, director/intern = 0)
  industry: number;   // 0..1 — industry overlap
}

export const WEIGHTS: FitComponents = {
  skills: 0.55,
  tools: 0.30,
  seniority: 0.10,
  industry: 0.05,
};

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function blendFitScore(
  c: FitComponents,
  flags?: { hardRequirementsMet?: boolean },
): number {
  const raw =
    clamp01(c.skills) * WEIGHTS.skills +
    clamp01(c.tools) * WEIGHTS.tools +
    clamp01(c.seniority) * WEIGHTS.seniority +
    clamp01(c.industry) * WEIGHTS.industry;
  const base = Math.round(raw * 1000) / 10; // 0..100 with 1 decimal
  // 15% penalty when candidate is missing a stated hard requirement
  if (flags?.hardRequirementsMet === false) {
    return Math.round(base * 0.85 * 10) / 10;
  }
  return base;
}

// Haiku returns enrichment + component scores in one call.
const FitAssessmentSchema = z.object({
  // Enrichment
  tools: z.array(z.string()).describe("Tool/software names named in the JD"),
  seniorityLevel: z.enum([
    "intern", "junior", "mid", "senior", "lead", "manager", "director", "vp", "c_level", "unknown",
  ]),
  industries: z.array(z.string()),
  // Hard requirements check (improvement 3)
  hardRequirementsMet: z.boolean().describe(
    "True if the candidate meets ALL hard requirements stated in the JD (look for words: " +
    "'required', 'must have', 'essential', 'mandatory'). False if any hard requirement is " +
    "clearly absent from the profile. Default true when JD has no explicit hard requirements."
  ),
  // Dutch language flag (improvement 4)
  dutchLanguageRequired: z.boolean().describe(
    "True ONLY if the JD explicitly states Dutch language proficiency is required or essential. " +
    "False for 'nice to have Dutch', 'Dutch is a plus', or when language is not mentioned."
  ),
  // Fit component scores 0..1
  components: z.object({
    skills: z.number().min(0).max(1).describe(
      "Core responsibilities match. Use these exact ranges: " +
      "0.85–1.0 = >80% of stated duties directly match candidate's demonstrated experience. " +
      "0.65–0.80 = 60–75% match; some duties adjacent but transferable. " +
      "0.40–0.65 = ~40% match; meaningful gaps in core duties. " +
      "0.10–0.40 = <40% match; fundamentally different role type. " +
      "Score on what IS demonstrated — do not penalise for unlisted skills if core duties match."
    ),
    tools: z.number().min(0).max(1).describe(
      "Tool/platform overlap. Score exact matches higher than transfers — switching platforms has a real ramp cost. " +
      "0.85–1.0 = candidate uses the exact tools named in the JD. " +
      "0.65–0.80 = same-category transfer (e.g. HubSpot→Salesforce, GA→Mixpanel, Meta Ads→LinkedIn Ads, Mailchimp→Klaviyo, Looker→Tableau) — capability transfers but there is a learning curve. " +
      "0.40–0.65 = adjacent tooling; meaningful ramp required. " +
      "0.10–0.40 = largely different toolset with little overlap."
    ),
    seniority: z.number().min(0).max(1).describe("Level match. 1 = mid/senior/manager. 0 = director+ or intern/junior."),
    industry: z.number().min(0).max(1).describe("Industry overlap with candidate's background."),
  }),
  // Explanations
  strengths: z.array(z.string()).describe("What the candidate should lead with for this role"),
  gaps: z.array(z.string()).describe("Gaps weighted by JD emphasis"),
  recommendation: z.enum(["strong_apply", "apply_with_caveat", "stretch", "skip"]),
  recommendationReason: z.string().describe("1-2 sentences explaining the recommendation"),
});

export type FitAssessment = z.infer<typeof FitAssessmentSchema>;

export interface RankResult {
  fitScore: number;          // 0..100
  components: FitComponents;
  assessment: FitAssessment;
}

const SYSTEM_PROMPT = `You are an expert job-fit analyst for a single candidate applying to roles in the Netherlands.

You assess how well a role matches THIS candidate. You MUST:
- Rate each component 0..1 based on concrete signals in the JD vs the profile.
- NEVER fabricate experience or claim tools the candidate doesn't have.

SKILLS scoring rules:
- Score on what the candidate HAS demonstrated, not what they haven't mentioned.
- If >80% of core duties directly match, score 0.85–1.0. Don't let minor gaps drag a strong match below 0.75.

TOOLS scoring rules:
- Exact tool match = highest score. Same-category platform transfer = partial credit (0.65–0.80) because there IS a real learning curve.
- These count as same-category transfers (not exact matches): HubSpot↔Salesforce, GA↔Mixpanel/Amplitude, Meta Ads↔LinkedIn Ads, Mailchimp↔Klaviyo, Looker↔Tableau↔Power BI, WordPress↔Webflow.
- Do NOT score a transfer the same as an exact match — the candidate still needs to ramp on the new tool.

SENIORITY score MUST follow these exact ranges — no exceptions:
  • manager / lead / senior → 0.85–1.0
  • mid-level → 0.65–0.80
  • junior / intern → 0.05–0.25
  • director / VP / C-level → 0.05–0.25
  Do NOT score a manager or lead role below 0.85.

HARD REQUIREMENTS (hardRequirementsMet):
- Scan the JD for words: "required", "must have", "essential", "mandatory", "you have".
- If the candidate clearly lacks ANY of these stated requirements, set hardRequirementsMet=false.
- When in doubt, set true.

DUTCH LANGUAGE (dutchLanguageRequired):
- Set true ONLY when Dutch fluency is an explicit hard requirement.
- "Nice to have Dutch", "Dutch is a plus", or no language mention → false.

- The candidate's commute has been pre-verified — do not re-evaluate geography.
- Keep strengths/gaps concrete, not generic.
- Recommendation will be derived from the overall fit score.

Return ONLY via the structured response tool.`;

export async function assessJob(params: {
  jdText: string;
  jobTitle: string;
  profile: Profile;
  cacheProfile?: boolean;  // if true, system prompt includes profile for prompt caching
}): Promise<RankResult> {
  // Lazy import keeps module load free of db/env side-effects (pure blend math is testable standalone)
  const { getLLM } = await import("@/lib/llm");
  const llm = getLLM();
  const profileText = profileToCompactText(params.profile);

  // Put the profile in the (cached) system prompt so 900+ calls/mo hit cache
  const system = `${SYSTEM_PROMPT}\n\n===CANDIDATE_PROFILE===\n${profileText}\n===END_PROFILE===`;

  const prompt = `JD TITLE: ${params.jobTitle}\n\nJD BODY:\n${params.jdText.slice(0, 6000)}`;

  const res = await llm.structured({
    model: "haiku",
    system,
    prompt,
    schema: FitAssessmentSchema,
    maxTokens: 1200,
    temperature: 0.1,
    cacheSystem: params.cacheProfile ?? true,
  });

  const components = res.data.components;
  const fitScore = blendFitScore(components, { hardRequirementsMet: res.data.hardRequirementsMet });
  // Deterministic recommendation from fit score, independent of Haiku's judgment.
  // Thresholds align with tier boundaries so tier + recommendation stay consistent.
  const recommendation = recommendationFromFit(fitScore);
  return {
    fitScore,
    components,
    assessment: { ...res.data, recommendation },
  };
}

export function recommendationFromFit(fitScore: number): "strong_apply" | "apply_with_caveat" | "stretch" | "skip" {
  if (!Number.isFinite(fitScore)) return "skip";
  if (fitScore >= 80) return "strong_apply";
  if (fitScore >= 65) return "apply_with_caveat";
  if (fitScore >= 40) return "stretch";
  return "skip";
}
