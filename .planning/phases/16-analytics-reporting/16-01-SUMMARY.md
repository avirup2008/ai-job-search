---
phase: 16-analytics-reporting
plan: "01"
subsystem: analytics
tags: [drizzle-orm, neon, nextjs, server-components, vitest, date-fns]

requires:
  - phase: 15-candidate-intelligence-ui
    provides: analytics page baseline with loadData() Promise.all pattern and hbar-* CSS

provides:
  - "querySourceQuality() + computeSourceQuality() — T1 count and conversion rate per discovery source"
  - "queryMarketPulse() + computeMarketPulse() — avg days-to-response, T1 trend, per-source response rates"
  - "Source quality panel in analytics page (hbar chart)"
  - "Market pulse panel in analytics page (stats + conditional hbar rows)"
  - "14 unit tests covering pure computation functions"

affects:
  - 16-02
  - analytics page

tech-stack:
  added: []
  patterns:
    - "queryXxx() / computeXxx() split — DB query separated from pure computation; DB function untested, pure function fully unit tested"
    - "lastEventAt fallback for days-to-response — avoids events.kind format uncertainty; uses applications.lastEventAt - applications.appliedAt for terminal statuses"
    - "Division-by-zero guard — total > 0 ? ... : 0.0 on all rate computations"

key-files:
  created:
    - src/lib/analytics/source-quality.ts
    - src/lib/analytics/market-pulse.ts
    - tests/unit/analytics/source-quality.test.ts
    - tests/unit/analytics/market-pulse.test.ts
  modified:
    - src/app/(app)/analytics/page.tsx

key-decisions:
  - "Used lastEventAt fallback for days-to-response to avoid events.kind format uncertainty — computationally equivalent for applications that have reached terminal status"
  - "SOURCE_LABELS map in source-quality.ts covers all 5 known sources with human-readable display names; unknown sources fall back to raw source string"
  - "T1 trend direction uses ±5% threshold to avoid 'up'/'down' noise on small week-over-week variance"

patterns-established:
  - "Pattern: queryXxx/computeXxx split mirrors existing keywords.ts pattern — DB layer in one export, pure computation in another"
  - "Pattern: All analytics panels use Promise.all in loadData() — no sequential DB waterfalls"

requirements-completed:
  - R-83
  - R-88

duration: 18min
completed: 2026-04-17
---

# Phase 16 Plan 01: Analytics Reporting Summary

**Source quality hbar chart (R-83) and market pulse panel (R-88) added to analytics page using Drizzle GROUP BY queries and pure-function computation split**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-17T22:25:00Z
- **Completed:** 2026-04-17T22:32:30Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `computeSourceQuality()` pure function with SOURCE_LABELS map for 5 discovery sources, division-by-zero guard, 1-decimal rounding, sort by t1Count descending — 7 unit tests green
- `computeMarketPulse()` pure function with up/down/neutral trend detection (±5% threshold), per-source response rate computation, null avgDays handling — 7 unit tests green
- Analytics page extended with two new panels in the existing panel-grid: "Source quality" (hbar with T1 count + conversion rate) and "Market pulse" (avg days, T1 trend, per-source response rates) — both show empty-state messages when no data exists
- Full 288-test suite green; no TypeScript errors in new or modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: Source quality analytics module** - `2a9707b` (feat)
2. **Task 2: Market pulse analytics module** - `bdd5e22` (feat)
3. **Task 3: Extend analytics page with new panels** - `faeede8` (feat)

## Files Created/Modified

- `src/lib/analytics/source-quality.ts` — SOURCE_LABELS, computeSourceQuality(), querySourceQuality() with Drizzle GROUP BY on jobs.source + jobs.tier
- `src/lib/analytics/market-pulse.ts` — computeMarketPulse(), queryMarketPulse() with lastEventAt fallback for days-to-response, T1 weekly trend, per-source response rate
- `tests/unit/analytics/source-quality.test.ts` — 7 unit tests for computeSourceQuality() pure function
- `tests/unit/analytics/market-pulse.test.ts` — 7 unit tests for computeMarketPulse() pure function
- `src/app/(app)/analytics/page.tsx` — Added imports, two new Promise.all entries, return object fields, maxT1 computation, and two new panel sections

## Decisions Made

- Used `lastEventAt` fallback for days-to-response instead of joining `events` table — avoids `events.kind` format uncertainty noted in research; equivalent result for applications at terminal status
- ±5% band for T1 trend direction — small counts (e.g., 5 vs 6 T1 jobs) should not flip direction; only genuine shifts trigger up/down
- SOURCE_LABELS map in source-quality.ts (not market-pulse.ts) — imported by both modules, single source of truth

## Deviations from Plan

None — plan executed exactly as written. The `lastEventAt` fallback was the pre-selected approach in the plan's action block; no deviation required.

## Issues Encountered

- **Worktree path confusion:** The executor's CWD was the wrong project's worktree (Anaplan ETO). The correct worktree for the AI Job Search project did not exist yet — created it via `git worktree add` from the AI Job Search repo. Branch `claude/nostalgic-lamarr` created at base commit `6a71ba4` (matches target `6a71ba40c0d5001215e5ba8b14ff2abdf8ad478f`).
- **Test discovery:** Vitest config's `--root` flag required to resolve `@/` aliases to the worktree's `src/` directory when running tests from the main project's node_modules.
- **Pre-existing TS errors:** `inbox/[jobId]/docs/page.tsx` has 2 pre-existing `next: {}` RequestInit errors — out of scope, not introduced by this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 16-02 (Weekly Strategy Brief) can proceed immediately — `SOURCE_LABELS` is exported from source-quality.ts and can be reused; `loadData()` pattern and panel-grid layout are established
- Both new analytics modules follow the same queryXxx/computeXxx split that 16-02 should use for `generateWeeklyBrief()`

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/analytics/source-quality.ts | FOUND |
| src/lib/analytics/market-pulse.ts | FOUND |
| tests/unit/analytics/source-quality.test.ts | FOUND |
| tests/unit/analytics/market-pulse.test.ts | FOUND |
| 16-01-SUMMARY.md | FOUND |
| commit 2a9707b (Task 1) | FOUND |
| commit bdd5e22 (Task 2) | FOUND |
| commit faeede8 (Task 3) | FOUND |

---
*Phase: 16-analytics-reporting*
*Completed: 2026-04-17*
