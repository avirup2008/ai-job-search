import type { RawJob } from "@/lib/sources/types";

function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Aggressive title normalization — collapse cross-source variations into
// a single canonical form for dedupe. Strip:
//   - Parenthetical qualifiers: "(m/f)", "(Dutch Speaking)", "(Remote)"
//   - Pipe/dash suffixes: " | Agri", " - Amsterdam"
//   - Level prefixes: Senior, Junior, Lead, Staff, Principal, Associate
//   - Trailing "bij <Company>" (Dutch "at <Company>")
//   - Language specifiers: "Spanish Speaking", "German-speaking"
function normalizeTitleCore(title: string, companyName: string | null): string {
  let t = title.toLowerCase();
  // Strip parentheticals: (Dutch Speaking), (m/f), (Remote)
  t = t.replace(/\([^)]*\)/g, " ");
  // Strip pipe + trailing content
  t = t.replace(/[|]\s*.*$/g, " ");
  // Strip trailing " - City" or " – City"
  t = t.replace(/\s+[-–—]\s+.+$/g, " ");
  // Strip "bij <Company>" Dutch pattern
  if (companyName) {
    const co = companyName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    t = t.replace(new RegExp(`\\s+bij\\s+${co.split(" ").join("\\s+")}\\s*$`, "i"), " ");
    // Also strip trailing bare company name
    t = t.replace(new RegExp(`\\s+${co.split(" ").join("\\s+")}\\s*$`, "i"), " ");
  }
  // Strip level prefixes
  t = t.replace(/^\s*(senior|junior|lead|staff|principal|associate|jr\.?|sr\.?)\s+/i, "");
  // Strip language specifiers
  t = t.replace(/\b(spanish|german|french|italian|dutch|english)[-\s]speaking\b/gi, " ");
  // Final normalize
  return t.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function computeDedupeHash(input: {
  companyName: string | null;
  title: string;
  location: string | null;  // kept in signature for backward compat; not used in hash
  postedAt: Date | null;
}): string {
  const co = (input.companyName ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const ti = normalizeTitleCore(input.title, input.companyName);
  const wk = input.postedAt ? isoWeek(input.postedAt) : "noweek";
  return `${co}|${ti}|${wk}`;
}

export interface JobCluster {
  hash: string;
  canonical: RawJob;
  members: RawJob[];
}

// Higher rank = preferred canonical. Order chosen by quality of JD text + API reliability.
const SOURCE_RANK = new Map<string, number>([
  ["linkedin-guest", 5], // LinkedIn JDs are typically complete
  ["adzuna", 4],
  ["nvb", 3],
  ["magnetme", 2],
  ["wttj", 2],
  ["jooble", 1],
  ["indeed-nl", 1],
]);

export function clusterJobs(jobs: RawJob[]): JobCluster[] {
  const buckets = new Map<string, RawJob[]>();
  for (const j of jobs) {
    const h = computeDedupeHash({
      companyName: j.companyName,
      title: j.title,
      location: j.location,
      postedAt: j.postedAt,
    });
    const arr = buckets.get(h) ?? [];
    arr.push(j);
    buckets.set(h, arr);
  }
  const out: JobCluster[] = [];
  for (const [hash, members] of buckets.entries()) {
    members.sort((a, b) => {
      const rDiff = (SOURCE_RANK.get(b.source) ?? 0) - (SOURCE_RANK.get(a.source) ?? 0);
      if (rDiff !== 0) return rDiff;
      return (b.jdText?.length ?? 0) - (a.jdText?.length ?? 0);
    });
    out.push({ hash, canonical: members[0], members });
  }
  return out;
}
