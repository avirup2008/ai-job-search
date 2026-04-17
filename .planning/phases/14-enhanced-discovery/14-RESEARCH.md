# Phase 14: Enhanced Discovery — Research

**Researched:** 2026-04-17
**Domain:** Web scraping (Indeed NL), URL queue pipeline, Next.js App Router
**Confidence:** MEDIUM — Indeed NL structure confirmed via multiple sources; anti-bot risk is real but manageable at personal-project scale

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R-81 | Indeed Netherlands added as discovery source via free HTML scraping; normalises to `RawJob`; polite delay; fixture-based tests | Indeed stores job data in `window.mosaic.providerData["mosaic-provider-jobcards"]` embedded JSON; plain `fetch` with browser UA may work; cheerio already in dependencies; source pattern well-established in codebase |
| R-82 | User pastes a non-LinkedIn job URL; Disha scrapes page, extracts JD text, creates job record, queues for next nightly scoring run | `paste-role` route already does synchronous scoring; R-82 requires deferred scoring (store + queue); new `url_queue` table or `queued` status on jobs; nightly picks up unscored queued jobs |

</phase_requirements>

---

## Summary

Phase 14 has two independent workstreams: (1) adding Indeed Netherlands as a scheduled discovery source, and (2) letting the user paste arbitrary non-LinkedIn job URLs for deferred overnight scoring.

**Indeed NL (R-81):** Indeed embeds job-card data in a JavaScript variable `window.mosaic.providerData["mosaic-provider-jobcards"]` inside the HTML. The JSON path to individual jobs is `data.metaData.mosaicProviderJobCardsModel.results[]`. Each result object contains `jobkey`, `title`, `company`, `formattedLocation`, `snippet`, `viewJobLink`, and `formattedRelativeTime`. Cheerio is already in `dependencies`. A plain `fetch` with a realistic browser `User-Agent` has a moderate chance of succeeding against `nl.indeed.com`; Indeed uses Cloudflare but enforcement at low-volume personal-project scale is inconsistent. The search URL pattern for nl.indeed.com is `https://nl.indeed.com/vacatures?q=<keyword>&l=Nederland&sort=date`. The data extraction strategy (regex-extract embedded JSON, not CSS selectors) is resilient to UI changes.

**URL paste queue (R-82):** The existing `/api/paste-role` route does synchronous LLM scoring — which violates the v2 hard constraint "no new direct LLM calls outside nightly cron". R-82 requires a different behaviour: accept the URL, persist a pending job record, and let the nightly cron score it. The cleanest approach is a new `source='url_paste'` job row inserted synchronously (no scoring) with a sentinel status (`tier IS NULL`, `hardFilterReason IS NULL`, `fitScore IS NULL`). The existing nightly orchestrator already cleans up rank-failed rows (same sentinel pattern) and re-scores them — this hook can be reused. The dedup story is: check `sourceUrl` against existing `sourceUrl` values before inserting; if already present, return the existing job id. No new table is needed.

**Primary recommendation:** Add `IndeedNlSource` using embedded-JSON extraction (not CSS selectors). For URL paste, add a new API route `/api/queue-url` that inserts a pending job row; nightly picks it up automatically via the existing rank-failed cleanup + score pass.

---

## Standard Stack

### Core (all already in dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cheerio` | ^1.2.0 | HTML parsing (already installed) | Used by existing sources; can load HTML and run regex on script tags |
| `node:fetch` (native) | Node 20 built-in | HTTP requests | Used by all existing sources |
| `drizzle-orm` | ^0.45.2 | DB writes for queue | Already the project ORM |

**No new packages needed.** The entire phase can be implemented with existing dependencies.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Embedded-JSON extraction | CSS selectors on DOM | CSS class names on Indeed change silently; embedded JSON keys are more stable |
| New `url_queue` DB table | New column on `jobs` | New table adds migration complexity; existing sentinel pattern (tier IS NULL + fitScore IS NULL + hardFilterReason IS NULL on source='url_paste') already supported by orchestrator cleanup logic |

---

## Architecture Patterns

### Recommended Project Structure for Phase 14

```
src/lib/sources/
├── indeed-nl.ts        # New: IndeedNlSource (R-81)
├── index.ts            # Add IndeedNlSource to allSources()
└── types.ts            # No changes needed

src/app/api/
├── queue-url/
│   └── route.ts        # New: POST endpoint for R-82 URL paste queue
└── paste-role/
    └── route.ts        # No changes — keep synchronous for JD text paste

tests/
├── fixtures/
│   └── indeed-nl-search.html   # Capture real indeed.nl response for fixture
└── unit/sources/
    └── indeed-nl.test.ts        # Fixture-based parse tests (R-81)
```

### Pattern 1: Embedded-JSON Extraction (Indeed NL)

**What:** Extract `window.mosaic.providerData["mosaic-provider-jobcards"]` from the raw HTML response using a regex, parse as JSON, walk the key path to the results array.

**When to use:** When a site bakes data into a JS variable rather than rendering it in DOM elements. More stable than CSS selectors.

**Key path (confirmed from multiple sources):**
```
data.metaData.mosaicProviderJobCardsModel.results[]
```

**Fields per job result (confirmed):**
- `jobkey` → `sourceExternalId` (unique stable ID)
- `title` → `title`
- `company` → `companyName`
- `formattedLocation` → `location`
- `viewJobLink` → relative URL, prefix with `https://nl.indeed.com` → `sourceUrl`
- `snippet` → short excerpt; full JD text requires a second fetch to the job detail page

**Search URL pattern (confirmed from indeed.nl search result URLs):**
```
https://nl.indeed.com/vacatures?q=<keyword>&l=Nederland&sort=date&start=<offset>
```
- `start` increments by 10 per page (Indeed standard pagination)
- `sort=date` gets recent listings first

**Extraction approach (based on Magnet.me pattern already in codebase):**
```typescript
// Source: [VERIFIED: multiple scraping guides + codebase pattern in magnetme.ts]
const MOSAIC_PATTERN = /window\.mosaic\.providerData\["mosaic-provider-jobcards"\]=(\{.+?\});/;

function parseIndeedSearch(html: string): RawJob[] {
  const match = html.match(MOSAIC_PATTERN);
  if (!match) return [];
  const data = JSON.parse(match[1]);
  const results = data?.metaData?.mosaicProviderJobCardsModel?.results ?? [];
  // ... map results to RawJob
}
```

**JD text limitation:** The `snippet` field is a short excerpt (~150 chars), not the full JD. To get full JD text, a second request to the job detail page is needed. Decision required: use snippet only (avoids rate limiting but reduces scoring quality) vs. fetch full JD per job (doubles requests). Recommendation: use snippet for initial insertion; full JD enrichment can happen in a follow-up phase or opportunistically.

**[ASSUMED]** The `window.mosaic.providerData["mosaic-provider-jobcards"]` key exists on `nl.indeed.com` with the same structure as `indeed.com`. Training knowledge + multiple guides confirm the structure on `indeed.com`; regional domain parity is inferred but not empirically tested against `nl.indeed.com`.

### Pattern 2: URL Paste Queue (R-82)

**What:** New `POST /api/queue-url` route that accepts a URL, does a synchronous page fetch to get JD text, inserts a job row with `source='url_paste'`, `tier=null`, `fitScore=null`, `hardFilterReason=null`, and returns confirmation. The nightly cron then scores it in the same pass it uses for rank-failed retry rows.

**How nightly picks it up:** The orchestrator's Step 0 already deletes rows where `tier IS NULL AND hardFilterReason IS NULL AND fitScore IS NULL`, then re-discovers. To persist queued URLs across runs, use a different mechanism: instead of deletion, the orchestrator should detect `source='url_paste'` rows with null tier and explicitly score them in the rank pass. **Alternative:** Insert queued jobs with a sentinel `hardFilterReason='queued'` and have the nightly clear that flag and process them.

**Cleaner pattern — use dedicated `queued` state:**
- Insert with `hardFilterReason = 'queued'` so orchestrator cleanup (which deletes `hardFilterReason IS NULL`) does not delete the row before the next nightly run
- Nightly adds a new pre-pass: select rows with `source='url_paste' AND hardFilterReason='queued'`, score them (with Haiku via existing `assessJob`), update the row
- After scoring: clear `hardFilterReason`, set `tier`, `fitScore`, `fitBreakdown`; create application row

**Dedup strategy:** Before inserting, query `SELECT id FROM jobs WHERE source_url = $url LIMIT 1`. If found, return the existing job id with a "already queued / already scored" status.

**[ASSUMED]** The orchestrator cleanup that deletes `tier IS NULL AND hardFilterReason IS NULL AND fitScore IS NULL` rows is safe to extend with a `source != 'url_paste'` guard — or the `queued` sentinel `hardFilterReason` avoids the issue entirely. Verified by reading orchestrator source.

### Anti-Patterns to Avoid

- **CSS-selector scraping of Indeed:** Class names like `.job_seen_beacon` and `.jobTitle` change without notice; embedded-JSON extraction is more stable. `[VERIFIED: multiple 2025-2026 scraping guides]`
- **Fetching full JD for every Indeed job in one run:** Indeed has Cloudflare. Two requests per job (search + detail) doubles exposure. Start with snippet only.
- **Scoring in the URL queue route:** Violates the v2 hard constraint (no new direct LLM calls outside nightly cron). Score only in the nightly orchestrator.
- **Using the existing paste-role route for R-82:** The existing route scores synchronously. R-82 must queue for deferred scoring. They are different routes with different contracts.
- **Deleting queued URL jobs on nightly startup:** The orchestrator's existing rank-failed cleanup would delete unscored `url_paste` jobs if they match the sentinel. Use `hardFilterReason='queued'` to avoid this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML → plain text | Custom stripping logic | The `htmlToText` function already in `paste-role/route.ts` | Already implemented and tested |
| HTTP fetch with timeout | Custom timeout logic | `AbortController` + `setTimeout` pattern already in `paste-role/route.ts` (10s timeout) | Copy the pattern |
| Per-source error isolation | Try/catch per source | `discover.ts` already wraps each source in try/catch with pLimit | Just add IndeedNlSource to `allSources()` |
| Dedup across sources | Custom logic | `computeDedupeHash` + `uniqueIndex("jobs_source_external_id_unique")` on `(source, sourceExternalId)` | Already handles this; `jobkey` from Indeed is the `sourceExternalId` |
| Within-source dedup | Complex set tracking | Pattern from `nvb.ts` and `magnetme.ts`: maintain `seen = new Set<string>()` within `fetch()` | Established pattern |

**Key insight:** The codebase already has all the primitives. Phase 14 is composition, not invention.

---

## Common Pitfalls

### Pitfall 1: Indeed Returns 403 or Cloudflare Challenge Page
**What goes wrong:** `fetch('https://nl.indeed.com/vacatures?...')` returns 403, 503, or an HTML page containing "Checking if the site connection is secure" instead of job data.
**Why it happens:** Indeed uses Cloudflare. Node.js native fetch has a different TLS fingerprint (JA3/JA4) than browsers, which Cloudflare can detect regardless of `User-Agent`.
**How to avoid:** Use a realistic browser `User-Agent` with full header set (Accept, Accept-Language, Accept-Encoding, Sec-Fetch-* headers). Add `1500ms` polite delay between keyword requests (matches existing NVB pattern). Check response content before JSON parsing: if `html.includes('window.mosaic')` is false, log a warning and return `[]` gracefully.
**Warning signs:** Empty `perSource['indeed-nl'] = 0` in run summary; orchestrator errors log shows `[indeed-nl] mosaic data not found`.
**Fallback:** If Indeed returns 403 consistently, the source can be silently skipped (per-source error isolation in `discover.ts`). Phase 16 source quality chart will surface this to the user.

### Pitfall 2: `mosaic-provider-jobcards` Key Not Present
**What goes wrong:** The regex pattern finds the `window.mosaic` object but the `mosaic-provider-jobcards` key is absent (Indeed A/B tests their own page variants).
**Why it happens:** Indeed serves different page variants. The key might be `mosaic-provider-jobcards-v2` or nested differently on some requests.
**How to avoid:** Check `html.includes('mosaic-provider-jobcards')` first; log clearly if absent. Make the regex non-greedy and test against a real fixture.
**Warning signs:** Regex matches but `data.metaData` is undefined.

### Pitfall 3: `url_paste` Rows Deleted by Nightly Cleanup
**What goes wrong:** User queues a URL, goes to sleep, nightly runs and deletes the queued job row before scoring it (because the cleanup removes rows with `tier IS NULL AND hardFilterReason IS NULL AND fitScore IS NULL`).
**Why it happens:** The orchestrator cleanup was designed for rank-failed retry rows, not intentional queued rows.
**How to avoid:** Set `hardFilterReason = 'queued'` on insertion. The cleanup condition explicitly excludes rows where `hardFilterReason IS NOT NULL`. Verified in orchestrator source: `WHERE tier IS NULL AND hard_filter_reason IS NULL AND fit_score IS NULL`.
**Warning signs:** User reports job disappeared from inbox after nightly run.

### Pitfall 4: Duplicate URL Paste Insertions
**What goes wrong:** User pastes the same URL twice; two identical job records appear in the inbox.
**Why it happens:** The unique index on `jobs` is `(source, source_external_id)`. For `url_paste` source, `source_external_id` is generated as `manual-${Date.now()}` in the existing paste-role route — so two inserts get different IDs.
**How to avoid:** For `queue-url` route, use a stable `sourceExternalId` derived from the URL (e.g., `url:${normalizeUrl(url)}`). The unique index will then reject a second insert of the same URL. Alternatively, check `sourceUrl` explicitly before insert.
**Warning signs:** Multiple duplicate rows with `source='url_paste'` and same `source_url`.

### Pitfall 5: Vercel Function Timeout on Nightly with Indeed
**What goes wrong:** Nightly cron times out because Indeed scraping takes too long (especially if fetching job detail pages).
**Why it happens:** The nightly route has `maxDuration = 300`. Adding Indeed with 6 keywords × 1.5s delay = 9s minimum just for search requests. If full JD fetching is added later (60 jobs × 10s timeout each), that's 600s — way over budget.
**How to avoid:** Use snippet only for JD text in v1 of the Indeed source. The 9s search cost for 6 keywords is well within the 300s budget alongside existing sources. Do not add full-JD fetching in this phase.
**Warning signs:** Nightly run ends with `status='failed'` and timeout error.

---

## Code Examples

### Extract Indeed Jobs from Embedded JSON
```typescript
// Source: [ASSUMED from magnetme.ts pattern + multiple scraping guides]
// The MOSAIC_PATTERN and key path are confirmed by decodo.com/blog/scrape-indeed-guide
const MOSAIC_PATTERN =
  /window\.mosaic\.providerData\["mosaic-provider-jobcards"\]=(\{.+?\});/;

export function parseIndeedNlSearch(html: string): RawJob[] {
  if (!html) return [];
  const match = html.match(MOSAIC_PATTERN);
  if (!match) return [];
  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }
  const results =
    (data as { metaData?: { mosaicProviderJobCardsModel?: { results?: unknown[] } } })
      ?.metaData?.mosaicProviderJobCardsModel?.results;
  if (!Array.isArray(results)) return [];

  return results.flatMap((r: unknown) => {
    const job = r as Record<string, unknown>;
    const jobkey = job.jobkey as string | undefined;
    const title = job.title as string | undefined;
    if (!jobkey || !title) return [];

    const viewJobLink = job.viewJobLink as string | undefined;
    const sourceUrl = viewJobLink
      ? viewJobLink.startsWith("http")
        ? viewJobLink
        : `https://nl.indeed.com${viewJobLink}`
      : `https://nl.indeed.com/viewjob?jk=${jobkey}`;

    const snippet = job.snippet as string | undefined;
    const jdText = snippet ? snippet.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";

    return [{
      source: "indeed-nl",
      sourceExternalId: jobkey,
      sourceUrl,
      title: title.trim(),
      jdText,
      companyName: (job.company as string | undefined)?.trim() ?? null,
      companyDomain: null,
      location: (job.formattedLocation as string | undefined)?.trim() ?? null,
      postedAt: null, // formattedRelativeTime is "9 days ago" — not parseable to Date reliably
    }] satisfies RawJob[];
  });
}
```

### Indeed NL Search URL Pattern
```typescript
// Source: [VERIFIED: nl.indeed.com search result URL structure confirmed in search results]
const BASE = "https://nl.indeed.com";
const SEARCH_KEYWORDS = [
  "marketing automation",
  "CRM marketing",
  "email marketing",
  "HubSpot",
  "growth marketing",
  "digital marketing",
] as const;

function buildSearchUrl(keyword: string): string {
  const url = new URL(`${BASE}/vacatures`);
  url.searchParams.set("q", keyword);
  url.searchParams.set("l", "Nederland");
  url.searchParams.set("sort", "date");
  return url.toString();
}
```

### Queue-URL Route Skeleton (R-82)
```typescript
// Source: [ASSUMED — pattern derived from existing paste-role/route.ts]
// POST /api/queue-url
// - Validates URL
// - Checks not LinkedIn (existing guard)
// - Checks not already in DB (dedup on sourceUrl)
// - Fetches page text (10s timeout, existing htmlToText helper)
// - Inserts job row with source='url_paste', hardFilterReason='queued'
// - Returns { ok: true, queued: true, jobId }
// No LLM calls. Scoring happens in next nightly run.
```

### Nightly Orchestrator Hook for Queued URLs
```typescript
// Source: [ASSUMED — derived from existing orchestrator.ts re-score pass pattern]
// New Step 0.5 in orchestrator, before the cleanup:
// SELECT id, source_url, title, jd_text FROM jobs
//   WHERE source = 'url_paste' AND hard_filter_reason = 'queued'
// For each: run assessJob() + assignTier(), update row, clear hardFilterReason,
//           create application row if tier != null.
// This runs inside the existing cron budget (RANK_CONCURRENCY = 3).
```

---

## Runtime State Inventory

> Not a rename/refactor phase — section omitted.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `cheerio` | Indeed HTML parsing | Already in deps | ^1.2.0 | — |
| `node:fetch` | HTTP requests | Node 20 built-in | Node 20 | — |
| `nl.indeed.com` | R-81 discovery | Unknown at research time | — | Source returns [] gracefully; per-source error isolation in discover.ts |
| Neon Postgres | URL queue persistence | Already live | Production | — |

**Missing dependencies with no fallback:** None.

**External risk (not a dependency but a risk):** `nl.indeed.com` may return Cloudflare challenge pages instead of job data. The discover pipeline already handles per-source failures gracefully (source returns `[]`, error recorded in run summary). This is an acceptable risk for a personal project at very low request volume (6 requests per night).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.x |
| Config file | vitest.config.ts (inferred from package.json `"test": "vitest run"`) |
| Quick run command | `npx vitest run tests/unit/sources/indeed-nl.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R-81 | `parseIndeedNlSearch` extracts jobs from fixture HTML | unit | `npx vitest run tests/unit/sources/indeed-nl.test.ts` | ❌ Wave 0 |
| R-81 | Returns empty array for empty/invalid/403 HTML | unit | `npx vitest run tests/unit/sources/indeed-nl.test.ts` | ❌ Wave 0 |
| R-81 | `sourceExternalId` is unique and non-empty for all jobs | unit | `npx vitest run tests/unit/sources/indeed-nl.test.ts` | ❌ Wave 0 |
| R-81 | `IndeedNlSource` added to `allSources()` registry | unit | `npx vitest run tests/unit/sources/registry.test.ts` | ❌ update existing |
| R-82 | POST `/api/queue-url` with valid URL inserts pending job row | unit (mocked DB) | `npx vitest run tests/unit/api-routes.test.ts` | ❌ update existing |
| R-82 | Duplicate URL paste returns existing job id without re-insert | unit | `npx vitest run tests/unit/api-routes.test.ts` | ❌ update existing |
| R-82 | Nightly scores `url_paste` queued rows | unit | `npx vitest run tests/unit/pipeline/` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/sources/indeed-nl.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/fixtures/indeed-nl-search.html` — real captured response from `nl.indeed.com` (or synthetic fixture with `window.mosaic.providerData` shape)
- [ ] `tests/unit/sources/indeed-nl.test.ts` — fixture-based parse tests, 5 test cases matching NVB pattern
- [ ] Update `tests/unit/sources/registry.test.ts` — assert `allSources()` includes `indeed-nl`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (queue-url endpoint) | Existing `CRON_SECRET`-style pattern; or restrict to authenticated session |
| V5 Input Validation | yes | Validate URL is `http(s)://`; reject LinkedIn URLs; enforce max length |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via `/api/queue-url` | Tampering | Validate URL scheme (https only); block private IP ranges (10.x, 192.168.x, localhost, 169.254.x); enforce 10s timeout |
| Unbounded queue growth | Denial of Service | Rate-limit inserts; cap total `url_paste` rows (e.g., reject if >50 unscored queued jobs) |
| Scraped PII stored in DB | Information Disclosure | JD text is public job listings; no PII concern |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS selectors on Indeed job cards | Embedded JSON extraction (`window.mosaic.providerData`) | 2023-2024 | CSS class names now obfuscated; JSON keys more stable |
| Cheerio-only HTML parsing | Regex-extract embedded JSON blob, then JSON.parse | 2024 | More reliable across Indeed UI redesigns |

**Deprecated/outdated:**
- `.job_seen_beacon`, `.jobTitle`, `.companyName` CSS classes: fragile; mentioned in older guides as unreliable by 2025. Use embedded JSON.
- Indeed's old mobile site (`indeed.com/m/jobs`): had simpler HTML; appears deprecated as of 2024.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `nl.indeed.com` uses same `window.mosaic.providerData["mosaic-provider-jobcards"]` JSON structure as `indeed.com` | Standard Stack, Code Examples | Parser returns empty; source silently returns 0 jobs; not catastrophic |
| A2 | Plain Node.js `fetch` with browser UA will succeed against `nl.indeed.com` at low volume | Common Pitfalls | 403/Cloudflare challenge; source returns 0 jobs; gracefully handled |
| A3 | The `formattedRelativeTime` field ("9 days ago") cannot be reliably parsed to a `Date`; `postedAt` should be `null` | Code Examples | Could attempt to parse relative time; moderate effort for marginal gain |
| A4 | Using `hardFilterReason='queued'` as sentinel for URL-pasted jobs avoids the nightly cleanup deletion | Architecture Patterns | Queued jobs get deleted before scoring; must test orchestrator SQL carefully |
| A5 | `snippet` field provides sufficient JD text for `assessJob()` to produce a meaningful fit score | Architecture Patterns | Haiku scoring quality degraded; T1/T2 assignments less accurate for Indeed jobs |

---

## Open Questions (RESOLVED)

1. **Should Indeed source fetch full JD text per job?** (RESOLVED)
   - **Decision: snippet-only.** Start with `snippet` (~150 chars). Monitor T1 rate from `indeed-nl` source in Phase 16 analytics. Full-JD fetching doubles Cloudflare exposure — defer until Phase 16 data shows T1 rate degradation.

2. **Should `/api/queue-url` require authentication?** (RESOLVED)
   - **Decision: no additional auth.** Match existing `paste-role` pattern (no auth beyond Vercel deployment access + existing `disha_session` middleware coverage). Add SSRF protection (block private IPs, https-only) regardless.

3. **What is the confirmed `nl.indeed.com` search URL format?** (RESOLVED)
   - **Decision: use `https://nl.indeed.com/vacatures?q=<keyword>&l=Nederland&sort=date` and rely on synthetic fixture.** Live verification is an anti-pattern in CI (Cloudflare blocks). Plans use a synthetic fixture capturing the confirmed `window.mosaic.providerData["mosaic-provider-jobcards"]` shape (confirmed via multiple 2025-2026 scraping guides). If Indeed returns 403 at runtime, per-source error isolation returns `[]` gracefully — not catastrophic.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/lib/sources/nvb.ts` — established source pattern for keyword fan-out + polite delay
- Codebase: `src/lib/sources/magnetme.ts` — established embedded-JSON extraction pattern (regex on `window.__PRELOAD_STATE__`)
- Codebase: `src/lib/pipeline/orchestrator.ts` — nightly cleanup logic; confirmed sentinel condition
- Codebase: `src/app/api/paste-role/route.ts` — URL fetch + html-to-text pattern for R-82

### Secondary (MEDIUM confidence)
- [decodo.com/blog/scrape-indeed-guide](https://decodo.com/blog/scrape-indeed-guide) — Confirmed JSON key path: `data.metaData.mosaicProviderJobCardsModel.results[]`; field names `jobkey`, `title`, `company`, `formattedLocation`, `viewJobLink`
- [scrapfly.io/blog/posts/how-to-scrape-indeedcom](https://scrapfly.io/blog/posts/how-to-scrape-indeedcom) — Confirmed `window.mosaic.providerData["mosaic-provider-jobcards"]` extraction strategy (2026 update)
- Multiple 2025 scraping guides confirming MOSAIC_PATTERN regex approach and field structure

### Tertiary (LOW confidence)
- [github.com/PSavvateev/JobScrapingApp_Indeed.nl](https://github.com/PSavvateev/JobScrapingApp_Indeed.nl) — Existence confirms indeed.nl scraping is feasible; uses BeautifulSoup (Python), not helpful for selectors
- Web search results confirming `nl.indeed.com/q-*-vacatures.html` URL structure visible in SERPs

---

## Metadata

**Confidence breakdown:**
- Indeed NL JSON structure: MEDIUM — confirmed for `indeed.com`; domain parity with `nl.indeed.com` is assumed
- URL paste queue design: HIGH — fully derivable from existing codebase patterns
- Anti-bot risk: MEDIUM — Cloudflare confirmed on Indeed; actual behaviour at personal-project scale (6 req/night) unknown
- Test framework: HIGH — Vitest confirmed in package.json; pattern matches existing NVB tests

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (Indeed structure changes occasionally; re-verify fixture before shipping)
