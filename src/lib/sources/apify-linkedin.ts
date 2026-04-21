// LinkedIn Jobs NL source via Apify — uses the curious_coder/linkedin-jobs-scraper actor.
// LinkedIn blocks direct server-side fetches; Apify bypasses via managed browser.
//
// Budget: $1/1,000 results. 5 keywords × 10 results = 50/run → $0.05/run → well within
// the $5/month Apify free tier credit. No subscription required (pay-per-result).
//
// Actor docs: https://apify.com/curious_coder/linkedin-jobs-scraper
// Input: LinkedIn Jobs search URLs (not keyword strings). URLs are constructed below.
// scrapeCompany: false — saves credits, we only need the job listing data.

import type { JobSource, RawJob } from "./types";

const ACTOR_ID = "curious_coder~linkedin-jobs-scraper";
const APIFY_BASE = "https://api.apify.com/v2";

// Build a LinkedIn Jobs search URL for a keyword in the Netherlands.
// f_TPR=r604800 = past 7 days, so a daily cron never misses a posting.
function buildLinkedInUrl(keyword: string): string {
  const url = new URL("https://www.linkedin.com/jobs/search/");
  url.searchParams.set("keywords", keyword);
  url.searchParams.set("location", "Netherlands");
  url.searchParams.set("f_TPR", "r604800"); // past week
  return url.toString();
}

// Targeted at Upashana's profile: marketing ops / CRM / campaign management.
// Avoid broad terms ("marketing") that pull in data analyst / research roles.
const KEYWORDS = [
  "marketing automation",
  "CRM specialist",
  "HubSpot",
  "campaign manager",
  "email marketing manager",
] as const;

const MAX_ITEMS_PER_URL = 10;
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 18; // 90s max — enough (~45s observed in test); fail gracefully if slower

// ---------------------------------------------------------------------------
// Data mapping — exported for unit testing.
// Output fields from curious_coder actor (different from bebity):
//   id, title, companyName, location, link, descriptionText, postedAt
// ---------------------------------------------------------------------------

interface ApifyLinkedInItem {
  id: string;
  title: string;
  companyName: string | null;
  location: string | null;
  link: string;           // job URL (not "jobUrl")
  descriptionText: string | null;  // plain text (not "description")
  postedAt: string | null;
}

export function mapLinkedInItem(item: ApifyLinkedInItem): RawJob {
  return {
    source: "linkedin",
    sourceExternalId: item.id,
    sourceUrl: item.link,
    title: item.title,
    jdText: item.descriptionText ?? "",
    companyName: item.companyName ?? null,
    companyDomain: null,
    location: item.location ?? null,
    postedAt: item.postedAt ? new Date(item.postedAt) : null,
  };
}

// ---------------------------------------------------------------------------
// ApifyLinkedInSource — runs ONE actor with all keyword URLs in a single batch.
// More efficient than one run per keyword (fewer Apify actor starts).
// ---------------------------------------------------------------------------

export class ApifyLinkedInSource implements JobSource {
  readonly name = "linkedin";

  private get token(): string {
    const t = process.env.APIFY_API_TOKEN;
    if (!t) throw new Error("APIFY_API_TOKEN env var is not set");
    return t;
  }

  async fetch(): Promise<RawJob[]> {
    const urls = KEYWORDS.map(buildLinkedInUrl);
    let items: ApifyLinkedInItem[];
    try {
      items = await this.runActor(urls);
    } catch (err) {
      console.warn("[apify-linkedin] actor run failed:", err);
      return [];
    }

    const out: RawJob[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (!item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(mapLinkedInItem(item));
    }
    return out;
  }

  // Exported as public for the admin test endpoint (tests a single URL).
  async runActor(urls: string[]): Promise<ApifyLinkedInItem[]> {
    // 1. Start actor run
    const startRes = await fetch(
      `${APIFY_BASE}/acts/${ACTOR_ID}/runs?token=${this.token}&memory=256`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls,
          count: MAX_ITEMS_PER_URL,
          scrapeCompany: false,  // saves Apify credits
        }),
      }
    );

    if (!startRes.ok) {
      throw new Error(`[apify-linkedin] actor start HTTP ${startRes.status}`);
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
        throw new Error(`[apify-linkedin] run ${status}`);
      }
      // RUNNING / READY → keep polling
    }

    // 3. Fetch dataset items
    const itemsRes = await fetch(
      `${APIFY_BASE}/datasets/${defaultDatasetId}/items?token=${this.token}&format=json`
    );

    if (!itemsRes.ok) {
      throw new Error(`[apify-linkedin] dataset fetch HTTP ${itemsRes.status}`);
    }

    return (await itemsRes.json()) as ApifyLinkedInItem[];
  }
}
