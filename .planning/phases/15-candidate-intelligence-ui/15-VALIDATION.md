---
phase: 15
slug: candidate-intelligence-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run tests/unit/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-T1 | 15-01 | 1 | R-85 | unit | `npx vitest run tests/unit/gap-coach.test.ts` | No — Wave 0 | pending |
| 15-01-T2 | 15-01 | 1 | R-85 | unit | `npx vitest run tests/unit/gap-coach.test.ts` | No — Wave 0 | pending |
| 15-01-T3 | 15-01 | 1 | R-85 | build | `npm run build` | Yes | pending |
| 15-02-T1 | 15-02 | 1 | R-86 | unit | `npx vitest run tests/unit/research-prompt.test.ts` | No — Wave 0 | pending |
| 15-02-T2 | 15-02 | 1 | R-86 | unit | `npx vitest run tests/unit/research-prompt.test.ts` | No — Wave 0 | pending |
| 15-02-T3 | 15-02 | 1 | R-86 | build | `npm run build` | Yes | pending |
| 15-03-T1 | 15-03 | 2 | R-89 | install | `node -e "require('pdf-lib')"` | No — Wave 0 | pending |
| 15-03-T2 | 15-03 | 2 | R-89 | unit | `npx vitest run tests/unit/pdf-brief.test.ts` | No — Wave 0 | pending |
| 15-03-T3 | 15-03 | 2 | R-89 | smoke | `curl -s -o /dev/null -w "%{http_code}" $URL/api/interview-brief/missing` | No | pending |
| 15-03-T4 | 15-03 | 2 | R-89 | build | `npm run build` | Yes | pending |

---

## Wave 0 Gaps (test files to create before execution)

- [ ] `tests/unit/gap-coach.test.ts` — covers R-85: T2 job query shape, fitScore sort order desc, delta calculation (85 - fitScore)
- [ ] `tests/unit/research-prompt.test.ts` — covers R-86: prompt assembly includes all required fields (role, company, JD, dossier), null-dossier graceful omission
- [ ] `tests/unit/pdf-brief.test.ts` — covers R-89: buildInterviewBriefPdf returns non-empty Uint8Array, route returns 404 on missing data

---

## Security Checks

| Control | ASVS | Requirement | Verification |
|---------|------|-------------|--------------|
| Auth guard on PDF route | V2/V4 | Must reject unauthenticated requests | `curl` without cookie returns 401/302 |
| jobId parameterization | V5 | UUID validated via Drizzle parameterized query | Code review: `eq(schema.jobs.id, jobId)` |
| No LLM calls in prompt assembly | — | Zero API cost | Code review: no `getLLM()` call in research-prompt.ts |
| Status verified server-side for PDF | V4 | Don't trust client status | Code review: route re-queries application status |
