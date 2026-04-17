---
phase: 16
slug: analytics-reporting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-T1 | 16-01 | 1 | R-83 | unit | `npm test -- tests/unit/analytics/source-quality.test.ts` | No — Wave 0 | pending |
| 16-01-T2 | 16-01 | 1 | R-88 | unit | `npm test -- tests/unit/analytics/market-pulse.test.ts` | No — Wave 0 | pending |
| 16-01-T3 | 16-01 | 1 | R-83 + R-88 | build | `npm run build` | Yes | pending |
| 16-02-T1 | 16-02 | 2 | R-87 | unit | `npm test -- tests/unit/analytics/weekly-brief.test.ts` | No — Wave 0 | pending |
| 16-02-T2 | 16-02 | 2 | R-87 | unit | `npm test -- tests/unit/analytics/weekly-brief.test.ts` | No — Wave 0 | pending |
| 16-02-T3 | 16-02 | 2 | R-87 | smoke | `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $CRON_SECRET" $URL/api/cron/weekly-brief` | No | pending |
| 16-02-T4 | 16-02 | 2 | R-87 | build | `npm run build` | Yes | pending |

---

## Wave 0 Gaps (test files to create before execution)

- [ ] `tests/unit/analytics/source-quality.test.ts` — covers R-83: pure function test with mocked DB results; verify T1 count, total count, T1 conversion rate calculation (no division by zero), SOURCE_LABELS map lookups
- [ ] `tests/unit/analytics/weekly-brief.test.ts` — covers R-87: rules engine branches (behind pace, on pace, T1 unapplied, T1 partially applied, top source fallback); no DB dependency; all rules tested with inline data
- [ ] `tests/unit/analytics/market-pulse.test.ts` — covers R-88: days-to-response computation from `lastEventAt - appliedAt` fallback; T1 trend week-vs-4-week-avg calculation with mocked row data

**Note:** All three test files test pure/near-pure functions. Analytics query functions must be structured so SQL is in one function (testable with a mock) and computation/rules are in a separate pure function (testable without DB). This mirrors the `keywords.ts` pattern (`extractKeywordCounts` is pure, DB call is separate).

---

## Security Checks

| Control | ASVS | Requirement | Verification |
|---------|------|-------------|--------------|
| Cron route auth | V4 | Must reject unauthenticated requests | `curl` without Authorization header returns 401 |
| CRON_SECRET bearer check | V4 | Same pattern as purge/nightly cron | Code review: `auth !== \`Bearer \${cronEnv.CRON_SECRET}\`` |
| SQL injection guard | V5 | No user strings interpolated into `sql<>` templates | Code review: all `sql<>` parameters are schema columns or typed JS values |
| Analytics page auth | V4 | Page is behind existing layout auth | Existing middleware handles; no new exposure surface |
