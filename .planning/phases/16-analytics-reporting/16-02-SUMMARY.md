---
phase: 16-analytics-reporting
plan: "02"
subsystem: analytics
tags: [weekly-brief, cron, github-actions, rules-engine, tdd]
dependency_graph:
  requires: [16-01]
  provides: [weekly-brief-rules-engine, weekly-brief-cron, weekly-brief-analytics-card]
  affects: [src/app/(app)/analytics/page.tsx, src/app/api/cron/weekly-brief/route.ts]
tech_stack:
  added: [date-fns (startOfWeek)]
  patterns: [pure-function-rules-engine, tdd-red-green, cron-route-auth-guard]
key_files:
  created:
    - src/lib/analytics/weekly-brief.ts
    - src/app/api/cron/weekly-brief/route.ts
    - .github/workflows/weekly-brief.yml
    - tests/unit/analytics/weekly-brief.test.ts
  modified:
    - src/app/(app)/analytics/page.tsx
decisions:
  - "Rule 3 (T1 discovered, none applied) takes priority over Rule 2 (on-track) in computeCallout"
  - "Rule 5 (default top-source) fires when on-pace + T1 data exists, so Rule 2 is guarded with t1Available === 0"
  - "GitHub Actions cron kept (not Vercel Cron Jobs) — matches established nightly-cron.yml pattern for this project"
metrics:
  duration_minutes: 12
  completed_date: "2026-04-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
  tests_added: 8
  tests_total: 296
---

# Phase 16 Plan 02: Weekly Strategy Brief Summary

**One-liner:** Rules-based Weekly Strategy Brief (R-87) — 5-branch callout engine stored in runs table, generated every Monday via GitHub Actions cron, displayed as a span-2 analytics card with empty-state handling.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Weekly brief rules engine (TDD) | 8bd456e | `src/lib/analytics/weekly-brief.ts`, `tests/unit/analytics/weekly-brief.test.ts` |
| 2 | Cron route + GitHub Actions workflow + analytics page card | 5867a29 | `src/app/api/cron/weekly-brief/route.ts`, `.github/workflows/weekly-brief.yml`, `src/app/(app)/analytics/page.tsx` |

## What Was Built

### `src/lib/analytics/weekly-brief.ts`
- `computeCallout()`: pure rules engine with 5 branches — Rule 3 (T1 discovered, none applied) takes priority over Rule 2 (on-track pace); Rule 4 fires on low T1 application rate; Rule 1 fires when behind pace; Rule 5 is the default showing top source
- `generateWeeklyBrief()`: DB queries for applications this week, T1 jobs by source, T1 applications — no LLM calls
- `TARGET_APPLICATIONS_PER_WEEK = 5` constant
- `WeeklyBrief` interface

### `tests/unit/analytics/weekly-brief.test.ts`
- 8 unit tests covering all 5 rule branches, edge cases (60% threshold, singular/plural), and the constant
- Pure function tests — no DB mocking required

### `src/app/api/cron/weekly-brief/route.ts`
- `runtime = "nodejs"`, `maxDuration = 30`
- CRON_SECRET bearer auth (401 on missing/wrong token) — identical to purge route pattern
- Monday UTC guard: returns `{ ok: true, skipped: "not monday" }` on non-Monday
- On success: inserts row into `runs` table with `status: "weekly-brief"` and full `WeeklyBrief` as `stageMetrics`

### `.github/workflows/weekly-brief.yml`
- Schedule: `0 8 * * 1` (Monday 08:00 UTC)
- `workflow_dispatch` for safe manual triggers (Monday guard in route prevents side effects)
- Copies nightly-cron.yml structure exactly; 2-minute job timeout; fails on non-200

### `src/app/(app)/analytics/page.tsx`
- Added `weeklyBriefRows` query to `Promise.all` (SELECT from `runs` WHERE status = 'weekly-brief' ORDER BY startedAt DESC LIMIT 1)
- `latestBrief` extracted from `stageMetrics` JSONB and cast to `WeeklyBrief | null`
- `Weekly strategy brief` panel (span-2): empty state when no brief yet; data-bound card with applications/target, T1 available vs applied, top source, and callout text

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rule priority ordering in computeCallout**
- **Found during:** Task 1, GREEN phase (1 test failing)
- **Issue:** The plan's rule ordering placed Rule 2 (on-track) before Rule 5 (default). The test case `{apps=5, target=5, t1Available=6, t1Applied=4}` expected Rule 5 but Rule 2 fired first.
- **Fix:** Rule 2 is now guarded with `t1Available === 0` — when T1 data exists and other rules don't apply, Rule 5 (top source message) fires. This matches the plan's example test cases and the intent that Rule 5 is the default when T1 context is available.
- **Files modified:** `src/lib/analytics/weekly-brief.ts`
- **Commit:** 8bd456e (same task commit)

### Recommendations Not Applied

**Vercel Cron Jobs recommendation:** The Vercel plugin suggested using `vercel.json` cron jobs instead of GitHub Actions. Not applied — the project uses GitHub Actions for all cron scheduling (nightly-cron.yml), and the plan explicitly specifies the GitHub Actions pattern. Consistency with the existing cron architecture takes precedence.

## Known Stubs

None — the brief card shows real data from the `runs` table, with a proper empty state ("No brief yet — generated every Monday at 08:00 UTC.") when no brief has been generated. The empty state is intentional, not a stub.

## Threat Surface Scan

No new trust boundaries introduced beyond those in the plan's threat model. The `/api/cron/weekly-brief` endpoint is covered by T-16-04 (CRON_SECRET bearer auth). The `stageMetrics` JSONB read path is covered by T-16-05 (owner-written data, null-guarded cast).

## Self-Check: PASSED

- [x] `src/lib/analytics/weekly-brief.ts` — exists
- [x] `tests/unit/analytics/weekly-brief.test.ts` — exists
- [x] `src/app/api/cron/weekly-brief/route.ts` — exists
- [x] `.github/workflows/weekly-brief.yml` — exists
- [x] `src/app/(app)/analytics/page.tsx` — modified with brief panel
- [x] Commit 8bd456e — Task 1
- [x] Commit 5867a29 — Task 2
- [x] `npm test` — 296 tests pass (49 files)
- [x] `npm run build` — compiled successfully
