/**
 * Tier drift detection.
 *
 * Compares oldTier (stored previousTier) with newTier (freshly computed)
 * and returns a descriptor indicating whether drift occurred.
 *
 * Design rules:
 * - No prior tier (oldTier == null) → not drift (first-time score).
 * - New score failed (newTier == null) → not drift (treat as no signal to
 *   avoid noise per D-1 spirit: don't write misleading drift events).
 * - Same tier → not drift.
 * - Different tiers (both non-null) → drift with delta = newTier - oldTier.
 */

export interface DriftDescriptor {
  drifted: boolean;
  oldTier: number | null;
  newTier: number | null;
  /** newTier - oldTier when drifted; 0 otherwise */
  delta: number;
}

/**
 * Detect whether a job's tier has changed between scoring runs.
 */
export function detectDrift(
  oldTier: number | null,
  newTier: number | null,
): DriftDescriptor {
  const drifted = oldTier != null && newTier != null && oldTier !== newTier;
  const delta = drifted ? (newTier as number) - (oldTier as number) : 0;
  return { drifted, oldTier, newTier, delta };
}
