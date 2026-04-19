export type Tier = 1 | 2 | 3 | null;

/**
 * Map a fit score (0-100, produced by {@link blendFitScore}) to a generation tier.
 *
 * - Tier 1 (≥78): full package — CV + cover letter + proof artifact + screening Q&A
 * - Tier 2 (60-78): CV + cover letter
 * - Tier 3 (38-60): cover letter only (reuses master CV)
 * - null (<38 or invalid): filtered out, no generation
 *
 * Thresholds calibrated for the Dutch market where skills rarely exceed 0.85 in
 * Haiku scoring. A job at 78+ with strong component scores is a genuine strong fit.
 *
 * Lower bounds are inclusive; upper bounds exclusive.
 */
export function assignTier(fitScore: number): Tier {
  if (!Number.isFinite(fitScore)) return null;
  if (fitScore >= 78) return 1;
  if (fitScore >= 60) return 2;
  if (fitScore >= 38) return 3;
  return null;
}
