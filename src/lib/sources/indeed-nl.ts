// Indeed Netherlands job source — uses the public RSS feed.
// RSS is designed for machine consumption and is not protected by Cloudflare.
// Feed URL: https://nl.indeed.com/rss?q=<keyword>&l=Nederland
//
// RSS item shape:
//   <title>Job Title - Company Name</title>
//   <link>https://nl.indeed.com/viewjob?jk=abc123&...</link>
//   <description><![CDATA[...snippet...]]></description>
//   <pubDate>Fri, 17 Apr 2026 00:00:00 GMT</pubDate>
//   <guid>https://nl.indeed.com/viewjob?jk=abc123...</guid>

import type { JobSource, RawJob } from "./types";

// ---------------------------------------------------------------------------
// parseIndeedNlRss — pure function, exported for unit testing.
// ---------------------------------------------------------------------------
export function parseIndeedNlRss(xml: string): RawJob[] {
  if (!xml) return [];

  const items = xml.match(/<item>[\s\S]*?<\/item>/g);
  if (!items) return [];

  return items.flatMap((item) => {
    // Extract jobkey from link/guid (jk=<key>)
    const linkMatch = item.match(/<link>([^<]+)<\/link>/);
    const link = linkMatch?.[1]?.trim() ?? "";
    const jkMatch = link.match(/[?&]jk=([a-z0-9]+)/i);
    const jobkey = jkMatch?.[1];
    if (!jobkey) return [];

    // Title: "Job Title - Company Name" (Indeed's standard format)
    const titleRaw = item
      .match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([^<]+)<\/title>/)?.[1]
      ?? item.match(/<title>([^<]+)<\/title>/)?.[1]
      ?? "";
    const parts = titleRaw.trim().split(" - ");
    const title = parts[0]?.trim();
    const companyName = parts[1]?.trim() ?? null;

    if (!title) return [];

    // Description (snippet)
    const descMatch = item.match(
      /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([^<]*)<\/description>/
    );
    const descRaw = (descMatch?.[1] ?? descMatch?.[2] ?? "").trim();
    // Strip any remaining HTML tags from description
    const jdText = descRaw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    // Source URL — prefer link, fall back to guid
    const sourceUrl = link || `https://nl.indeed.com/viewjob?jk=${jobkey}`;

    return [
      {
        source: "indeed-nl",
        sourceExternalId: jobkey,
        sourceUrl,
        title,
        jdText,
        companyName,
        companyDomain: null,
        location: null, // RSS feed doesn't include structured location
        postedAt: null,
      } satisfies RawJob,
    ];
  });
}

// ---------------------------------------------------------------------------
// IndeedNlSource — fetches RSS feed per keyword with polite delay + dedup.
// ---------------------------------------------------------------------------

const BASE = "https://nl.indeed.com";

const KEYWORDS = [
  "marketing automation",
  "CRM marketing",
  "email marketing",
  "HubSpot",
  "growth marketing",
  "digital marketing",
] as const;

const DELAY_MS = 1500;

function buildRssUrl(keyword: string): string {
  const url = new URL(`${BASE}/rss`);
  url.searchParams.set("q", keyword);
  url.searchParams.set("l", "Nederland");
  return url.toString();
}

export class IndeedNlSource implements JobSource {
  readonly name = "indeed-nl";

  async fetch(): Promise<RawJob[]> {
    const out: RawJob[] = [];
    const seen = new Set<string>();

    for (const kw of KEYWORDS) {
      const url = buildRssUrl(kw);
      let res: Response;
      try {
        res = await fetch(url, {
          headers: {
            accept: "application/rss+xml, application/xml, text/xml, */*",
            "user-agent":
              "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          },
        });
      } catch (err) {
        console.warn(`[indeed-nl] network error on "${kw}":`, err);
        continue;
      }

      if (!res.ok) {
        console.warn(`[indeed-nl] HTTP ${res.status} on "${kw}"`);
        continue;
      }

      const xml = await res.text();
      if (!xml.includes("<item>")) {
        console.warn(`[indeed-nl] no items in RSS for "${kw}"`);
        continue;
      }

      for (const j of parseIndeedNlRss(xml)) {
        if (seen.has(j.sourceExternalId)) continue;
        seen.add(j.sourceExternalId);
        out.push(j);
      }

      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    return out;
  }
}
