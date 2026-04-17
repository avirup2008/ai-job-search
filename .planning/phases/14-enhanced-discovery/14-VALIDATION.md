---
phase: 14
slug: enhanced-discovery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/unit/sources/indeed-nl.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/sources/indeed-nl.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | R-81 | — | Parser returns [] for missing/invalid mosaic data | unit (RED) | `npx vitest run tests/unit/sources/indeed-nl.test.ts 2>&1 \| grep -E "(FAIL\|Cannot find module)"` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | R-81 | — | Parser correctly maps jobkey→sourceExternalId, snippet→jdText | unit (GREEN) | `npx vitest run tests/unit/sources/indeed-nl.test.ts` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | R-81 | — | IndeedNlSource added to allSources() registry | unit | `npx vitest run && npx next build 2>&1 \| tail -5` | ❌ update | ⬜ pending |
| 14-02-01 | 02 | 1 | R-82 | SSRF | POST /api/queue-url inserts job with hardFilterReason='queued' | unit (RED) | `npx vitest run tests/unit/api-routes.test.ts 2>&1 \| grep -E "(FAIL\|Cannot find module)"` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 1 | R-82 | — | Nightly scores url_paste queued rows; duplicate URL returns existing id | unit (GREEN) | `npx vitest run tests/unit/pipeline/queue-url-scoring.test.ts` | ❌ W0 | ⬜ pending |
| 14-02-03 | 02 | 1 | R-82 | — | Full suite green after orchestrator hook | unit | `npx vitest run` | ✅ existing | ⬜ pending |
| 14-03-01 | 03 | 2 | R-82 | — | QueueUrlForm renders, validates URL, blocks LinkedIn | unit (RED) | `npx vitest run tests/unit/components/queue-url-form.test.tsx 2>&1 \| grep -E "(FAIL\|Cannot find module)"` | ❌ W0 | ⬜ pending |
| 14-03-02 | 03 | 2 | R-82 | — | QueueUrlForm mounted in inbox/page.tsx | unit (GREEN) | `npx vitest run tests/unit/components/queue-url-form.test.tsx` | ❌ W0 | ⬜ pending |
| 14-03-03 | 03 | 2 | R-82 | — | Human checkpoint: URL queued in UI, appears in inbox after nightly | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/fixtures/indeed-nl-search.html` — synthetic fixture with `window.mosaic.providerData["mosaic-provider-jobcards"]` shape (or real captured response)
- [ ] `tests/unit/sources/indeed-nl.test.ts` — fixture-based parse tests (5 cases: happy path, empty results, missing mosaic key, 403 HTML, malformed JSON)
- [ ] `tests/unit/pipeline/queue-url-scoring.test.ts` — orchestrator pre-pass picks up queued url_paste rows, scores them, clears sentinel

*Existing infrastructure covers all other test needs (vitest.config.ts, existing api-routes.test.ts pattern).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| URL pasted in UI → confirmation shown → job appears in inbox after nightly run | R-82 | Requires real nightly cron execution against live DB | 1. Open app, paste a non-LinkedIn job URL. 2. Confirm toast/confirmation shown. 3. Next morning: verify job appears in inbox with tier assigned. |
| Indeed NL jobs appear in inbox after nightly run | R-81 | Requires live nl.indeed.com access from Vercel cron | Check run summary after first nightly post-deploy: `perSource['indeed-nl'] > 0` |
