export type Tier = 1 | 2 | 3 | null;

/**
 * Map a fit score (0-100, produced by {@link blendFitScore}) to a generation tier.
 *
 * - Tier 1 (≥85): full package — CV + cover letter + proof artifact + screening Q&A
 * - Tier 2 (65-85): CV + cover letter
 * - Tier 3 (40-65): cover letter only (reuses master CV)
 * - null (<40 or invalid): filtered out, no generation
 *
 * Lower bounds are inclusive; upper bounds exclusive.
 */
export function assignTier(fitScore: number): Tier {
  if (!Number.isFinite(fitScore)) return null;
  if (fitScore >= 85) return 1;
  if (fitScore >= 65) return 2;
  if (fitScore >= 40) return 3;
  return null;
}
