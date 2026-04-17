/**
 * Curated keyword list for skill extraction from job descriptions.
 * Covers the marketing/growth domain relevant to Upashana's search.
 * Edit this list to adjust what signals the analytics skills panel tracks.
 */
export const KEYWORDS: string[] = [
  "CRM",
  "HubSpot",
  "Salesforce",
  "Marketo",
  "Pardot",
  "Campaign management",
  "Lifecycle marketing",
  "Email marketing",
  "Paid media",
  "Google Ads",
  "Meta Ads",
  "LinkedIn Ads",
  "SEO",
  "Content marketing",
  "Copywriting",
  "Analytics",
  "GA4",
  "Google Analytics",
  "Looker",
  "Tableau",
  "SQL",
  "Python",
  "A/B testing",
  "Experimentation",
  "Segmentation",
  "Personalization",
  "Marketing automation",
  "Growth",
  "Retention",
  "Acquisition",
  "Attribution",
  "CDP",
  "Segment",
  "Braze",
  "Iterable",
  "Klaviyo",
  "B2B",
  "B2C",
  "SaaS",
  "Stakeholder management",
  "Budget management",
];

/**
 * Escape special regex characters in a string so it can be used in a RegExp.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a word-boundary regex for a keyword.
 * Uses \b where the character is a word char, otherwise a lookahead/lookbehind.
 * For most marketing keywords (plain words) \b works fine.
 */
function keywordRegex(keyword: string): RegExp {
  return new RegExp("\\b" + escapeRegex(keyword) + "\\b", "i");
}

/**
 * Count how many of the provided JD texts contain each keyword (presence, not
 * frequency — one job counts at most once per keyword).
 *
 * Returns a Map from keyword → count of JDs containing that keyword.
 */
export function extractKeywordCounts(jdTexts: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const keyword of KEYWORDS) {
    const re = keywordRegex(keyword);
    let n = 0;
    for (const jd of jdTexts) {
      if (re.test(jd)) n++;
    }
    counts.set(keyword, n);
  }

  return counts;
}

/**
 * Profile shape accepted by profileKeywordSet — all fields optional/nullable
 * because any of them may be absent from a partial profile row.
 */
export interface ProfileInput {
  headline?: string | null;
  roles?: unknown;
  toolStack?: unknown;
  achievements?: unknown;
  industries?: unknown;
}

/**
 * Flatten the profile JSON fields into a single lowercase blob, then return the
 * Set of KEYWORDS (preserving original casing) that appear in that blob.
 *
 * toolStack is the primary signal; the other fields provide supporting context.
 */
export function profileKeywordSet(profile: ProfileInput): Set<string> {
  const parts: string[] = [];

  if (profile.headline) parts.push(profile.headline);
  if (profile.toolStack != null) {
    try {
      parts.push(JSON.stringify(profile.toolStack));
    } catch {
      // ignore non-serialisable values
    }
  }
  if (profile.roles != null) {
    try {
      parts.push(JSON.stringify(profile.roles));
    } catch {
      // ignore
    }
  }
  if (profile.achievements != null) {
    try {
      parts.push(JSON.stringify(profile.achievements));
    } catch {
      // ignore
    }
  }
  if (profile.industries != null) {
    try {
      parts.push(JSON.stringify(profile.industries));
    } catch {
      // ignore
    }
  }

  const blob = parts.join(" ").toLowerCase();
  const matched = new Set<string>();

  for (const keyword of KEYWORDS) {
    const re = keywordRegex(keyword);
    if (re.test(blob)) {
      matched.add(keyword);
    }
  }

  return matched;
}
