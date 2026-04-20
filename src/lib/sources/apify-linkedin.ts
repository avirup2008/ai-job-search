// LinkedIn Jobs NL source via Apify — uses the bebity/linkedin-jobs-scraper actor.
// LinkedIn blocks direct server-side fetches; Apify bypasses via managed browser.
//
// Budget: ~$3–4/1,000 results. 5 keywords × 10 results = 50/run → ~$4.50/month.
// Stays within the $5/month Apify free tier alongside the Indeed actor.
//
// Actor docs: https://apify.com/bebity/linkedin-jobs-scraper
// Note: LinkedIn occasionally updates their DOM; if results stop coming in check
// the actor run logs in the Apify console.

import type { JobSource, RawJob } from "./types";

const ACTOR_ID = "bebity~linkedin-jobs-scraper";
const APIFY_BASE = "https://api.apify.com/v2";

// Targeted at Upashana's profile: marketing ops / CRM / campaign management.
// Avoid broad terms ("marketing") that pull in data analyst / research roles.
const KEYWORDS = [
  "marketing automation",
  "CRM specialist",
  "HubSpot",
  "campaign manager",
  "email marketing manager",
] as const;

const MAX_ITEMS_PER_KEYWORD = 10;
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 30; // 150s max — LinkedIn needs browser rendering, slower than Indeed

// ---------------------------------------------------------------------------
// Data mapping — exported for unit testing.
// ---------------------------------------------------------------------------

interface ApifyLinkedInItem {
  id: string;
  title: string;
  companyName: string | null;
  location: string | null;
  jobUrl: string;
  description: string | null;
  publishedAt: string | null;
}

export function mapLinkedInItem(item: ApifyLinkedInItem): RawJob {
  return {
    source: "linkedin",
    sourceExternalId: item.id,
    sourceUrl: item.jobUrl,
    title: item.title,
    jdText: item.description ?? "",
    companyName: item.companyName ?? null,
    companyDomain: null,
    location: item.location ?? null,
    postedAt: item.publishedAt ? new Date(item.publishedAt) : null,
  };
}

// ---------------------------------------------------------------------------
// ApifyLinkedInSource
// ---------------------------------------------------------------------------

export class ApifyLinkedInSource implements JobSource {
  readonly name = "linkedin";

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
          out.push(mapLinkedInItem(item));
        }
      } catch (err) {
        console.warn(`[apify-linkedin] error for "${keyword}":`, err);
      }
    }

    return out;
  }

  private async fetchKeyword(keyword: string): Promise<ApifyLinkedInItem[]> {
    // 1. Start actor run
    const startRes = await fetch(
      `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${this.token}&memory=256`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: [{ keyword, location: "Netherlands" }],
          resultsLimit: MAX_ITEMS_PER_KEYWORD,
        }),
      }
    );

    if (!startRes.ok) {
      throw new Error(`[apify-linkedin] actor start HTTP ${startRes.status} for "${keyword}"`);
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
        throw new Error(`[apify-linkedin] run ${status} for "${keyword}"`);
      }
      // RUNNING / READY → keep polling
    }

    // 3. Fetch dataset items
    const itemsRes = await fetch(
      `${APIFY_BASE}/datasets/${defaultDatasetId}/items?token=${this.token}&format=json`
    );

    if (!itemsRes.ok) {
      throw new Error(`[apify-linkedin] dataset fetch HTTP ${itemsRes.status} for "${keyword}"`);
    }

    return (await itemsRes.json()) as ApifyLinkedInItem[];
  }
}
