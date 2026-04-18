/**
 * Soft-penalty detection for roles Upashana should not apply to.
 *
 * These are NOT hard filters — jobs still appear in the inbox but with a
 * lower score and a visible reason. Penalty is applied after LLM ranking
 * so the underlying fit components are preserved for audit/debugging.
 *
 * Order of checks: brand manager → content-only → industrial B2B → agency
 * First match wins; only one penalty is applied per job.
 */

export interface AvoidPenaltyResult {
  /** Points to subtract from the final fit score (0 = no penalty). */
  penalty: number;
  /** Human-readable reason surfaced in gapAnalysis.penaltyReason and appended to gaps. null when penalty is 0. */
  reason: string | null;
}

// ---------------------------------------------------------------------------
// Pattern arrays
// ---------------------------------------------------------------------------

/** Matches brand management / brand manager roles (title-only check). */
const BRAND_MANAGER_PATTERNS: RegExp[] = [
  /\bbrand\s+manager\b/i,
  /\bbrand\s+management\b/i,
  /\bhead\s+of\s+brand\b/i,
  /\bbrand\s+director\b/i,
  /\bbrand\s+lead\b/i,
];

/** Matches pure content / copywriting roles (title-only check). */
const CONTENT_ONLY_PATTERNS: RegExp[] = [
  /\bcopywriter\b/i,
  /\bcontent\s+strategist\b/i,
  /\bcontent\s+writer\b/i,
  /\bcontent\s+creator\b/i,
  /\bcontent\s+manager\b/i,
  /\beditorial\s+manager\b/i,
  /\bsocial\s+media\s+manager\b/i,
  /\bsocial\s+media\s+specialist\b/i,
];

/** Matches industrial / technical B2B roles unlikely to fit Upashana's profile (title + JD check). */
const INDUSTRIAL_B2B_PATTERNS: RegExp[] = [
  /\bindustrial\b/i,
  /\bmanufacturing\b/i,
  /\bengineering\s+sector\b/i,
  /\boil\s+(and|&)\s+gas\b/i,
  /\bchemical\s+industry\b/i,
  /\bautomotive\s+sector\b/i,
  /\bheavy\s+machinery\b/i,
  /\bB2B\s+technical\b/i,
  /\btechnical\s+B2B\b/i,
];

/** Matches agency / consultancy contexts (title + JD check). */
const AGENCY_PATTERNS: RegExp[] = [
  /\badvertising\s+agency\b/i,
  /\bmarketing\s+agency\b/i,
  /\bcreative\s+agency\b/i,
  /\bdigital\s+agency\b/i,
  /\bmedia\s+agency\b/i,
  /\bclient\s+services\b/i,
  /\baccount\s+manager\b/i,
  /\baccount\s+executive\b/i,
  /\bwe\s+are\s+an\s+agency\b/i,
  /\bour\s+agency\b/i,
];

// ---------------------------------------------------------------------------
// Pure function
// ---------------------------------------------------------------------------

/**
 * Applies soft-penalty detection to a job title and JD text.
 *
 * @param title - Job title (required, checked by all pattern groups).
 * @param jdText - Full job description text (used by industrial B2B and agency groups).
 * @returns penalty (0 or positive integer) and human-readable reason (null when no penalty).
 */
export function applyAvoidPenalty(title: string, jdText: string): AvoidPenaltyResult {
  const combined = `${title} ${jdText.slice(0, 4000)}`;

  // 1. Brand manager check — title only
  if (BRAND_MANAGER_PATTERNS.some((re) => re.test(title))) {
    return {
      penalty: 15,
      reason: "Role appears to be brand management — outside target profile (soft penalty -15)",
    };
  }

  // 2. Content-only check — title only
  if (CONTENT_ONLY_PATTERNS.some((re) => re.test(title))) {
    return {
      penalty: 15,
      reason: "Role appears to be content / copywriting focused — outside target profile (soft penalty -15)",
    };
  }

  // 3. Industrial / technical B2B check — title + JD
  if (INDUSTRIAL_B2B_PATTERNS.some((re) => re.test(combined))) {
    return {
      penalty: 15,
      reason: "Role is in industrial or technical B2B sector — outside target profile (soft penalty -15)",
    };
  }

  // 4. Agency check — title + JD
  if (AGENCY_PATTERNS.some((re) => re.test(combined))) {
    return {
      penalty: 10,
      reason: "Role appears to be at an advertising or creative agency — outside target profile (soft penalty -10)",
    };
  }

  return { penalty: 0, reason: null };
}
