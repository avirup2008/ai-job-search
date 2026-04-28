/**
 * Feedback multipliers for scoring.
 *
 * Outcome feedback (rejected/interview/offer) updates per-bucket multipliers
 * stored in profile.preferences.feedbackWeights.byIndustrySeniority.
 *
 * Multipliers are clamped to [MULTIPLIER_MIN, MULTIPLIER_MAX] in steps of
 * MULTIPLIER_STEP to prevent runaway weight drift (T-13-01 mitigation).
 *
 * No LLM calls — pure math per D-1 budget constraint.
 */

import { blendFitScore, type FitComponents } from "@/lib/pipeline/rank";

// --------------------------------------------------------------------------
// Public constants
// --------------------------------------------------------------------------

export const MULTIPLIER_MIN = 0.7;
export const MULTIPLIER_MAX = 1.3;
export const MULTIPLIER_STEP = 0.05;

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface ScoringMultipliers {
  /** key = `${industry.toLowerCase()}|${seniority.toLowerCase()}` */
  byIndustrySeniority: Record<string, number>;
}

// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------

/** Composite key for a (industry, seniority) pair. */
function bucketKey(industry: string, seniority: string): string {
  return `${industry.toLowerCase()}|${seniority.toLowerCase()}`;
}

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

const STEP: Record<"rejected" | "interview" | "offer", number> = {
  rejected: -MULTIPLIER_STEP,
  interview: +MULTIPLIER_STEP,
  offer: +MULTIPLIER_STEP * 2, // two steps per plan spec
};

// --------------------------------------------------------------------------
// Flag reason constants + learning config
// --------------------------------------------------------------------------

export const FLAG_REASONS = [
  "distance",
  "dutch_required",
  "european_language",
  "skill_mismatch",
  "seniority_mismatch",
  "other",
] as const;

export type FlagReason = typeof FLAG_REASONS[number];

/**
 * Multiplier delta applied when a job is flagged with a given reason.
 * Hard-constraint reasons (distance, language) don't adjust the model —
 * they should be hard-filtered upstream. Content reasons do.
 */
const FLAG_STEP: Partial<Record<FlagReason, number>> = {
  skill_mismatch: -MULTIPLIER_STEP,         // −0.05: mild penalty
  seniority_mismatch: -MULTIPLIER_STEP * 2,  // −0.10: stronger — seniority is very consistent
  other: -MULTIPLIER_STEP,                   // −0.05: mild generic penalty
  // distance / dutch_required / european_language → no multiplier change
};

// --------------------------------------------------------------------------
// applyOutcome
// --------------------------------------------------------------------------

/**
 * Return a new ScoringMultipliers with the relevant bucket(s) adjusted.
 *
 * - Each industry in `jobIndustries` gets its (industry, seniority) bucket
 *   updated by the outcome step.
 * - If `jobIndustries` is empty but `jobSeniority` is truthy, falls back to
 *   the empty-industry bucket `'|seniority'` so seniority signal is preserved.
 * - Multipliers are clamped to [MULTIPLIER_MIN, MULTIPLIER_MAX] at write time
 *   (T-13-01 mitigation).
 */
export function applyOutcome(
  current: ScoringMultipliers,
  outcome: "rejected" | "interview" | "offer",
  jobIndustries: string[],
  jobSeniority: string,
): ScoringMultipliers {
  const next = structuredClone(current) as ScoringMultipliers;
  const delta = STEP[outcome];

  if (jobIndustries.length === 0 && jobSeniority) {
    // Fallback: seniority-only bucket
    const key = bucketKey("", jobSeniority);
    const prev = next.byIndustrySeniority[key] ?? 1.0;
    next.byIndustrySeniority[key] = clamp(prev + delta, MULTIPLIER_MIN, MULTIPLIER_MAX);
  } else {
    for (const industry of jobIndustries) {
      const key = bucketKey(industry, jobSeniority);
      const prev = next.byIndustrySeniority[key] ?? 1.0;
      next.byIndustrySeniority[key] = clamp(prev + delta, MULTIPLIER_MIN, MULTIPLIER_MAX);
    }
  }

  return next;
}

// --------------------------------------------------------------------------
// applyFlaggedOutcome
// --------------------------------------------------------------------------

/**
 * Adjust multipliers when a job is flagged as "not a fit" with a reason.
 * Only content-quality reasons (skill/seniority mismatch, other) update the
 * scoring model. Hard-constraint reasons (distance, language) are a no-op
 * here — they should be caught by hard filters upstream.
 */
export function applyFlaggedOutcome(
  current: ScoringMultipliers,
  reason: FlagReason,
  jobIndustries: string[],
  jobSeniority: string,
): ScoringMultipliers {
  const delta = FLAG_STEP[reason];
  if (delta === undefined) return current; // hard-constraint reason — no scoring change

  const next = structuredClone(current) as ScoringMultipliers;

  if (jobIndustries.length === 0 && jobSeniority) {
    const key = bucketKey("", jobSeniority);
    const prev = next.byIndustrySeniority[key] ?? 1.0;
    next.byIndustrySeniority[key] = clamp(prev + delta, MULTIPLIER_MIN, MULTIPLIER_MAX);
  } else {
    for (const industry of jobIndustries) {
      const key = bucketKey(industry, jobSeniority);
      const prev = next.byIndustrySeniority[key] ?? 1.0;
      next.byIndustrySeniority[key] = clamp(prev + delta, MULTIPLIER_MIN, MULTIPLIER_MAX);
    }
  }

  return next;
}

// --------------------------------------------------------------------------
// blendFitScoreWithMultipliers
// --------------------------------------------------------------------------

/**
 * Apply profile multipliers to the fit blend.
 *
 * Strategy: for each industry in ctx.industries, look up the
 * (industry, seniority) bucket. If multiple industries match, pick the
 * multiplier furthest from 1.0 to preserve the strongest signal.
 * Defaults to m=1.0 (identity) when no bucket matches.
 *
 * Final score is clamped to [0, 100] and rounded to 1 decimal.
 */
export function blendFitScoreWithMultipliers(
  components: FitComponents,
  multipliers: ScoringMultipliers,
  ctx: { industries: string[]; seniority: string | null },
): number {
  const base = blendFitScore(components); // 0..100 with 1 decimal

  let m = 1.0;
  const senStr = ctx.seniority ?? "";
  for (const industry of ctx.industries) {
    const key = bucketKey(industry, senStr);
    const candidate = multipliers.byIndustrySeniority[key];
    if (candidate !== undefined) {
      // Pick the multiplier furthest from 1.0 across all matching industries
      if (Math.abs(candidate - 1.0) > Math.abs(m - 1.0)) {
        m = candidate;
      }
    }
  }

  // If no industry hit, try the seniority-only fallback bucket
  if (m === 1.0 && senStr) {
    const fallbackKey = bucketKey("", senStr);
    const candidate = multipliers.byIndustrySeniority[fallbackKey];
    if (candidate !== undefined) m = candidate;
  }

  const raw = base * m;
  const clamped = clamp(raw, 0, 100);
  return Math.round(clamped * 10) / 10;
}

// --------------------------------------------------------------------------
// Profile read/write
// --------------------------------------------------------------------------

/**
 * Extract ScoringMultipliers from the opaque profile.preferences JSONB.
 * Type-guards all values to be numbers before trusting the map (T-13-01).
 * Returns `{ byIndustrySeniority: {} }` on any parse failure.
 */
export function readMultipliersFromProfile(preferences: unknown): ScoringMultipliers {
  const empty: ScoringMultipliers = { byIndustrySeniority: {} };
  if (preferences === null || typeof preferences !== "object") return empty;
  const pref = preferences as Record<string, unknown>;
  const fw = pref["feedbackWeights"];
  if (fw === null || typeof fw !== "object") return empty;
  const fwObj = fw as Record<string, unknown>;
  const bIS = fwObj["byIndustrySeniority"];
  if (bIS === null || typeof bIS !== "object") return empty;
  const map = bIS as Record<string, unknown>;
  // Type-guard: all values must be numbers
  for (const v of Object.values(map)) {
    if (typeof v !== "number") return empty;
  }
  return { byIndustrySeniority: map as Record<string, number> };
}

/**
 * Merge ScoringMultipliers back into the profile.preferences JSONB blob.
 * Preserves all other top-level preference keys.
 */
export function writeMultipliersToProfile(
  preferences: unknown,
  m: ScoringMultipliers,
): Record<string, unknown> {
  const base = (typeof preferences === "object" && preferences !== null)
    ? { ...(preferences as Record<string, unknown>) }
    : {};
  const prevFw = (typeof base["feedbackWeights"] === "object" && base["feedbackWeights"] !== null)
    ? { ...(base["feedbackWeights"] as Record<string, unknown>) }
    : {};
  base["feedbackWeights"] = {
    ...prevFw,
    byIndustrySeniority: m.byIndustrySeniority,
  };
  return base;
}
