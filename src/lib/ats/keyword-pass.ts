import type { CvStruct } from "@/lib/generate/cv-types";
import { escapeRegex } from "@/lib/analytics/keywords";

export const ATS_MAX_INJECT = 5;
export const ATS_MIN_JD_FREQUENCY = 2;
export const ATS_MAX_JD_CHARS = 10000;
const MAX_GROUPS = 5;

const STOP_WORDS = new Set([
  "experience", "required", "skills", "team", "work", "role", "job", "strong",
  "ability", "knowledge", "understanding", "responsibilities", "requirements",
  "including", "across", "through", "ensure", "drive", "support", "manage",
  "year", "years", "and", "the", "with", "for", "you", "our", "this", "that",
  "will", "are", "has", "have", "can", "from", "into", "your", "their",
]);

export interface AtsPassResult {
  cv: CvStruct;
  injected: string[];
  candidates: number;
}

function tokenizeJd(jd: string): Map<string, { original: string; count: number }> {
  const trimmed = jd.slice(0, ATS_MAX_JD_CHARS);
  const tokenRe = /[A-Za-z][A-Za-z0-9\/\-\+]{1,30}/g;
  const words = trimmed.match(tokenRe) ?? [];
  const counts = new Map<string, { original: string; count: number }>();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const lw = w.toLowerCase();
    if (STOP_WORDS.has(lw)) continue;
    if (lw.length < 3 && !/^[A-Z]/.test(w)) continue;
    const prev = counts.get(lw);
    if (prev) prev.count++;
    else counts.set(lw, { original: w, count: 1 });
  }
  return counts;
}

function isInSkills(token: string, cv: CvStruct): boolean {
  const re = new RegExp("\\b" + escapeRegex(token) + "\\b", "i");
  for (const g of cv.skillsGrouped) {
    for (const item of g.items) {
      if (re.test(item)) return true;
    }
  }
  return false;
}

export function atsKeywordPass(cv: CvStruct, jdText: string): AtsPassResult {
  const counts = tokenizeJd(jdText);
  const candidates = counts.size;
  const missing: Array<{ token: string; original: string; count: number }> = [];
  for (const [token, entry] of counts) {
    if (entry.count < ATS_MIN_JD_FREQUENCY) continue;
    if (isInSkills(entry.original, cv)) continue;
    missing.push({ token, original: entry.original, count: entry.count });
  }
  missing.sort((a, b) => b.count - a.count);
  const picked = missing.slice(0, ATS_MAX_INJECT).map((m) => m.original);
  if (picked.length === 0) {
    return { cv, injected: [], candidates };
  }
  const nextGroups = cv.skillsGrouped.map((g) => ({ group: g.group, items: [...g.items] }));
  const targetIdx = nextGroups.findIndex((g) => /skill|tool/i.test(g.group));
  if (targetIdx >= 0) {
    nextGroups[targetIdx].items.push(...picked);
  } else if (nextGroups.length < MAX_GROUPS) {
    nextGroups.push({ group: "Additional Skills", items: picked });
  } else {
    nextGroups[nextGroups.length - 1].items.push(...picked);
  }
  return {
    cv: { ...cv, skillsGrouped: nextGroups },
    injected: picked,
    candidates,
  };
}
