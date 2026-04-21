// Nationale Vacaturebank (NVB) job source. Largest traditional NL job board.
// Extraction strategy: JSON API at api.nationalevacaturebank.nl (no auth required).
// API path: /api/jobs/v3/sites/nationalevacaturebank.nl/jobs?query=...&limit=...&page=...
// Fixture at tests/fixtures/nvb-search.json (captured from ?query=marketing&limit=10).

import type { JobSource, RawJob } from "./types";
import { SEARCH_KEYWORDS } from "./keywords";

const API_BASE =
  "https://api.nationalevacaturebank.nl/api/jobs/v3/sites/nationalevacaturebank.nl";
const SITE_BASE = "https://www.nationalevacaturebank.nl";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const DELAY_MS = 1500;
const PAGE_LIMIT = 20;

// ---------------------------------------------------------------------------
// Types matching the NVB API response shape
// ---------------------------------------------------------------------------

interface NvbApiJob {
  id: string;
  title: string;
  company?: {
    name?: string;
    website?: string;
  } | null;
  workLocation?: {
    city?: string;
    displayName?: string;
    province?: string;
    country?: { iso?: string };
  } | null;
  description?: string | null;
  startDate?: string | null;
  _links?: {
    detail?: { href?: string };
  };
  referenceId?: string;
}

interface NvbApiResponse {
  page: number;
  limit: number;
  pages: number;
  total: number;
  _embedded: {
    jobs: NvbApiJob[];
  };
}

// ---------------------------------------------------------------------------
// Strip HTML tags to plain text for jdText.
// ---------------------------------------------------------------------------
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// parseNvbSearch — pure function, accepts the raw JSON string (or parsed object).
// Exported for unit testing against the fixture file.
// ---------------------------------------------------------------------------
export function parseNvbSearch(jsonText: string): RawJob[] {
  if (!jsonText) return [];

  let data: NvbApiResponse;
  try {
    data = JSON.parse(jsonText) as NvbApiResponse;
  } catch {
    return [];
  }

  const jobs = data?._embedded?.jobs;
  if (!Array.isArray(jobs)) return [];

  const out: RawJob[] = [];

  for (const job of jobs) {
    const id = job.id;
    if (!id) continue;

    const title = job.title?.trim();
    if (!title) continue;

    // Canonical detail URL from _links.detail, fallback to constructed URL
    const detailHref = job._links?.detail?.href;
    const sourceUrl = detailHref
      ? detailHref.startsWith("http")
        ? detailHref
        : `${SITE_BASE}${detailHref}`
      : `${SITE_BASE}/vacature/${encodeURIComponent(id)}`;

    // Company name — may be absent for anonymous listings
    const companyName = job.company?.name?.trim() || null;

    // Location — prefer displayName (human-readable), then city+country
    let location: string | null = null;
    const loc = job.workLocation;
    if (loc) {
      if (loc.displayName) {
        location = loc.displayName.trim() || null;
      } else {
        const parts: string[] = [];
        if (loc.city) parts.push(loc.city);
        if (loc.country?.iso) parts.push(loc.country.iso);
        location = parts.join(", ") || null;
      }
    }

    // Plain-text description
    const rawDesc = job.description ?? "";
    const jdText = rawDesc ? stripHtml(rawDesc) : "";

    // Posted date — NVB provides startDate (when listing went live)
    const postedAt = job.startDate ? new Date(job.startDate) : null;

    out.push({
      source: "nvb",
      sourceExternalId: id,
      sourceUrl,
      title,
      jdText,
      companyName,
      companyDomain: null,
      location,
      postedAt,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// NvbSource — fetches one page per keyword with polite delay + within-source dedup.
// ---------------------------------------------------------------------------
export class NvbSource implements JobSource {
  readonly name = "nvb";

  async fetch(): Promise<RawJob[]> {
    const out: RawJob[] = [];
    const seen = new Set<string>();

    for (const kw of SEARCH_KEYWORDS) {
      const url = new URL(`${API_BASE}/jobs`);
      url.searchParams.set("query", kw);
      url.searchParams.set("limit", String(PAGE_LIMIT));
      url.searchParams.set("page", "1");

      let res: Response;
      try {
        res = await fetch(url.toString(), {
          headers: {
            accept: "application/json",
            "user-agent": UA,
            "x-source": "Job Board NationaleVacaturebank.nl",
            "accept-language": "nl-NL,nl;q=0.9,en;q=0.8",
          },
        });
      } catch (err) {
        console.warn(`[nvb] network error on "${kw}":`, err);
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        console.warn(`[nvb] ${res.status} on "${kw}": ${body.slice(0, 200)}`);
        continue;
      }

      const jsonText = await res.text();
      for (const j of parseNvbSearch(jsonText)) {
        if (seen.has(j.sourceExternalId)) continue;
        seen.add(j.sourceExternalId);
        out.push(j);
      }

      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    return out;
  }
}
