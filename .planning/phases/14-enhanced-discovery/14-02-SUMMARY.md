---
phase: 14-enhanced-discovery
plan: "02"
subsystem: pipeline
tags: [queue-url, url-paste, deferred-scoring, orchestrator, ssrf-guard, dedup]
dependency_graph:
  requires: []
  provides: [POST /api/queue-url, orchestrator-step-0.5, queued-url-scoring]
  affects: [src/lib/pipeline/orchestrator.ts, src/app/api/queue-url/route.ts]
tech_stack:
  added: []
  patterns: [deferred-scoring-sentinel, thenable-drizzle-mock, ssrf-guard, url-normalisation]
key_files:
  created:
    - src/app/api/queue-url/route.ts
    - tests/unit/pipeline/queue-url-scoring.test.ts
  modified:
    - src/lib/pipeline/orchestrator.ts
    - tests/unit/api-routes.test.ts
decisions:
  - "Deferred scoring via hardFilterReason='queued' sentinel: row survives Step 0 DELETE because hard_filter_reason IS NOT NULL"
  - "URL normalisation strips hash and trailing slash before computing sourceExternalId to prevent duplicate queuing of same URL"
  - "SSRF guard blocks RFC-1918, link-local, localhost, and .local/.internal hosts before any fetch"
  - "Profile load moved before Step 0.5 so both queue-url scoring pass and main rank pass share one profile DB read"
  - "Pre-existing tsc errors in docs/page.tsx (next property on RequestInit) confirmed pre-existing on base commit — out of scope"
metrics:
  duration_minutes: 70
  completed_date: "2026-04-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
---

# Phase 14 Plan 02: Queue-URL Route + Orchestrator Step 0.5 Summary

**One-liner:** POST /api/queue-url queues non-LinkedIn job URLs with a `hardFilterReason='queued'` sentinel; orchestrator Step 0.5 scores all queued rows each nightly run via assessJob, clearing the sentinel on success and leaving it for retry on failure.

## What Was Built

### Task 1: POST /api/queue-url route (`83c39f7`)

New API route at `src/app/api/queue-url/route.ts`:

- Accepts `{ url: string }` body
- Validates URL scheme (http/https only), rejects LinkedIn, blocks SSRF hosts
- Deduplicates on `sourceExternalId = "url:" + normalised_url` using the existing unique index
- Fetches HTML via `fetchUrlText()` (same 10s AbortController timeout as paste-role)
- Inserts jobs row with `source='url_paste'`, `hardFilterReason='queued'`, `tier=null`, `fitScore=null`
- Handles unique-constraint race condition by re-querying and returning `alreadyQueued: true`
- No assessJob or assignTier calls — all LLM work deferred to nightly cron
- 7 unit tests in `tests/unit/api-routes.test.ts` (t1-t7) covering validation, dedup, SSRF, sentinel values, assessJob spy

### Task 2: Orchestrator Step 0.5 (`5bb1606`)

Modified `src/lib/pipeline/orchestrator.ts`:

- Profile load moved before Step 0.5 (was inside Step 1 block after discover)
- New Step 0.5 between rank-failed cleanup (Step 0) and discover (Step 1):
  - Selects `WHERE source='url_paste' AND hard_filter_reason='queued'`
  - Scores each row via `assessJob()` at `pLimit(RANK_CONCURRENCY)` — same budget as main rank pass
  - On success: writes fitScore, fitBreakdown, gapAnalysis, tier, seniority; clears hardFilterReason to null
  - On tier non-null: inserts applications row with status='new'
  - On assessJob failure: logs `[queue-url-rank-failed]`, leaves hardFilterReason='queued' for next nightly retry
- `RunSummary.counts` extended with `queuedScored: number` and `queuedFailed: number`
- 4 unit tests in `tests/unit/pipeline/queue-url-scoring.test.ts`

### Task 3: Full test suite + typecheck (no new commit)

- `npx vitest run`: 220 tests passed across 38 test files
- `npx tsc --noEmit`: 2 pre-existing errors in `docs/page.tsx` (Next.js `next` property on RequestInit), confirmed pre-existing on base commit — zero new type errors introduced
- Phase 13 regression tests (scoring-drift.test.ts, scoring-multipliers.test.ts, feedback-hook.test.ts): all green

## Threat Model Coverage

All mitigations from the plan's threat register implemented:

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-14-05 SSRF | `isBlockedHost()` blocks localhost, RFC-1918, link-local, .local/.internal | Implemented |
| T-14-06 DoS (queue growth) | Dedup on sourceExternalId unique index prevents re-queuing | Implemented |
| T-14-07 DoS (fetch timeout) | AbortController with 10_000ms timeout inherited from fetchUrlText | Implemented |

## Deviations from Plan

None — plan executed exactly as written. The pre-existing typecheck errors in `docs/page.tsx` are noted as out-of-scope (confirmed pre-existing on base commit `43c01ac`).

## Known Stubs

None — no hardcoded empty values or placeholder text in any created or modified files.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond what the plan's threat model already covers.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/app/api/queue-url/route.ts | FOUND |
| src/lib/pipeline/orchestrator.ts | FOUND |
| tests/unit/pipeline/queue-url-scoring.test.ts | FOUND |
| tests/unit/api-routes.test.ts | FOUND |
| commit 83c39f7 (Task 1) | FOUND |
| commit 5bb1606 (Task 2) | FOUND |
