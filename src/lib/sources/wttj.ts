// Welcome to the Jungle (WTTJ) — formerly Otta.com (acquired 2023).
// NL-focused tech/scale-up job board. Strong overlap with Upashana's target market.
//
// Scrape strategy: WTTJ search is a React SPA backed by Algolia. Their public
// search-only API key is baked into the page's window.env — this is intentional;
// Algolia search-only keys are read-only and safe to ship. We hit Algolia directly
// for clean JSON with all fields, no HTML parsing required.
//
// App ID: CSEKHVMS53 | Index: wttj_jobs_production_en
// Budget: free (Algolia search hits the CDN edge, no account required).

import type { JobSource, RawJob } from "./types";
import { SEARCH_KEYWORDS } from "./keywords";

const ALGOLIA_APP_ID = "CSEKHVMS53";
const ALGOLIA_SEARCH_KEY = "4bd8f6215d0cc52b26430765769e65a0";
const ALGOLIA_INDEX = "wttj_jobs_production_en";
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`;

const HITS_PER_PAGE = 20;
const NL_FILTER = "offices.country_code:NL";

// ---------------------------------------------------------------------------
// Algolia hit type — only the fields we use
// ---------------------------------------------------------------------------

interface WttjOffice {
  city?: string;
  country?: string;
  country_code?: string;
}

interface WttjOrganization {
  name?: string;
  slug?: string;
}

interface WttjHit {
  objectID: string;
  slug?: string;
  name?: string;
  summary?: string;
  published_at?: string;
  organization?: WttjOrganization;
  offices?: WttjOffice[];
  contract_type?: string;
  remote?: string;
}

// ---------------------------------------------------------------------------
// Mapping — exported for unit testing
// ---------------------------------------------------------------------------

export function mapWttjHit(hit: WttjHit): RawJob {
  const companySlug = hit.organization?.slug ?? "";
  const jobSlug = hit.slug ?? hit.objectID;
  const sourceUrl = `https://www.welcometothejungle.com/en/companies/${companySlug}/jobs/${jobSlug}`;

  // Prefer first NL office, fallback to first office available
  const office =
    hit.offices?.find((o) => o.country_code === "NL") ?? hit.offices?.[0];
  const location = [office?.city, office?.country].filter(Boolean).join(", ") || null;

  return {
    source: "wttj",
    sourceExternalId: hit.objectID,
    sourceUrl,
    title: hit.name ?? "",
    jdText: hit.summary ?? "",
    companyName: hit.organization?.name ?? null,
    companyDomain: null,
    location,
    postedAt: hit.published_at ? new Date(hit.published_at) : null,
  };
}

// ---------------------------------------------------------------------------
// WttjSource
// ---------------------------------------------------------------------------

export class WttjSource implements JobSource {
  readonly name = "wttj";

  async fetch(): Promise<RawJob[]> {
    const out: RawJob[] = [];
    const seen = new Set<string>();

    for (const keyword of SEARCH_KEYWORDS) {
      try {
        const hits = await this.search(keyword);
        for (const hit of hits) {
          if (!hit.objectID || seen.has(hit.objectID)) continue;
          seen.add(hit.objectID);
          out.push(mapWttjHit(hit));
        }
      } catch (err) {
        console.warn(`[wttj] error for "${keyword}":`, err);
      }
    }

    return out;
  }

  private async search(query: string): Promise<WttjHit[]> {
    const res = await fetch(ALGOLIA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Algolia-Application-Id": ALGOLIA_APP_ID,
        "X-Algolia-API-Key": ALGOLIA_SEARCH_KEY,
        Referer: "https://www.welcometothejungle.com/",
        Origin: "https://www.welcometothejungle.com",
      },
      body: JSON.stringify({
        query,
        filters: NL_FILTER,
        hitsPerPage: HITS_PER_PAGE,
        page: 0,
      }),
    });

    if (!res.ok) {
      throw new Error(`[wttj] Algolia HTTP ${res.status} for "${query}"`);
    }

    const body = (await res.json()) as { hits?: WttjHit[] };
    return body.hits ?? [];
  }
}
