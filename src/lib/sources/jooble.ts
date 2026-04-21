import { loadSourcesEnv } from "@/lib/env";
import type { JobSource, RawJob } from "./types";
import { SEARCH_KEYWORDS } from "./keywords";

interface JoobleApiJob {
  id: number | string;
  link: string;
  title: string;
  snippet: string;
  company?: string;
  location?: string;
  updated?: string;
  source?: string;
  type?: string;
  salary?: string;
}

interface JoobleResponse {
  totalCount?: number;
  jobs?: JoobleApiJob[];
}

export function normalizeJooble(j: JoobleApiJob): RawJob {
  return {
    source: "jooble",
    sourceExternalId: String(j.id),
    sourceUrl: j.link,
    title: j.title,
    jdText: j.snippet,
    companyName: j.company && j.company.length > 0 ? j.company : null,
    companyDomain: null,
    location: j.location && j.location.length > 0 ? j.location : null,
    postedAt: j.updated ? new Date(j.updated.replace(" ", "T")) : null,
  };
}

const RESULTS_PER_PAGE = 50;

export class JoobleSource implements JobSource {
  readonly name = "jooble";

  async fetch(): Promise<RawJob[]> {
    const env = loadSourcesEnv();
    const out: RawJob[] = [];
    const seen = new Set<string>();

    for (const kw of SEARCH_KEYWORDS) {
      const res = await fetch(`https://jooble.org/api/${env.JOOBLE_API_KEY}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keywords: kw,
          location: "Netherlands",
          page: 1,
          ResultOnPage: RESULTS_PER_PAGE,
        }),
      });
      if (!res.ok) {
        console.warn(`[jooble] ${res.status} on "${kw}": ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const body = (await res.json()) as JoobleResponse;
      for (const j of body.jobs ?? []) {
        const key = String(j.id);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(normalizeJooble(j));
      }
    }
    return out;
  }
}
