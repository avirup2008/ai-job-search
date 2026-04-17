---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
current_phase: 15
status: Ready to plan
last_updated: "2026-04-17T15:16:31.893Z"
last_activity: 2026-04-17
progress:
  total_phases: 16
  completed_phases: 2
  total_plans: 9
  completed_plans: 6
  percent: 67
---

# STATE — AI Job Search

**Last updated:** 2026-04-17
**Current milestone:** v2.0 Smarter Disha
**Current phase:** 15

Last activity: 2026-04-17

## Progress

| Phase | Status | Notes |
|---|---|---|
| 1 Infrastructure & Data Model | ✅ complete | Neon EU + 14 tables |
| 2 LLM Platform + Budget | ✅ complete | Haiku-fit replaces embeddings |
| 3 Discovery Sources | ✅ complete | 4 sources live; Werk.nl replaced with Magnet.me |
| 4 Pipeline Logic | ✅ complete | filters + dedupe + tier + profile seeded to Neon |
| 5 Orchestration + Admin + Cron | ✅ complete | GH Actions cron + admin UI live in prod |
| 6 Week-1 Deploy & Acceptance | ✅ complete | Live at ai-job-search-eta.vercel.app; ~508 jobs in DB, ~15 T1 |
| 7 Company Research | ✅ complete | |
| 8 Generation Pipeline | ✅ complete | |
| 9 Web App UI | ✅ complete | |
| 10 Paste-JD + Auth | ✅ complete | Paste-a-role + profile editing + download pack (auth skipped — personal project) |
| 11 Reveal & Live Ops | ⚠ partial | Retention cron shipped (quick 260417-f2f); reveal done live; GDPR + domain skipped by user |
| 12 A/B + Screening + Interview | ⚠ partial | Interview prep shipped (quick 260417-fiz); A/B + extra screening skipped by user (not valuable for n=1) |
| 13 Smarter Scoring + ATS Keyword Pass | ✅ complete | R-78 ✅ R-79 ✅ R-80 ✅ R-84 ✅ — all 3 plans done |
| 14 Enhanced Discovery | Not started | v2.0 — R-81, R-82 |
| 15 Candidate Intelligence UI | 📋 planned | v2.0 — R-85, R-86, R-89 — 3 plans, Wave 1-2 |
| 16 Analytics & Reporting | 📋 planned | v2.0 — R-83, R-87, R-88 — 2 plans, Wave 1-2 |

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260417-f2f | Phase 11: 60-day data retention cron | 2026-04-17 | a8fd20d | — | [260417-f2f-phase-11-60-day-data-retention-cron](./quick/260417-f2f-phase-11-60-day-data-retention-cron/) |
| 260417-fiz | Phase 12: interview prep generation | 2026-04-17 | 01423ab | — | [260417-fiz-phase-12-interview-prep-generation](./quick/260417-fiz-phase-12-interview-prep-generation/) |
| 260417-g4p | Wire real data into analytics page charts | 2026-04-17 | 181e977 | — | [260417-g4p-wire-real-data-into-analytics-page-chart](./quick/260417-g4p-wire-real-data-into-analytics-page-chart/) |
| 260417-kgd | Fix auth gap, fire-and-forget async, and retention of filtered jobs | 2026-04-17 | 6307d67 | — | [260417-kgd-fix-auth-gap-fire-and-forget-async-and-r](./quick/260417-kgd-fix-auth-gap-fire-and-forget-async-and-r/) |
| 260417-kqy | Build polished Disha login page as app homepage | 2026-04-17 | c430e50 | — | [260417-kqy-build-polished-disha-login-page-as-app-h](./quick/260417-kqy-build-polished-disha-login-page-as-app-h/) |
| 260417-o87 | Close Codex review gap 93→97+ (auth tests, diagnostics, storage contract, cleanup) | 2026-04-17 | 298f513 | Verified | [260417-o87-close-codex-review-gap-93-97-auth-tests-](./quick/260417-o87-close-codex-review-gap-93-97-auth-tests-/) |

## Completed before GSD init

- Design spec written, critiqued by 3 agents, revised, committed: `docs/superpowers/specs/2026-04-14-ai-job-search-design.md`
- Week 1 detailed implementation plan (24 TDD tasks) committed: `docs/superpowers/plans/2026-04-14-week-1-foundation.md` — this plan will be the foundation for Phases 1-6 when `/gsd-plan-phase` is invoked
- Repo initialized; `main` branch; two commits

## Decisions locked

- Quality-first strategy (deep tailoring + proof artifacts > volume)
- LinkedIn: no scraping; aggregators + paste-JD workflow
- LLM: Anthropic API via Vercel AI Gateway, €20/mo hard cap, tiered routing
- No local-Mac worker dependency (retired after 3-agent critique)
- English-only outputs in v1
- Single-user (owner + admin); no multi-tenant
- Claude writes all code via subagents; Avi approves at phase gates + provides secrets
- v2.0: No new paid API keys; no new direct LLM calls outside nightly cron

## Open questions

- Commute tolerance value (will capture from Avi during Phase 1 profile intake)
- Reveal-day scheduling (planned end of Phase 10)
- Final domain name (TBD; default to `*.vercel.app` until decided)

## Session log

**2026-04-14** Initial GSD scaffolding from existing superpowers spec + plan. Granularity = fine (12 phases). Research = on. Parallelization = on. Git commit of planning docs = on.

**2026-04-17** v2.0 Smarter Disha milestone started. Roadmap created: Phases 13-16 covering R-78 through R-89.

**2026-04-17** Executed 13-02: ScoreBreakdown UI (R-78), drift badges (R-80), feedback multiplier hook (R-79). 3 tasks, 6 files modified, 2 created. 209/209 tests pass.

**2026-04-17** Executed 13-03: ATS keyword post-pass module (R-84), wired into generateCV(), nightly batch CV generation for T1/T2 (cap 5, p-limit 2). 10 unit tests, zero new LLM calls. 209 tests pass.

**2026-04-17** Phase 13 complete. All 4 requirements satisfied (R-78, R-79, R-80, R-84). 9 commits total. Next: Phase 14 Enhanced Discovery (R-81 Indeed NL, R-82 URL paste).

---
**Pre-compact 2026-04-17T12:54:52+02:00**
