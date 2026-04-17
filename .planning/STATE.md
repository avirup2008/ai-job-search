# STATE — AI Job Search

**Last updated:** 2026-04-17
**Current milestone:** v2.0 Smarter Disha
**Current phase:** Not started (defining requirements)

Last activity: 2026-04-17 — Milestone v2.0 started

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

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260417-f2f | Phase 11: 60-day data retention cron | 2026-04-17 | a8fd20d | [260417-f2f-phase-11-60-day-data-retention-cron](./quick/260417-f2f-phase-11-60-day-data-retention-cron/) |
| 260417-fiz | Phase 12: interview prep generation | 2026-04-17 | 01423ab | [260417-fiz-phase-12-interview-prep-generation](./quick/260417-fiz-phase-12-interview-prep-generation/) |
| 260417-g4p | Wire real data into analytics page charts | 2026-04-17 | 181e977 | [260417-g4p-wire-real-data-into-analytics-page-chart](./quick/260417-g4p-wire-real-data-into-analytics-page-chart/) |

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

## Open questions

- Commute tolerance value (will capture from Avi during Phase 1 profile intake)
- Reveal-day scheduling (planned end of Phase 10)
- Final domain name (TBD; default to `*.vercel.app` until decided)

## Session log

**2026-04-14** Initial GSD scaffolding from existing superpowers spec + plan. Granularity = fine (12 phases). Research = on. Parallelization = on. Git commit of planning docs = on.
