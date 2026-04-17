---
phase: quick
plan: 260417-kgd
subsystem: security, server-actions, retention
tags: [auth, middleware, edge, async, purge, retention]
dependency_graph:
  requires: []
  provides:
    - "Edge middleware gating (app) route group and LLM generation APIs"
    - "Awaited interview-prep and rescore in server actions"
    - "180-day orphan job purge in retention cron"
  affects:
    - src/middleware.ts
    - src/app/(app)/pipeline/actions.ts
    - src/app/(app)/profile/actions.ts
    - src/lib/retention/purge.ts
tech_stack:
  added: []
  patterns:
    - "Next.js edge middleware with cookie-check (no next/headers on Edge runtime)"
    - "Awaited async in Vercel serverless server actions"
    - "JS-side deduplication instead of selectDistinct for mock-compatible Drizzle queries"
key_files:
  created:
    - src/middleware.ts
  modified:
    - src/app/(app)/pipeline/actions.ts
    - src/app/(app)/profile/actions.ts
    - src/lib/retention/purge.ts
decisions:
  - "Read cookie directly from request in middleware — next/headers is not available on Edge runtime"
  - "Used db.select() + JS dedup instead of db.selectDistinct() in selectOrphanJobIds to keep test mock compatibility"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-17"
  tasks_completed: 3
  files_modified: 4
---

# Quick Task 260417-kgd Summary

**One-liner:** Edge cookie middleware gates all (app) pages and generate/download-pack APIs; interview-prep and rescore server actions are now fully awaited; retention cron purges orphaned jobs (no application row, 180+ days old).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create middleware.ts to gate (app) and API routes | b28f5c2 | src/middleware.ts (created) |
| 2 | Await fire-and-forget async in pipeline and profile actions | 548664c | pipeline/actions.ts, profile/actions.ts |
| 3 | Purge orphaned jobs with no application rows | 6307d67 | src/lib/retention/purge.ts |

## What Was Done

### Task 1: Edge Middleware Auth Gate

Created `src/middleware.ts` as a Next.js edge middleware. Reads the `aijs_admin` cookie directly from `request.cookies` (not via `next/headers` — that API is unavailable at the Edge runtime). Compares against `process.env.ADMIN_SECRET` and fails closed if the env var is absent.

- Page routes (`/inbox`, `/pipeline`, `/analytics`, `/paste` and sub-paths): redirect to `/admin/login`
- API routes (`/api/generate/*`, `/api/download-pack/*`): return `{ error: "unauthorized" }` with status 401
- `config.matcher` restricts middleware execution to these paths only — `/p/*`, `/admin/*`, `/api/cron/*` are not matched

### Task 2: Awaited Server Actions

**pipeline/actions.ts:** Replaced the `void (async () => { ... })()` IIFE surrounding interview-prep generation with a direct `try/await` block. The generation and storage calls are now awaited before the server action returns, preventing Vercel from cutting off the function mid-write.

**profile/actions.ts:** Converted `triggerRescore()` from a fire-and-forget `.then()/.catch()` chain to `async function triggerRescore()` with `await rescoreMatchedJobs()`. Updated all 5 call sites (`addTool`, `removeTool`, `addAchievement`, `removeAchievement`, `updatePreferences`) from `triggerRescore()` to `await triggerRescore()`.

### Task 3: Orphan Job Purge

Added to `src/lib/retention/purge.ts`:
- `ORPHAN_RETENTION_DAYS = 180` constant
- `selectOrphanJobIds(now)` — fetches all jobs with `discoveredAt < now - 180d`, filters out any that have at least one application row (via JS Set), returns the orphan IDs
- `purgeOldJobs` now calls `selectOrphanJobIds` in addition to `selectPurgeCandidates`, merges results with deduplication, and uses `allJobIds` for the delete
- `lt` imported from `drizzle-orm`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] selectDistinct unavailable in test mock**
- **Found during:** Task 3 verification (vitest run)
- **Issue:** The test mock for `@/db` only implements `db.select()`, not `db.selectDistinct()`. Calling `selectDistinct` caused 3 test failures: `TypeError: db.selectDistinct is not a function`
- **Fix:** Replaced `db.selectDistinct(...)` with `db.select(...)` in `selectOrphanJobIds`. The Set-based deduplication already handles duplicate jobIds in JS, so `selectDistinct` was not needed for correctness.
- **Files modified:** src/lib/retention/purge.ts
- **Commit:** 6307d67 (amended into Task 3 commit)

## Verification

- `npx tsc --noEmit`: zero errors
- `npx vitest run`: 209/209 tests pass (37 test files)
- Middleware `config.matcher` inspection: `/p/*` and `/api/cron/*` are not listed — they remain publicly accessible

## Known Stubs

None.

## Threat Flags

None — all four threats in the plan's threat model are now mitigated by this implementation.

## Self-Check: PASSED

- src/middleware.ts: FOUND
- src/app/(app)/pipeline/actions.ts: FOUND (void IIFE removed, direct await in place)
- src/app/(app)/profile/actions.ts: FOUND (triggerRescore async, all 5 sites awaited)
- src/lib/retention/purge.ts: FOUND (selectOrphanJobIds exported, allJobIds used)
- Commits b28f5c2, 548664c, 6307d67: FOUND in git log
