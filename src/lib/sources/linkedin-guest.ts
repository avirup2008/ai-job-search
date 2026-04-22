// src/lib/sources/linkedin-guest.ts
//
// LinkedIn job source using public guest API endpoints.
// LinkedIn exposes unauthenticated search/detail endpoints for crawling by Google etc.
// No Apify, proxy, or login required.
//
// Endpoints:
//   Search: /jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=...&location=Netherlands&start=0
//   Detail: /jobs-guest/jobs/api/jobPosting/{jobId}
//
// Timing: designed to complete within 45s (discover.ts per-source budget).
// If LinkedIn blocks Vercel IPs, all requests return non-2xx and source returns [] gracefully.

import pLimit from "p-limit";
import { SEARCH_KEYWORDS } from "./keywords";
import type { JobSource, RawJob } from "./types";

const BASE = "https://www.linkedin.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SEARCH_CONCURRENCY = 4;
const DETAIL_CONCURRENCY = 3;
const MAX_DETAIL_FETCHES = 30;

interface JobCard {
  jobId: string;
  title: string;
  company: string | null;
  location: string | null;
  sourceUrl: string;
  postedAt: Date | null;
}

export function parseLinkedInSearchHtml(html: string): JobCard[] {
  const out: JobCard[] = [];
  const liMatches = html.match(/<li[^>]*>[\s\S]*?<\/li>/g) ?? [];

  for (const li of liMatches) {
    const idMatch = li.match(/urn:li:jobPosting:(\d+)/);
    if (!idMatch) continue;
    const jobId = idMatch[1];

    const urlMatch = li.match(
      /href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/
    );
    const sourceUrl = urlMatch?.[1] ?? `${BASE}/jobs/view/${jobId}`;

    const titleMatch = li.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    const title = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim();
    if (!title) continue;

    const companyMatch = li.match(/<h4[^>]*>([\s\S]*?)<\/h4>/);
    const company =
      companyMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || null;

    const locMatch = li.match(
      /class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/
    );
    const location = locMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || null;

    const dateMatch = li.match(/datetime="([^"]+)"/);
    const postedAt = dateMatch?.[1] ? new Date(dateMatch[1]) : null;

    out.push({ jobId, title, company, location, sourceUrl, postedAt });
  }

  return out;
}

export function parseLinkedInDetailHtml(html: string): string {
  const match =
    html.match(
      /<div[^>]*class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/
    ) ??
    html.match(
      /<div[^>]*class="[^"]*description__text[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
  return match?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";
}

export class LinkedInGuestSource implements JobSource {
  readonly name = "linkedin-guest";

  async fetch(): Promise<RawJob[]> {
    // Phase 1: search all keywords in parallel
    const searchLimit = pLimit(SEARCH_CONCURRENCY);
    const cardsByKeyword = await Promise.all(
      [...SEARCH_KEYWORDS].map((kw) =>
        searchLimit(async () => {
          try {
            const res = await fetch(
              `${BASE}/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(kw)}&location=Netherlands&start=0`,
              {
                headers: {
                  "user-agent": UA,
                  accept: "text/html,application/xhtml+xml,*/*",
                  "accept-language": "en-US,en;q=0.9",
                },
              }
            );
            if (!res.ok) {
              console.warn(`[linkedin-guest] search ${res.status} for "${kw}"`);
              return [] as JobCard[];
            }
            return parseLinkedInSearchHtml(await res.text());
          } catch (err) {
            console.warn(`[linkedin-guest] search error for "${kw}":`, err);
            return [] as JobCard[];
          }
        })
      )
    );

    // Deduplicate by job ID
    const seen = new Set<string>();
    const allCards: JobCard[] = [];
    for (const cards of cardsByKeyword) {
      for (const card of cards) {
        if (!seen.has(card.jobId)) {
          seen.add(card.jobId);
          allCards.push(card);
        }
      }
    }

    if (allCards.length === 0) return [];

    // Phase 2: fetch descriptions for first MAX_DETAIL_FETCHES jobs
    const detailLimit = pLimit(DETAIL_CONCURRENCY);
    const toFetch = allCards.slice(0, MAX_DETAIL_FETCHES);
    const rest = allCards.slice(MAX_DETAIL_FETCHES);

    const fetched = await Promise.all(
      toFetch.map((card) =>
        detailLimit(async () => {
          let jdText = "";
          try {
            const res = await fetch(
              `${BASE}/jobs-guest/jobs/api/jobPosting/${card.jobId}`,
              {
                headers: {
                  "user-agent": UA,
                  accept: "text/html,application/xhtml+xml,*/*",
                  "accept-language": "en-US,en;q=0.9",
                  referer: `${BASE}/jobs/search/`,
                },
              }
            );
            if (res.ok) jdText = parseLinkedInDetailHtml(await res.text());
          } catch {
            // keep empty jdText — job still included
          }

          return {
            source: "linkedin-guest",
            sourceExternalId: card.jobId,
            sourceUrl: card.sourceUrl,
            title: card.title,
            jdText,
            companyName: card.company,
            companyDomain: null,
            location: card.location,
            postedAt: card.postedAt,
          } satisfies RawJob;
        })
      )
    );

    // Include remaining cards without description
    const remaining: RawJob[] = rest.map((card) => ({
      source: "linkedin-guest",
      sourceExternalId: card.jobId,
      sourceUrl: card.sourceUrl,
      title: card.title,
      jdText: "",
      companyName: card.company,
      companyDomain: null,
      location: card.location,
      postedAt: card.postedAt,
    }));

    return [...fetched, ...remaining];
  }
}
