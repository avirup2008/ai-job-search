---
phase: 14-enhanced-discovery
plan: "01"
subsystem: sources
tags: [discovery, scraping, indeed, html-parsing, embedded-json]
dependency_graph:
  requires: []
  provides: [IndeedNlSource, parseIndeedNlSearch]
  affects: [src/lib/sources/index.ts, src/lib/pipeline/discover.ts]
tech_stack:
  added: []
  patterns: [embedded-JSON extraction via regex + bracket-balancing fallback, per-source dedup via Set<string>, polite delay 1500ms]
key_files:
  created:
    - src/lib/sources/indeed-nl.ts
    - tests/fixtures/indeed-nl-search.html
    - tests/unit/sources/indeed-nl.test.ts
  modified:
    - src/lib/sources/index.ts
    - tests/unit/sources/registry.test.ts
decisions:
  - Use snippet-only for jdText (not full JD fetch); avoids doubling Cloudflare exposure
  - postedAt set to null; formattedRelativeTime ("2 days ago") not reliably parseable to Date
  - Regex anchored to </script> as primary extraction; bracket-balancing fallback matches magnetme.ts pattern
  - DELAY_MS = 1500 to match NVB/Magnet.me polite-delay convention
metrics:
  duration: "~8 minutes"
  completed_date: "2026-04-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 2
---

# Phase 14 Plan 01: Indeed NL Source — Summary

**One-liner:** Indeed Netherlands HTML scraping via `window.mosaic.providerData["mosaic-provider-jobcards"]` embedded JSON extraction, normalised to `RawJob` with `source='indeed-nl'`, registered in `allSources()`.

## What Was Built

`IndeedNlSource` is a new discovery source that fetches `nl.indeed.com/vacatures` for 6 marketing keywords (matching the NVB/Magnet.me keyword set), extracts job data from the embedded `window.mosaic.providerData["mosaic-provider-jobcards"]` JSON blob, and returns normalised `RawJob[]`.

The parser (`parseIndeedNlSearch`) uses a `</script>`-anchored regex as the primary extraction strategy, with a bracket-balancing fallback identical in principle to `extractPreloadStateJson` in `magnetme.ts`. Both extraction paths are covered by the fixture-based tests. The source is added to `allSources()` so the existing `discover.ts` fan-out picks it up automatically on the next nightly run — no pipeline changes required.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create fixture + parseIndeedNlSearch() + 7 unit tests | 2ed9152 | tests/fixtures/indeed-nl-search.html, src/lib/sources/indeed-nl.ts, tests/unit/sources/indeed-nl.test.ts |
| 2 | Register IndeedNlSource in allSources(); update registry test | 55bdd1f | src/lib/sources/index.ts, tests/unit/sources/registry.test.ts |
| 3 | Full test suite + typecheck verification | — (no files changed) | — |

## Test Results

- `npx vitest run tests/unit/sources/indeed-nl.test.ts`: 7/7 pass
- `npx vitest run tests/unit/sources/`: 25/25 pass (all 6 source test files)
- `npx vitest run`: 216/216 pass (full suite, 38 test files)
- `npx tsc --noEmit`: 2 pre-existing errors in `src/app/(app)/inbox/[jobId]/docs/page.tsx` (unrelated to this plan; present on base commit 43c01ac)

## Deviations from Plan

None — plan executed exactly as written. The IndeedNlSource class was included in the same file as `parseIndeedNlSearch` rather than split across tasks (both were in the same Task 1 file `src/lib/sources/indeed-nl.ts`), which matched the plan's `<files>` spec for Task 1.

## Known Stubs

None. The fixture is a complete synthetic HTML document with 4 job records. The parser handles all 4 records correctly including the null-company/null-location case (record 4).

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. Threats addressed per plan threat model:

| Threat | Mitigation Status |
|--------|------------------|
| T-14-01 Tampering (jdText) | Mitigated — HTML stripped via `/<[^>]*>/g` replace before storage |
| T-14-02 DoS (fetch rate) | Mitigated — 1500ms delay; per-source try/catch in discover.ts; returns [] on any error |
| T-14-03 Info Disclosure | Accepted — public job listing snippets only |
| T-14-04 Cloudflare spoofing | Accepted — `html.includes("mosaic-provider-jobcards")` guard; source returns [] and logs warning |

## Self-Check: PASSED

- `src/lib/sources/indeed-nl.ts`: EXISTS
- `tests/fixtures/indeed-nl-search.html`: EXISTS
- `tests/unit/sources/indeed-nl.test.ts`: EXISTS
- Commit 2ed9152: EXISTS
- Commit 55bdd1f: EXISTS
- `git diff --name-only 43c01ac..HEAD src/lib/pipeline/`: EMPTY (no pipeline files modified)
