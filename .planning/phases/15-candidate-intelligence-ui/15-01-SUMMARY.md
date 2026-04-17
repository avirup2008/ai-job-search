---
phase: 15-candidate-intelligence-ui
plan: "01"
subsystem: gap-coach
tags: [gap-coach, ui, server-component, tdd]
dependency_graph:
  requires: [schema.jobs.tier, schema.jobs.fitScore, schema.jobs.gapAnalysis, schema.companies.name]
  provides: [/gap-coach route, GapCoachList component, shapeGapCoachRow, sortGapCoachRows]
  affects: [TopBar nav, /inbox/[jobId] (click target)]
tech_stack:
  added: []
  patterns: [TDD red-green, Drizzle leftJoin, Next.js App Router server component]
key_files:
  created:
    - src/components/gap-coach/GapCoachList.tsx
    - src/app/(app)/gap-coach/page.tsx
    - src/app/(app)/gap-coach/gap-coach.css
    - tests/unit/gap-coach.test.ts
  modified:
    - src/components/app-shell/TopBar.tsx
decisions:
  - shapeGapCoachRow uses Math.max(0, 85 - score) so delta never goes negative for T1-boundary jobs
  - GapCoachList has no "use client" — fully server-safe; all interactivity is Link navigation
  - SQL join uses sql template literal to match existing inbox/page.tsx pattern
metrics:
  duration_seconds: 155
  completed_date: "2026-04-17"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 15 Plan 01: Profile Gap Coach Summary

**One-liner:** Server-rendered Gap Coach page listing T2 jobs ranked by closeness-to-T1, with per-job blocking gap strings and nav link, built TDD with 6 green unit tests.

## What Was Built

R-85 is fully satisfied. Upashana can navigate to `/gap-coach` from the top nav and see all T2 jobs (tier=2) ranked by fitScore descending (closest to T1 first), with each row showing:
- Company avatar, job title, company name
- fitScore as `NN%`
- Closeness delta as `−N pts to T1`
- A "What's holding this back" list of gap strings from `gapAnalysis.gaps`
- Each row links to `/inbox/${job.id}`

Empty state renders when no T2 jobs exist.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write failing unit tests (RED) | fed08b6 | tests/unit/gap-coach.test.ts |
| 2 | Implement Gap Coach page + component + CSS (GREEN) | 2b07958 | src/components/gap-coach/GapCoachList.tsx, src/app/(app)/gap-coach/page.tsx, src/app/(app)/gap-coach/gap-coach.css |
| 3 | Add Gap Coach nav link in TopBar | b63a594 | src/components/app-shell/TopBar.tsx |

## Verification Results

- `npx vitest run tests/unit/gap-coach.test.ts` — 6/6 tests pass
- `npx next build` — compiles cleanly; `/gap-coach` appears as `○ (Static)` route
- Acceptance criteria: all met (eq/desc literals present, exports confirmed, no "use client", CSS selectors present, NAV has 5 entries with gap-coach after inbox)

## Deviations from Plan

None — plan executed exactly as written. TDD flow followed (RED commit at fed08b6, GREEN at 2b07958).

## Known Stubs

None. All data is wired from the live database query. `gapAnalysis.gaps` is populated by the scoring pipeline and displayed verbatim.

## Threat Flags

No new threat surface introduced. The gap-coach page is a read-only server component behind the existing app auth middleware. No new endpoints, no user input, no file access.

## Self-Check

- [x] `tests/unit/gap-coach.test.ts` exists
- [x] `src/components/gap-coach/GapCoachList.tsx` exists
- [x] `src/app/(app)/gap-coach/page.tsx` exists
- [x] `src/app/(app)/gap-coach/gap-coach.css` exists
- [x] Commits fed08b6, 2b07958, b63a594 exist in git log

## Self-Check: PASSED
