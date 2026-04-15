# Phase 5 — Verification Report

**Status:** ✅ COMPLETE — 2026-04-15
**Commits:** `b57afa2` (Plan 5.2), `29d8c20` (Plan 5.3), `8656923` (GH Actions cron), `312c2c2` (429 retries), `317a41e` (parallelize), `e4869d3` (rate-limit fix), plus orchestrator commits in Phase 4.

## Requirements satisfied

| R-id | Requirement | Evidence |
|---|---|---|
| R-26 | Discover stage | Live: 360-455 jobs/night |
| R-32 | Orchestrator resumable/idempotent | Unique index on (source, sourceExternalId) + re-rank-on-null cleanup |
| R-33 | Idempotency: re-runs don't duplicate | Verified today: 290 skipped as dupes |
| R-54 | Admin with profile, watchlist, runs, budget, trigger | 5 admin routes live in prod |
| R-56 | Vercel Cron nightly at a work window | **Moved to GitHub Actions** — Vercel Hobby capped at daily crons. GH Actions `*/15 0-5 * * *` |
| R-57 | Heartbeat email on success | Deferred (Resend skipped per spec update); admin runs view covers it |
| R-58 | Failure email on error | Same — deferred |
| R-59 | Manual-trigger endpoint for admin | `/api/admin/trigger-run` with cookie auth |
| R-60 | Health endpoint | `/api/health` — returns `{ok: true, ts}` live |
| R-75 | Runs table per execution | Live — today's run `6cae31b3-0ff8-4fa7-9ee0-82faeee5ae0c` persisted |
| R-77 | Source health dashboard | Runs view shows `perSource` counts per run |

## Architectural deviations from spec

- **Cron moved out of Vercel.** Vercel Hobby caps cron frequency to daily (1/run); our pipeline needs ~24 invocations/night to fit the 300s function cap. GitHub Actions workflow `.github/workflows/nightly-cron.yml` runs every 15 min during 00:00-05:59 UTC and calls `/api/cron/nightly` with `Bearer CRON_SECRET`. Keeps infra free. Protocol unchanged — endpoint still uses Vercel's expected `Authorization` header format.
- **Resend deferred** — email notifications dropped for v1 per pragmatic re-scoping. Vercel's platform-level failure notifications cover silent-fail detection.
- **Parallelization + retry hardening** — orchestrator now uses `p-limit(3)` with Anthropic SDK `maxRetries: 8` to survive ITPM rate-limit bursts. Zero rank failures on today's real run.

## Live verification

**Today's GitHub-triggered run (2026-04-15):**
- Duration: 3m 11s (under 300s cap ✅)
- Discovered: 360, skipped as dupes: 290, inserted: 62
- Filtered: 6 hard-filtered
- Ranked: 56 with zero errors (maxRetries fix working)
- byTier: T1=1, T2=16, T3=24, filtered=21
- End-to-end: GitHub Actions → Vercel /api/cron/nightly → runNightly() → Neon

## Current production state

- URL: https://ai-job-search-eta.vercel.app
- Deployment protection: OFF (personal use)
- Env vars: Anthropic, OpenAI-style (unused), Adzuna, Jooble, Neon, CRON_SECRET, ADMIN_SECRET — all set
- Admin login works with stored cookie
- pipeline fires every 15 min during UTC 00:00-05:59

## Gate

**Phase 5 complete.** Ready for Phase 6 closeout and Phase 7 (Company Research).
