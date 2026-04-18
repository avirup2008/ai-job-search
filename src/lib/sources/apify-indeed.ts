// Indeed NL source via Apify — uses the misceres/indeed-scraper actor.
// The public RSS feed was blocked by Cloudflare in April 2026; Apify bypasses it.
//
// Budget: ~$3/1,000 results. 5 keywords × 10 results = 50/day → ~$4.50/month.
// Stays within the $5/month Apify free tier.
//
// Actor docs: https://apify.com/misceres/indeed-scraper

import type { JobSource, RawJob } from "./types";

const ACTOR_ID = "misceres~indeed-scraper";
const APIFY_BASE = "https://api.apify.com/v2";

const KEYWORDS = [
  "marketing automation",
  "CRM marketing",
  "email marketing",
  "HubSpot",
  "growth marketing",
] as const;

const MAX_ITEMS_PER_KEYWORD = 10;
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 20; // 100s max wait per keyword

// ---------------------------------------------------------------------------
// Data mapping — exported for unit testing.
// ---------------------------------------------------------------------------

interface ApifyIndeedItem {
  id: string;
  positionName: string;
  company: string | null;
  location: string | null;
  url: string;
  description: string | null;
  postingDateParsed: string | null;
}

export function mapApifyItem(item: ApifyIndeedItem): RawJob {
  return {
    source: "indeed-nl",
    sourceExternalId: item.id,
    sourceUrl: item.url || `https://nl.indeed.com/viewjob?jk=${item.id}`,
    title: item.positionName,
    jdText: item.description ?? "",
    companyName: item.company ?? null,
    companyDomain: null,
    location: item.location ?? null,
    postedAt: item.postingDateParsed ? new Date(item.postingDateParsed) : null,
  };
}

// ---------------------------------------------------------------------------
// ApifyIndeedSource
// ---------------------------------------------------------------------------

export class ApifyIndeedSource implements JobSource {
  readonly name = "indeed-nl";

  private get token(): string {
    const t = process.env.APIFY_API_TOKEN;
    if (!t) throw new Error("APIFY_API_TOKEN env var is not set");
    return t;
  }

  async fetch(): Promise<RawJob[]> {
    const out: RawJob[] = [];
    const seen = new Set<string>();

    for (const keyword of KEYWORDS) {
      try {
        const items = await this.fetchKeyword(keyword);
        for (const item of items) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          out.push(mapApifyItem(item));
        }
      } catch (err) {
        console.warn(`[apify-indeed] error for "${keyword}":`, err);
      }
    }

    return out;
  }

  private async fetchKeyword(keyword: string): Promise<ApifyIndeedItem[]> {
    // 1. Start actor run
    const startRes = await fetch(
      `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${this.token}&memory=256`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: keyword,
          location: "Nederland",
          country: "NL",
          maxItems: MAX_ITEMS_PER_KEYWORD,
        }),
      }
    );

    if (!startRes.ok) {
      throw new Error(`[apify-indeed] actor start HTTP ${startRes.status} for "${keyword}"`);
    }

    const startData = (await startRes.json()) as {
      data: { id: string; defaultDatasetId: string };
    };
    const { id: runId, defaultDatasetId } = startData.data;

    // 2. Poll until SUCCEEDED / FAILED
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const pollRes = await fetch(
        `${APIFY_BASE}/acts/${ACTOR_ID}/runs/${runId}?token=${this.token}`
      );
      const pollData = (await pollRes.json()) as { data: { status: string } };
      const { status } = pollData.data;

      if (status === "SUCCEEDED") break;
      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        throw new Error(`[apify-indeed] run ${status} for "${keyword}"`);
      }
      // RUNNING / READY → keep polling
    }

    // 3. Fetch dataset items
    const itemsRes = await fetch(
      `${APIFY_BASE}/datasets/${defaultDatasetId}/items?token=${this.token}&format=json`
    );

    if (!itemsRes.ok) {
      throw new Error(`[apify-indeed] dataset fetch HTTP ${itemsRes.status} for "${keyword}"`);
    }

    return (await itemsRes.json()) as ApifyIndeedItem[];
  }
}
