import { franc } from "franc-min";
import { detectWorkMode, checkCommute } from "./commute";

export type FilterReason =
  | "dutch_required"
  | "seniority_mismatch"
  | "commute_unreachable"
  | null;

export interface FilterInput {
  title: string;
  jdText: string;
  location: string | null;
  seniority: string | null;
}

export interface FilterResult {
  filter: FilterReason;
}

// Explicit "Dutch fluency required" phrasing (JD body + title)
const DUTCH_REQUIRED_PATTERNS: RegExp[] = [
  /\bvloeiend\s+(nederlands|dutch)\b/i,
  /\bmoedertaalspreker\s+(nederlands|dutch)\b/i,
  /\bnederlands(e)?\s+moedertaalspreker\b/i,
  /\bgoede?\s+beheersing\s+(van\s+)?(het\s+)?(nederlands|dutch)\b/i,
  /\bminimaal\s+(b2|c1|c2)\s+(nederlands|dutch)\b/i,
  /\b(nederlands|dutch)\s+(is\s+)?vereist\b/i,
  /\b(nederlands|dutch)\s+is\s+(essential|required|mandatory|must)\b/i,
  /\bfluent\s+in\s+dutch\b/i,
  /\bdutch[-\s]?speaking\b/i,        // "Dutch-Speaking", "Dutch Speaking"
  /\bdutch[-\s]?native\b/i,          // "Dutch-Native"
  /\bnederlandstalig\b/i,            // Nederlandstalig
  /\bdutch\s+(is\s+)?(fluent|native)\b/i,
  /\bdutch\s*\(?(b2|c1|c2)\)?\s+(required|essential|must)\b/i,
  /\bdutch\s*\(?(b2|c1|c2)\)?\s*(is\s+)?required\b/i,
  /\bdutch\s+(c1|c2|b2)\s+required\b/i,
  /\b(native|fluent|c1|c2|b2)\s+dutch\s+speaker\b/i,
  /\bdutch\s+language\s+(required|essential|proficiency)\b/i,
];

// Softeners that override body-detected Dutch signal
const DUTCH_SOFTENERS: RegExp[] = [
  /\bdutch\s+is\s+(a\s+plus|nice[-\s]to[-\s]have|not\s+required)\b/i,
  /\b(dutch|nederlands)\s+is\s+niet\s+vereist\b/i,
  /\bwhile\s+dutch\s+is\s+appreciated\b/i,
];

// Dutch-only words in TITLE — any match signals Dutch-speaking role
const DUTCH_TITLE_WORDS: RegExp[] = [
  /\bmedewerker\b/i,
  /\bstagiair(e)?\b/i,
  /\bmeewerkstage\b/i,
  /\bafstudeerstage\b/i,
  /\bwerkstudent\b/i,
  /\bbijbaan\b/i,
  /\bvacature\b/i,
  /\bmarketeer\b/i,                  // Dutch spelling of marketer
  /\bimplementatie\b/i,              // Dutch for implementation
  /\bnederlandstalig\b/i,
  /\bcommunicatiemedewerker\b/i,
  /\bverkoopmedewerker\b/i,
  /\bcommerci(e|ë)el\b/i,
  // "bij X" pattern in title (Dutch "at X")
  /\s+bij\s+[A-Z]/,
];

const SENIORITY_BLOCK_TITLE: RegExp[] = [
  /\b(vp|vice\s+president)\b/i,
  /\bchief\s+(marketing|growth|revenue|customer|executive|technology|financial)\s+officer\b/i,
  /\b(cmo|cgo|cro|ceo|cto|cfo)\b/i,
  /\bdirector\b/i,
  /\b(hoofd|head)\s+of\b.*\b(director|vp)\b/i,
  /\bintern(ship)?\b/i,
  /\bjunior\b/i,
  /\bentry[-\s]?level\b/i,
  /\btrainee\b/i,
  /\bgraduate\s+program\b/i,
  /\bstage\b/i,                      // Dutch for internship
  /\bmeewerkstage\b/i,
  /\bafstudeerstage\b/i,
];

export function applyHardFilters(input: FilterInput): FilterResult {
  const title = input.title ?? "";
  const jd = input.jdText ?? "";

  // Seniority (title-only)
  if (SENIORITY_BLOCK_TITLE.some((re) => re.test(title))) {
    return { filter: "seniority_mismatch" };
  }

  // Dutch-required — title always blocks; body blocks unless softened
  const titleHasDutchReq = DUTCH_REQUIRED_PATTERNS.some((re) => re.test(title));
  const bodyHasDutchReq = DUTCH_REQUIRED_PATTERNS.some((re) => re.test(jd));
  const bodyHasSoftener = DUTCH_SOFTENERS.some((re) => re.test(jd));
  if (titleHasDutchReq || (bodyHasDutchReq && !bodyHasSoftener)) {
    return { filter: "dutch_required" };
  }

  // Dutch-only words in title
  if (DUTCH_TITLE_WORDS.some((re) => re.test(title))) {
    return { filter: "dutch_required" };
  }

  // Language detection: if the title + JD body together detect as Dutch,
  // the role is a Dutch-speaking role regardless of whether it explicitly
  // says so. Catches fully-Dutch JDs (e.g. Leapforce Magnet.me posting)
  // and Dutch-title variants not in the word list (e.g. Opleidingscoördinator).
  const combined = `${title}\n${jd.slice(0, 2000)}`;
  if (combined.length > 100 && franc(combined, { minLength: 50 }) === "nld") {
    return { filter: "dutch_required" };
  }

  // Commute. Determine work mode from JD text, then check commute table.
  const workMode = detectWorkMode(jd);
  const verdict = checkCommute(input.location, workMode);
  if (!verdict.commutable) {
    return { filter: "commute_unreachable" };
  }

  return { filter: null };
}
