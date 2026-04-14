import type { RawJob } from "@/lib/sources/types";

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function computeDedupeHash(input: {
  companyName: string | null;
  title: string;
  location: string | null;
  postedAt: Date | null;
}): string {
  const co = normalize(input.companyName);
  const ti = normalize(input.title);
  const lo = normalize(input.location);
  const wk = input.postedAt ? isoWeek(input.postedAt) : "noweek";
  return `${co}|${ti}|${lo}|${wk}`;
}

export interface JobCluster {
  hash: string;
  canonical: RawJob;
  members: RawJob[];
}

// Higher rank = preferred canonical. Order chosen by quality of JD text + API reliability.
const SOURCE_RANK = new Map<string, number>([
  ["adzuna", 4],
  ["nvb", 3],
  ["magnetme", 2],
  ["jooble", 1],
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
