---
phase: 260417-g4p
plan: 01
subsystem: analytics-ui
tags: [analytics, drizzle, postgres, data-viz, skills]
dependency_graph:
  requires: [schema.jobs.discoveredAt, schema.jobs.fitScore, schema.applications.appliedAt, schema.profile]
  provides: [real-analytics-charts, keyword-extraction-helper]
  affects: [src/app/(app)/analytics/page.tsx]
tech_stack:
  added: []
  patterns: [drizzle-date_trunc-groupby, carry-forward-fill, 13x7-heatmap-grid, keyword-presence-counting]
key_files:
  created:
    - src/lib/analytics/keywords.ts
  modified:
    - src/app/(app)/analytics/page.tsx
decisions:
  - "Carry-forward fill for missing days in match quality trend (honest, smooth, no gaps)"
  - "Presence-based keyword counting (1 per JD, not frequency-within-doc) to avoid verbose JD bias"
  - "13x7 heatmap grid (91 days) replacing original 4x7 mock"
  - "PIPELINE_STAGES import retained with void suppression to preserve future compatibility"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  files_touched: 2
---

# Quick Task 260417-g4p: Wire Real Data into Analytics Page Charts — Summary

**One-liner:** Replaced three mock-data generators on the analytics page with live Postgres-backed queries: daily avg fitScore trend (30d), applications-per-day heatmap (90d/13wk), and keyword skills panel with strength/gap colouring from profile.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create keyword extraction helper | 5c4e149 | src/lib/analytics/keywords.ts (created) |
| 2 | Wire real queries into all three analytics charts | 181e977 | src/app/(app)/analytics/page.tsx (modified) |

## What Was Built

### Task 1 — `src/lib/analytics/keywords.ts`
- `KEYWORDS`: 40-entry curated list covering marketing/growth domain (CRM tools, analytics platforms, paid media, growth concepts)
- `extractKeywordCounts(jdTexts)`: word-boundary regex, presence-based (at most 1 per JD), returns `Map<string, number>`
- `profileKeywordSet(profile)`: flattens headline + toolStack + roles + achievements + industries into lowercase blob, returns `Set<string>` of matched keywords
- Pure functions, no DB access, no new dependencies

### Task 2 — `src/app/(app)/analytics/page.tsx`
Four new queries added to the `Promise.all` in `loadData()`:
1. `matchQualityTrend` — `date_trunc('day', discovered_at)` group-by, tier IN (1,2,3), last 30 days, avg fitScore
2. `applicationsPerDay` — `date_trunc('day', applied_at)` group-by, appliedAt IS NOT NULL, last 90 days
3. `jdTextsForKeywords` — all tier 1-3 jdText values for keyword extraction
4. `profileRows` — single profile row (headline, roles, toolStack, achievements, industries)

Data shaping in `loadData()` return:
- `matchQuality`: 30-day grid with carry-forward fill for missing days; leading zeros trimmed (min 2 points)
- `heatmap`: 91-day flat array bucketed into 13×7 matrix, levels 0-4 by quantile of max daily count
- `skills`: top-15 keywords by JD presence count, each tagged `inProfile: boolean`

JSX changes:
- Match quality SVG: `hasMatchData` guard — renders "Not enough data yet" caption when < 2 scored points
- Heatmap: now renders 13 weekly rows (was hardcoded 4); JSX unchanged, data drives row count
- Skills panel: renamed "Top skills in your matches", orange/green bars via inline `style.background` with `var(--accent)` / `var(--warn, #e08a3b)`, legend added above list
- All existing KPI, score distribution, location dedup, funnel, and budget panels untouched

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `heatmap` referenced as bare variable in JSX instead of `d.heatmap`**
- **Found during:** Task 2 typecheck pass
- **Issue:** Page function local scope had no `heatmap` variable (correctly moved into `loadData()` return); JSX referenced bare `heatmap` which caused TS2304 + implicit-any errors
- **Fix:** Changed `{heatmap.map(...)}` to `{d.heatmap.map(...)}` in the heatmap-grid section
- **Files modified:** `src/app/(app)/analytics/page.tsx`
- **Commit:** 181e977 (same commit, fixed before final commit)

## Known Stubs

None — all three previously-mocked panels now read from real DB state.

## Self-Check

- [x] `src/lib/analytics/keywords.ts` exists
- [x] `src/app/(app)/analytics/page.tsx` has no references to `mockMatchQualityData` or `mockHeatmapData`
- [x] `npm run typecheck` passes with zero errors
- [x] Commits 5c4e149 and 181e977 exist in git log

## Self-Check: PASSED
