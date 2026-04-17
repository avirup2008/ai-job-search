// Indeed Netherlands job source. Largest NL job board.
// Extraction strategy: parse window.mosaic.providerData["mosaic-provider-jobcards"] from HTML.
// Search URL: https://nl.indeed.com/vacatures?q=<keyword>&l=Nederland&sort=date
// Fixture at tests/fixtures/indeed-nl-search.html (synthetic, matches confirmed JSON shape).

import type { JobSource, RawJob } from "./types";

// Regex anchored to </script> to avoid swallowing subsequent JS.
const MOSAIC_PATTERN =
  /window\.mosaic\.providerData\["mosaic-provider-jobcards"\]=(\{[\s\S]*?\});\s*<\/script>/;

// ---------------------------------------------------------------------------
// parseIndeedNlSearch — pure function, accepts raw HTML string.
// Exported for unit testing against the fixture file.
// ---------------------------------------------------------------------------
export function parseIndeedNlSearch(html: string): RawJob[] {
  if (!html) return [];

  let match = html.match(MOSAIC_PATTERN);

  // Fallback: bracket-balancing from the marker, in case </script> anchor fails
  if (!match) {
    const marker = 'window.mosaic.providerData["mosaic-provider-jobcards"]=';
    const markerIdx = html.indexOf(marker);
    if (markerIdx !== -1) {
      const raw = html.slice(markerIdx + marker.length);
      // Find the outermost { ... } using bracket balancing
      let depth = 0;
      let inString = false;
      let escapeNext = false;
      let jsonEnd = -1;
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (escapeNext) { escapeNext = false; continue; }
        if (ch === "\\") { escapeNext = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) { jsonEnd = i; break; }
        }
      }
      if (jsonEnd !== -1) {
        // Simulate a match-like structure with the captured JSON blob
        match = [null, raw.slice(0, jsonEnd + 1)] as unknown as RegExpMatchArray;
      }
    }
  }

  if (!match) return [];

  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }

  const results = (
    data as {
      metaData?: {
        mosaicProviderJobCardsModel?: { results?: unknown[] };
      };
    }
  )?.metaData?.mosaicProviderJobCardsModel?.results;

  if (!Array.isArray(results)) return [];

  return results.flatMap((r: unknown) => {
    const job = r as Record<string, unknown>;
    const jobkey = job.jobkey;
    const title = job.title;

    // Require both jobkey and title as non-empty strings
    if (typeof jobkey !== "string" || !jobkey) return [];
    if (typeof title !== "string" || !title.trim()) return [];

    // Build sourceUrl
    const viewJobLink = job.viewJobLink as string | undefined;
    let sourceUrl: string;
    if (viewJobLink && typeof viewJobLink === "string") {
      sourceUrl = viewJobLink.startsWith("http")
        ? viewJobLink
        : `https://nl.indeed.com${viewJobLink}`;
    } else {
      sourceUrl = `https://nl.indeed.com/viewjob?jk=${jobkey}`;
    }

    // Strip HTML tags from snippet → jdText
    const snippet = job.snippet as string | undefined;
    const jdText = snippet
      ? snippet.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
      : "";

    // Company name and location — null if missing
    const companyRaw = job.company;
    const companyName =
      typeof companyRaw === "string" && companyRaw.trim() ? companyRaw.trim() : null;

    const locationRaw = job.formattedLocation;
    const location =
      typeof locationRaw === "string" && locationRaw.trim() ? locationRaw.trim() : null;

    return [
      {
        source: "indeed-nl",
        sourceExternalId: jobkey,
        sourceUrl,
        title: title.trim(),
        jdText,
        companyName,
        companyDomain: null,
        location,
        postedAt: null, // formattedRelativeTime ("2 days ago") not reliably parseable to Date
      } satisfies RawJob,
    ];
  });
}

// ---------------------------------------------------------------------------
// IndeedNlSource — fetches one search page per keyword with polite delay + dedup.
// ---------------------------------------------------------------------------

const BASE = "https://nl.indeed.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const KEYWORDS = [
  "marketing automation",
  "CRM marketing",
  "email marketing",
  "HubSpot",
  "growth marketing",
  "digital marketing",
] as const;

const DELAY_MS = 1500;

function buildSearchUrl(keyword: string): string {
  const url = new URL(`${BASE}/vacatures`);
  url.searchParams.set("q", keyword);
  url.searchParams.set("l", "Nederland");
  url.searchParams.set("sort", "date");
  return url.toString();
}

export class IndeedNlSource implements JobSource {
  readonly name = "indeed-nl";

  async fetch(): Promise<RawJob[]> {
    const out: RawJob[] = [];
    const seen = new Set<string>();

    for (const kw of KEYWORDS) {
      const url = buildSearchUrl(kw);
      let res: Response;
      try {
        res = await fetch(url, {
          headers: {
            "user-agent": UA,
            accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "nl-NL,nl;q=0.9,en;q=0.8",
            "accept-encoding": "gzip, deflate, br",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "none",
          },
        });
      } catch (err) {
        console.warn(`[indeed-nl] network error on "${kw}":`, err);
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        console.warn(
          `[indeed-nl] ${res.status} on "${kw}": ${body.slice(0, 200)}`
        );
        continue;
      }

      const html = await res.text();
      if (!html.includes("mosaic-provider-jobcards")) {
        console.warn(
          `[indeed-nl] mosaic data not found for "${kw}" (likely Cloudflare challenge)`
        );
        continue;
      }

      for (const j of parseIndeedNlSearch(html)) {
        if (seen.has(j.sourceExternalId)) continue;
        seen.add(j.sourceExternalId);
        out.push(j);
      }

      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    return out;
  }
}
