import { loadEnv } from "@/lib/env";
import type { JobSource, RawJob } from "./types";

interface AdzunaApiJob {
  id: string;
  redirect_url: string;
  title: string;
  description: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  created?: string;
}

interface AdzunaSearchResponse {
  results?: AdzunaApiJob[];
  count?: number;
}

export function normalizeAdzuna(j: AdzunaApiJob): RawJob {
  return {
    source: "adzuna",
    sourceExternalId: j.id,
    sourceUrl: j.redirect_url,
    title: j.title,
    jdText: j.description,
    companyName: j.company?.display_name ?? null,
    companyDomain: null,
    location: j.location?.display_name ?? null,
    postedAt: j.created ? new Date(j.created) : null,
  };
}

// NL marketing keywords — can be extended later via profile.preferences.roleFamilies
const KEYWORDS = [
  "marketing automation",
  "CRM marketing",
  "email marketing",
  "digital marketing",
  "HubSpot",
  "growth marketing",
  "paid media",
  "marketing manager",
] as const;

const MAX_PAGES = 2;        // 2 × 50 = 100 results per keyword
const RESULTS_PER_PAGE = 50;
const MAX_DAYS_OLD = 14;

export class AdzunaSource implements JobSource {
  readonly name = "adzuna";

  async fetch(): Promise<RawJob[]> {
    const env = loadEnv();
    const out: RawJob[] = [];
    const seen = new Set<string>();

    for (const kw of KEYWORDS) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const url = new URL(`https://api.adzuna.com/v1/api/jobs/nl/search/${page}`);
        url.searchParams.set("app_id", env.ADZUNA_APP_ID);
        url.searchParams.set("app_key", env.ADZUNA_APP_KEY);
        url.searchParams.set("results_per_page", String(RESULTS_PER_PAGE));
        url.searchParams.set("what", kw);
        url.searchParams.set("content-type", "application/json");
        url.searchParams.set("max_days_old", String(MAX_DAYS_OLD));

        const res = await fetch(url, { headers: { accept: "application/json" } });
        if (!res.ok) {
          console.warn(`[adzuna] ${res.status} on "${kw}" page ${page}: ${(await res.text()).slice(0, 200)}`);
          break;
        }
        const body = (await res.json()) as AdzunaSearchResponse;
        const results = body.results ?? [];
        if (results.length === 0) break;

        for (const j of results) {
          // Within-source dedup by id (same job may match multiple keywords)
          if (seen.has(j.id)) continue;
          seen.add(j.id);
          out.push(normalizeAdzuna(j));
        }

        if (results.length < RESULTS_PER_PAGE) break; // last page
      }
    }
    return out;
  }
}
