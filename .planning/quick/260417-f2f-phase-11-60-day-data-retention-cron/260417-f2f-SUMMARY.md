# Quick Task 260417-f2f — SUMMARY

**Description:** Phase 11: 60-day data retention cron
**Date:** 2026-04-17
**Status:** ✅ complete

## What shipped

A Vercel-native daily cron that purges stale jobs + cascades their generated
artifacts (including Blob storage bytes), gated behind an env-level dry-run so
the first production run is observe-only.

### Retention policy (locked)

| application.status | Behaviour |
|---|---|
| `applied`, `interviewing`, `offered` | **Retained forever** |
| `rejected`, `discarded`, `saved`, `new` | Purged when idle >60 days |

A job is purged only if **every** application row attached to it falls in the
purgeable set AND the most recent `lastEventAt` across those apps is older than
the 60-day cutoff. Mixed-status jobs (any one app in applied/interviewing/offered)
survive regardless of age.

## Commits

| SHA | Message |
|---|---|
| `c1cb7a7` | feat(retention): add purge logic + env flag with tests |
| `a8fd20d` | feat(retention): wire /api/cron/purge + vercel cron entry |

## Files

- `src/lib/env.ts` — new `retentionSchema` + `loadRetentionEnv()` with `RETENTION_DRY_RUN` default `"true"`
- `src/lib/retention/purge.ts` — `selectPurgeCandidates()` + `purgeOldJobs()`, blob-before-DB ordering
- `src/app/api/cron/purge/route.ts` — GET handler, Bearer CRON_SECRET auth, dry-run resolution
- `vercel.ts` — crons entry `{ path: "/api/cron/purge", schedule: "0 1 * * *" }` (01:00 UTC = 03:00 Amsterdam CEST)
- `tests/retention/purge.test.ts` — 7 passing tests covering filter, boundary, dry-run, call-order

## Verification

- ✅ `npm test tests/retention/purge.test.ts` — 7/7 passing
- ✅ `npm run typecheck` — clean
- ✅ `npm run build` — `/api/cron/purge` discovered as ƒ (Dynamic)
- ⚠ `npm run lint` — pre-existing broken script (`next lint` removed in Next 16), unrelated

## First-deploy checklist (for Avi)

1. **Set env var on Vercel:** `RETENTION_DRY_RUN=true` (or leave unset — default is `"true"`)
2. **Set `CRON_SECRET`** on Vercel if not already present (min 32 chars)
3. **Deploy.** Vercel will register the cron.
4. Wait for the first 01:00 UTC run (or trigger manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://disha-cloud.vercel.app/api/cron/purge`)
5. **Inspect logs:** look for `[cron:purge] {...}` line. Check `jobsDeleted`, `applicationsDeleted`, `documentsDeleted` counts match what you'd expect — remember `dryRun:true` means nothing was actually deleted.
6. **When satisfied:** flip `RETENTION_DRY_RUN=false` on Vercel → redeploy (or wait for next deploy). Retention goes live.

## Decisions honored (from user)

- D-01 Status filter (rejected/discarded/saved/new only)
- D-02 Cascade via schema's existing `onDelete: "cascade"` (applications → documents/events/screening_answers); blobs `del()`ed explicitly BEFORE `db.delete(jobs)`, asserted by a unit test on call order
- D-03 `GET /api/cron/purge` + Bearer auth mirroring `nightly/route.ts`
- D-04 `?dryRun=1` honored when env is `"false"`
- D-05 `RETENTION_DRY_RUN=true` default → forces dry-run regardless of query
- D-06 `0 1 * * *` (UTC) ≈ 03:00 Amsterdam
- D-07 Response JSON + structured log line with all required counters

## Deviations

- Schema uses `lastEventAt`, not `updatedAt` — caught during planning, plan was corrected
- `freedBytes: 0` with a comment — opted out of HEAD-ing each blob URL (per-plan allowance); byte accounting lives on the Vercel Blob dashboard anyway

## Notes

- The quick-task planning artifacts were initially created in the wrong repo
  (`.claude/worktrees/nostalgic-lamarr` is actually an unrelated Anaplan ETO
  project sharing the directory tree). Plan was copied into Disha's own
  `.planning/quick/` and executed against main.
