---
phase: 14-enhanced-discovery
verified: 2026-04-17T00:00:00Z
status: human_needed
score: 6/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "End-to-end URL paste flow (from Plan 14-03 Task 3 checkpoint)"
    expected: "User pastes a non-LinkedIn URL in the inbox, gets green confirmation, DB row has source='url_paste' and hardFilterReason='queued'; after triggering nightly run the row gains tier+fitScore and appears in inbox"
    why_human: "Requires running the dev server, actual browser interaction, and a DB inspection — cannot be verified programmatically"
---

# Phase 14: Enhanced Discovery Verification Report

**Phase Goal:** Disha discovers jobs from Indeed Netherlands automatically each night, and Upashana can hand-feed any non-LinkedIn job URL into the pipeline without touching code.
**Verified:** 2026-04-17
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Nightly cron discovers jobs from nl.indeed.com via free HTML scraping | VERIFIED | `IndeedNlSource` in `src/lib/sources/indeed-nl.ts` fetches `https://nl.indeed.com/vacatures?q=<kw>&l=Nederland&sort=date` for 6 keywords; `allSources()` in `src/lib/sources/index.ts` registers it; `discover.ts` calls `allSources()` |
| 2 | Parsed jobs normalise to RawJob shape with source='indeed-nl' | VERIFIED | `parseIndeedNlSearch()` returns objects with `source: "indeed-nl"` (line 107 of indeed-nl.ts); 7 fixture-based tests pass |
| 3 | Indeed source failures do not break the nightly run (per-source error isolation) | VERIFIED | `IndeedNlSource.fetch()` uses try/catch for each keyword, logs warning and `continue`s on network/HTTP errors or missing mosaic data; never throws |
| 4 | POST /api/queue-url inserts a jobs row with source='url_paste' and hardFilterReason='queued' | VERIFIED | `src/app/api/queue-url/route.ts` line 197-208 inserts with `source: "url_paste"`, `hardFilterReason: "queued"`, `tier: null`, `fitScore: null`; no `assessJob` call present |
| 5 | Queued row survives the orchestrator's rank-failed cleanup; nightly orchestrator scores it | VERIFIED | Step 0 DELETE WHERE `hard_filter_reason IS NULL` (line 73-79 orchestrator.ts); Step 0.5 selects WHERE `source='url_paste' AND hardFilterReason='queued'`, scores via `assessJob()`, clears sentinel on success (lines 106-166) |
| 6 | LinkedIn URLs are rejected; duplicate URL paste returns existing jobId without a second row | VERIFIED | Route lines 105-110 reject linkedin.com URLs; dedup query at lines 122-135 returns `alreadyQueued: true`; race condition on unique-constraint handled at lines 212-229 |
| 7 | User sees 'Queue a job URL' input on the inbox page; sees confirmation/error messages | HUMAN_NEEDED | `QueueUrlForm` exists in `src/components/inbox/QueueUrlForm.tsx` and is mounted in `src/app/(app)/inbox/page.tsx` line 184 (`<QueueUrlForm />`); form structure, CSS, and validation logic are all present — but visual rendering and end-to-end interaction require human browser verification |

**Score:** 6/7 truths verified (1 requires human)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/sources/indeed-nl.ts` | IndeedNlSource class + parseIndeedNlSearch() pure function | VERIFIED | Exports both `IndeedNlSource` (line 148) and `parseIndeedNlSearch` (line 16); implements `JobSource` interface |
| `tests/fixtures/indeed-nl-search.html` | Synthetic HTML with window.mosaic.providerData embedded JSON | VERIFIED | File exists; contains `window.mosaic.providerData["mosaic-provider-jobcards"]=` with 4 synthetic job records |
| `tests/unit/sources/indeed-nl.test.ts` | 7 fixture-based parse tests | VERIFIED | 7 `it(` blocks covering: extract jobs, company names, locations, invalid input, unique IDs, companyDomain=null, HTML stripping |
| `src/app/api/queue-url/route.ts` | POST handler validating URL, fetching HTML, storing pending job, dedups by sourceExternalId | VERIFIED | Full implementation with SSRF guard, LinkedIn reject, normalisation, dedup, insert, race-condition handling; does NOT import assessJob |
| `src/lib/pipeline/orchestrator.ts` | Queue pre-pass (Step 0.5) scoring url_paste queued rows | VERIFIED | Step 0.5 block at lines 106-166; `queuedScored` and `queuedFailed` counters in `RunSummary.counts` (lines 31-32) |
| `src/components/inbox/QueueUrlForm.tsx` | Client-side form POSTing to /api/queue-url with response rendering | VERIFIED | `"use client"` directive, `QueueUrlForm` export, `validateQueueUrl` pure helper, posts to `/api/queue-url`, renders success/error states |
| `src/components/inbox/QueueUrlForm.css` | Form styling matching inbox CSS tokens | VERIFIED | File exists |
| `src/app/(app)/inbox/page.tsx` | Mounts QueueUrlForm in inbox toolbar | VERIFIED | Imports `QueueUrlForm` (line 4) and renders `<QueueUrlForm />` inside `.inbox-toolbar` (line 184) |
| `tests/unit/pipeline/queue-url-scoring.test.ts` | 4 orchestrator scoring tests | VERIFIED | 4 `it(` blocks: score+clear sentinel, leave sentinel on failure, tier=null no application, counters in RunSummary |
| `tests/unit/components/queue-url-form.test.tsx` | Component validation tests | VERIFIED | 8 `it(` blocks exercising `validateQueueUrl()` and `LINKEDIN_MESSAGE` constant; no jsdom needed |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/sources/index.ts` | `src/lib/sources/indeed-nl.ts` | `allSources()` registry | WIRED | Line 3: `import { IndeedNlSource } from "./indeed-nl"`, Line 13: `new IndeedNlSource()` in returned array |
| `src/lib/pipeline/discover.ts` | `IndeedNlSource` | `allSources()` fan-out | WIRED | `discover.ts` imports and calls `allSources()`; IndeedNlSource is in that registry |
| `src/app/api/queue-url/route.ts` | `schema.jobs` | drizzle insert with source='url_paste', hardFilterReason='queued' | WIRED | Lines 193-209 insert with correct sentinel values |
| `src/lib/pipeline/orchestrator.ts` | `schema.jobs` queued rows | SELECT WHERE source='url_paste' AND hard_filter_reason='queued' | WIRED | Lines 110-120 select with both conditions |
| Orchestrator queued scorer | `assessJob` | same assessJob/assignTier path as discovered jobs | WIRED | Lines 129-133 call `assessJob({ jdText, jobTitle, profile })`; line 134 calls `assignTier(rank.fitScore)` |
| `src/components/inbox/QueueUrlForm.tsx` | `/api/queue-url` | fetch POST with JSON body { url } | WIRED | Line 47: `fetch("/api/queue-url", { method: "POST", ... body: JSON.stringify({ url: url.trim() }) })` |
| `src/app/(app)/inbox/page.tsx` | `QueueUrlForm` | imported component in toolbar | WIRED | Line 4 import, line 184 `<QueueUrlForm />` inside `.inbox-toolbar` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `QueueUrlForm.tsx` | `status` (success/error) | `fetch("/api/queue-url")` response | Yes — response from real API route | FLOWING |
| `route.ts` | inserted job row | drizzle insert to `schema.jobs` with real DB | Yes — real DB insert via Drizzle ORM | FLOWING |
| `orchestrator.ts` Step 0.5 | `queuedRows` | `db.select().from(schema.jobs).where(...)` | Yes — real DB query | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — requires a running server (Next.js dev or Vercel) and a live Neon DB connection. The queue-url route and orchestrator are covered by unit tests with DB mocks.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R-81 | 14-01 | Indeed Netherlands added as a discovery source via free HTML scraping; normalises to RawJob shape; polite delay; fixture-based tests | SATISFIED | `IndeedNlSource` implemented with 1500ms DELAY_MS, registered in `allSources()`, 7 fixture-based tests passing, `source='indeed-nl'` in all returned RawJob objects |
| R-82 | 14-02, 14-03 | User can paste a non-LinkedIn job URL; Disha scrapes the page, extracts JD text, creates a job record, queues for next nightly scoring | SATISFIED (automated) / NEEDS HUMAN (end-to-end UX) | POST route implemented with fetch+extract+insert+dedup; orchestrator Step 0.5 scores queued rows; QueueUrlForm UI mounted in inbox; 4 pipeline tests + 8 component validation tests pass; full browser flow needs human verification |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No stubs, placeholder implementations, hardcoded empty returns, or unimplemented handlers found in any phase-14 artifact |

Specifically verified:
- `route.ts` does NOT import `assessJob` or `assignTier` (no LLM call in handler)
- `IndeedNlSource.fetch()` returns `[]` on all error paths (never throws)
- `QueueUrlForm` has real state management and real fetch call (not a stub)
- Step 0.5 in orchestrator has real DB select, real `assessJob` call, real DB update
- Fetch failure in `route.ts` is non-fatal: jdText defaults to `""` and the job is queued anyway with a hostname-derived placeholder title — this is a deliberate architectural decision documented in the route comments ("Queue anyway"), not a stub

---

## Human Verification Required

### 1. End-to-end URL paste flow

**Test:** Follow the 8-step verification script from Plan 14-03 Task 3:
1. Run `npm run dev`. Visit http://localhost:3000/inbox.
2. Verify "Queue a job URL" label, text input, and "Queue for tonight" button are visible in the toolbar.
3. Paste a LinkedIn URL (e.g. `https://www.linkedin.com/jobs/view/123`). Click Queue. Expected: red error "LinkedIn requires login..." with NO request to /api/queue-url in the network tab (rejected client-side).
4. Paste "not a url". Expected: red error "URL must start with http:// or https://".
5. Paste a real non-LinkedIn job URL (e.g. Werk.nl, Indeed NL, Magnet.me). Expected: green "Queued for tonight's run — tier and fit score will appear here tomorrow." DB check: `SELECT source, hard_filter_reason, tier, fit_score FROM jobs WHERE source_url = '<pasted>';` returns one row with source='url_paste', hard_filter_reason='queued', tier=null, fit_score=null.
6. Paste the same URL again. Expected: green "This URL is already in the queue." DB still has exactly one row for that URL.
7. Trigger nightly run: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/nightly`. DB check after run: `SELECT tier, fit_score, hard_filter_reason FROM jobs WHERE source='url_paste';` — row now has tier and fitScore, hardFilterReason=NULL.
8. Reload /inbox. If tier ∈ {1,2,3}, the job appears with a fit score. Admin runs page shows `queuedScored: 1`.

**Expected:** All 8 steps pass; user can confirm end-to-end flow works as described.
**Why human:** Requires a live dev server, real database connection, browser interaction, and visual confirmation of UI states. Cannot be verified programmatically without a running environment.

---

## Gaps Summary

No automated gaps. All artifacts exist, are substantive (not stubs), are properly wired, and data flows correctly. The single human_needed item is the end-to-end browser + DB verification that was designated as a blocking checkpoint in Plan 14-03 (Task 3) and was noted as `tasks_completed: 2` of 3 (Task 3 checkpoint not marked complete) in the 14-03-SUMMARY.md.

---

_Verified: 2026-04-17_
_Verifier: Claude (gsd-verifier)_
