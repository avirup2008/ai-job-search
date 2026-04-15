import { z } from "zod";
import { profileToCompactText, type Profile } from "@/lib/profile/types";

export interface FitComponents {
  skills: number;     // 0..1 — core responsibilities / domain match
  tools: number;      // 0..1 — tool stack overlap
  seniority: number;  // 0..1 — level match (mid/senior = 1, director/intern = 0)
  industry: number;   // 0..1 — industry overlap
}

const WEIGHTS: FitComponents = {
  skills: 0.40,
  tools: 0.30,
  seniority: 0.15,
  industry: 0.15,
};

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function blendFitScore(c: FitComponents): number {
  const raw =
    clamp01(c.skills) * WEIGHTS.skills +
    clamp01(c.tools) * WEIGHTS.tools +
    clamp01(c.seniority) * WEIGHTS.seniority +
    clamp01(c.industry) * WEIGHTS.industry;
  return Math.round(raw * 1000) / 10; // 0..100 with 1 decimal
}

// Haiku returns enrichment + component scores in one call.
const FitAssessmentSchema = z.object({
  // Enrichment (needed for filters + UI)
  tools: z.array(z.string()).describe("Tool/software names named in the JD"),
  seniorityLevel: z.enum([
    "intern", "junior", "mid", "senior", "lead", "manager", "director", "vp", "c_level", "unknown",
  ]),
  industries: z.array(z.string()),
  // Fit component scores 0..1
  components: z.object({
    skills: z.number().min(0).max(1).describe("How well core responsibilities match candidate's demonstrated work. 1 = strong match."),
    tools: z.number().min(0).max(1).describe("Overlap between JD tools and candidate's toolStack. 1 = strong overlap."),
    seniority: z.number().min(0).max(1).describe("Level match. 1 = mid/senior/manager. 0 = director+ or intern/junior."),
    industry: z.number().min(0).max(1).describe("Industry overlap with candidate's background."),
  }),
  // Explanations (short, one line each)
  strengths: z.array(z.string()).max(4).describe("What the candidate should lead with for this role"),
  gaps: z.array(z.string()).max(4).describe("Gaps weighted by JD emphasis"),
  recommendation: z.enum(["strong_apply", "apply_with_caveat", "stretch", "skip"]),
  recommendationReason: z.string().max(800).describe("1-2 sentences explaining the recommendation"),
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
- Mark seniority score high (>=0.8) for mid/senior/manager/lead; low (<=0.3) for director/VP/C-level or intern/junior.
- The candidate's commute has been pre-verified — do not re-evaluate geography. Score purely on skills/tools/seniority/industry fit.
- Keep strengths/gaps concrete, not generic.
- Recommendation will be derived from the overall fit score — you only need to populate components and strengths/gaps honestly.

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
  const fitScore = blendFitScore(components);
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
