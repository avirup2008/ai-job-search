export type FilterReason = "dutch_required" | "seniority_mismatch" | null;

export interface FilterInput {
  title: string;
  jdText: string;
  seniority: string | null; // optional future use
}

export interface FilterResult {
  filter: FilterReason;
}

// Patterns that indicate Dutch fluency is REQUIRED (not merely preferred).
// Word-boundary gated; case-insensitive.
const DUTCH_REQUIRED_PATTERNS: RegExp[] = [
  // Dutch phrasing
  /\bvloeiend\s+(nederlands|dutch)\b/i,
  /\bmoedertaalspreker\s+(nederlands|dutch)\b/i,
  /\bnederlands(e)?\s+moedertaalspreker\b/i,
  /\bgoede?\s+beheersing\s+(van\s+)?(het\s+)?(nederlands|dutch)\b/i,
  /\bminimaal\s+(b2|c1|c2)\s+(nederlands|dutch)\b/i,
  /\b(nederlands|dutch)\s+(is\s+)?(vereist|essential|required|mandatory)\b/i,
  // English phrasing
  /\bfluent\s+in\s+dutch\b/i,
  /\bdutch\s+(is\s+)?(fluent|native)\b/i,
  /\bdutch\s*\(?(b2|c1|c2)\)?\s+(required|essential|must)\b/i,
  /\bdutch\s*\(?(b2|c1|c2)\)?\s*(is\s+)?required\b/i,
  /\bdutch\s+(c1|c2|b2)\s+required\b/i,
  /\bdutch\s+is\s+(essential|required|mandatory)\b/i,
  /\b(native|fluent|c1|c2|b2)\s+dutch\s+speaker\b/i,
  // JD-level requirement framing
  /\bdutch\s+language\s+(required|essential|proficiency)\b/i,
];

// Phrases that explicitly soften the Dutch requirement — if present they
// override a preliminary "dutch_required" detection.
const DUTCH_SOFTENERS: RegExp[] = [
  /\bdutch\s+is\s+(a\s+plus|nice[-\s]to[-\s]have|not\s+required)\b/i,
  /\b(dutch|nederlands)\s+is\s+niet\s+vereist\b/i,
  /\bwhile\s+dutch\s+is\s+appreciated\b/i,
];

// Indicators the job TITLE itself is Dutch-language. Strong signal the role
// expects Dutch speakers. Conservative allow-list of Dutch-only marketing-ish
// title words to avoid catching pan-European English roles.
const DUTCH_TITLE_PATTERNS: RegExp[] = [
  /\bmedewerker\b/i,
  /\bstagiair(e)?\b/i,
  /\bcommunicatiemedewerker\b/i,
  /\bverkoopmedewerker\b/i,
  /\bcommerci(e|ë)el\b/i,
];

// Seniority mismatch: title-only patterns.
// We deliberately do NOT scan jdText — "director" and "intern" appear
// incidentally in JD bodies (e.g. "you report to the Director").
const SENIORITY_BLOCK_TITLE: RegExp[] = [
  /\b(vp|vice\s+president)\b/i,
  /\bchief\s+(marketing|growth|revenue|customer|executive|operating|financial|technology)\s+officer\b/i,
  /\bcmo\b/i,
  /\bc[rmfeto]o\b/i,
  /\bdirector\b/i,
  /\bintern(ship)?\b/i,
  /\bjunior\b/i,
  /\bentry[-\s]?level\b/i,
  /\btrainee\b/i,
  /\bgraduate\s+program\b/i,
];

export function applyHardFilters(input: FilterInput): FilterResult {
  const title = input.title ?? "";
  const jd = input.jdText ?? "";

  // --- Seniority check: title only ---
  if (SENIORITY_BLOCK_TITLE.some((re) => re.test(title))) {
    return { filter: "seniority_mismatch" };
  }

  // --- Dutch-required: check both title and body ---
  // Softeners only make sense in the body; title hits are always hard blocks.
  const titleHasDutchReq = DUTCH_REQUIRED_PATTERNS.some((re) => re.test(title));
  const bodyHasDutchReq = DUTCH_REQUIRED_PATTERNS.some((re) => re.test(jd));
  const bodyHasSoftener = DUTCH_SOFTENERS.some((re) => re.test(jd));

  if (titleHasDutchReq || (bodyHasDutchReq && !bodyHasSoftener)) {
    return { filter: "dutch_required" };
  }

  // --- Dutch-only title heuristic ---
  if (DUTCH_TITLE_PATTERNS.some((re) => re.test(title))) {
    return { filter: "dutch_required" };
  }

  return { filter: null };
}
