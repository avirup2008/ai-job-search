# STATE — AI Job Search

**Last updated:** 2026-04-17
**Current milestone:** v1 (1-month job search) · **Week 1 ✅ shipped**
**Current phase:** Phase 11 retention shipped · Phase 12 (A/B + Screening + Interview) next

Last activity: 2026-04-17 — Completed quick task 260417-f2f: Phase 11: 60-day data retention cron

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
| 12 A/B + Screening + Interview | not started | ← next |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260417-f2f | Phase 11: 60-day data retention cron | 2026-04-17 | a8fd20d | [260417-f2f-phase-11-60-day-data-retention-cron](./quick/260417-f2f-phase-11-60-day-data-retention-cron/) |

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
