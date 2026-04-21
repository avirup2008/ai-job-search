/**
 * Canonical keyword list for all job sources.
 * Single source of truth — import from here, never define locally in a source file.
 *
 * Decisions:
 * - "paid media" removed: Upashana's profile excludes paid/performance roles
 * - "marketing manager" removed: too broad, low LLM precision score
 * - "email marketing manager" retired: subsumed by "email marketing" + "campaign manager"
 * - "marketing operations", "CRM specialist", "campaign manager", "marketing coordinator",
 *   "marketing specialist", "demand generation" added: direct profile match, previously
 *   missing from most or all sources
 */
export const SEARCH_KEYWORDS = [
  "marketing automation",
  "marketing operations",
  "CRM marketing",
  "CRM specialist",
  "email marketing",
  "campaign manager",
  "marketing coordinator",
  "marketing specialist",
  "HubSpot",
  "digital marketing",
  "growth marketing",
  "demand generation",
] as const;

export type SearchKeyword = (typeof SEARCH_KEYWORDS)[number];
