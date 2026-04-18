---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Smarter Disha
current_phase: 16
status: Milestone complete
last_updated: "2026-04-18T10:45:00.000Z"
last_activity: 2026-04-18
progress:
  total_phases: 16
  completed_phases: 16
  total_plans: 11
  completed_plans: 11
  percent: 100
---

# STATE — AI Job Search

**Last updated:** 2026-04-18
**Current milestone:** v2.0 Smarter Disha — COMPLETE
**Current phase:** 16

Last activity: 2026-04-18

## Progress

| Phase | Status | Notes |
|---|---|---|
| 1 Infrastructure & Data Model | ✅ complete | Neon EU + 14 tables |
| 2 LLM Platform + Budget | ✅ complete | Haiku-fit replaces embeddings |
| 3 Discovery Sources | ✅ complete | 4 sources live; Werk.nl replaced with Magnet.me |
| 4 Pipeline Logic | ✅ complete | filters + dedupe + tier + profile seeded to Neon |
| 5 Orchestration + Admin + Cron | ✅ complete | GH Actions cron + admin UI live in prod |
| 6 Week-1 Deploy & Acceptance | ✅ complete | Live at disha-cloud.vercel.app; ~508 jobs in DB, ~15 T1 |
| 7 Company Research | ✅ complete | |
| 8 Generation Pipeline | ✅ complete | |
| 9 Web App UI | ✅ complete | |
| 10 Paste-JD + Auth | ✅ complete | Paste-a-role + profile editing + download pack (auth skipped — personal project) |
| 11 Reveal & Live Ops | ⚠ partial | Retention cron shipped (quick 260417-f2f); reveal done live; GDPR + domain skipped by user |
| 12 A/B + Screening + Interview | ⚠ partial | Interview prep shipped (quick 260417-fiz); A/B + extra screening skipped by user (not valuable for n=1) |
| 13 Smarter Scoring + ATS Keyword Pass | ✅ complete | R-78 ✅ R-79 ✅ R-80 ✅ R-84 ✅ — all 3 plans done |
| 14 Enhanced Discovery | ✅ complete | R-81 ✅ Indeed NL restored via Apify (Cloudflare bypass); R-82 ✅ URL paste already built |
| 15 Candidate Intelligence UI | ✅ complete | R-85 ✅ Gap Coach; R-86 ✅ Interview research prompt + clipboard; R-89 ✅ PDF interview brief |
| 16 Analytics & Reporting | ✅ complete | R-83 ✅ Source Quality panel; R-88 ✅ Market Pulse panel; R-87 ✅ Weekly Strategy Brief cron |

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260417-f2f | Phase 11: 60-day data retention cron | 2026-04-17 | a8fd20d | — | [260417-f2f-phase-11-60-day-data-retention-cron](./quick/260417-f2f-phase-11-60-day-data-retention-cron/) |
| 260417-fiz | Phase 12: interview prep generation | 2026-04-17 | 01423ab | — | [260417-fiz-phase-12-interview-prep-generation](./quick/260417-fiz-phase-12-interview-prep-generation/) |
| 260417-g4p | Wire real data into analytics page charts | 2026-04-17 | 181e977 | — | [260417-g4p-wire-real-data-into-analytics-page-chart](./quick/260417-g4p-wire-real-data-into-analytics-page-chart/) |
| 260417-kgd | Fix auth gap, fire-and-forget async, and retention of filtered jobs | 2026-04-17 | 6307d67 | — | [260417-kgd-fix-auth-gap-fire-and-forget-async-and-r](./quick/260417-kgd-fix-auth-gap-fire-and-forget-async-and-r/) |
| 260417-kqy | Build polished Disha login page as app homepage | 2026-04-17 | c430e50 | — | [260417-kqy-build-polished-disha-login-page-as-app-h](./quick/260417-kqy-build-polished-disha-login-page-as-app-h/) |
| 260417-o87 | Close Codex review gap 93→97+ (auth tests, diagnostics, storage contract, cleanup) | 2026-04-17 | 298f513 | Verified | [260417-o87-close-codex-review-gap-93-97-auth-tests-](./quick/260417-o87-close-codex-review-gap-93-97-auth-tests-/) |
| 260418-apify | Replace indeed-nl RSS with Apify scraper (Cloudflare bypass) | 2026-04-18 | 3d939f1 | — | — |
| 260418-hk3 | Add flag-as-bad-match button to inbox job cards | 2026-04-18 | e76b7df | — | [260418-hk3-add-flag-as-bad-match-button-to-inbox-jo](./quick/260418-hk3-add-flag-as-bad-match-button-to-inbox-jo/) |
| 260418-inbox-join | Fix inbox showing 0 jobs — LEFT JOIN excludes status='new' apps | 2026-04-18 | 8bedb32 | — | — |
| 260418-migration | Apply migration 0004 manually (storage_url/format/mime_type/render_kind columns missing from Neon) | 2026-04-18 | — | — | — |
| 260418-artifacts-fix | Fix proof artifacts 504 timeout — retries 5→2, skip secondary, 10s scrape cap | 2026-04-18 | c32e740+52fd39c | — | — |
| 260418-parallel-gen | Refactor GeneratePanel to per-row state so all 5 can generate in parallel | 2026-04-18 | 75e0a68 | — | — |
| 260418-inbox-ui | Fix inbox header alignment (count as subtitle) + QueueUrlForm fixed 240px width | 2026-04-18 | d23ac55 | — | — |
| 260418-topbar | Fix Paste a role alignment — group nav+button in .topbar-center | 2026-04-18 | 9311df3 | — | — |
| 260418-pipeline-flag | Add Not a fit option to pipeline stage dropdown | 2026-04-18 | 5ab49df | — | — |
| 260418-dd27 | LinkedIn Profile Optimizer — PDF upload → Sonnet rewrites, headline/about/experience/skills + copy buttons | 2026-04-18 | 72c2509 | Verified | [260418-dd27-linkedin-profile-optimizer](./quick/260418-dd27-linkedin-profile-optimizer/) |
| 260418-0332 | Wire full anti-AI guardrails into LinkedIn optimizer — retry loop, sanitize, expanded humanizer prompt | 2026-04-18 | 9b1ba33 | — | [260418-0332-linkedin-optimizer-anti-ai-guardrails](./quick/260418-0332-linkedin-optimizer-anti-ai-guardrails/) |
| 260418-57a9 | Add "No longer available" button to inbox — expired status, removed from inbox + pipeline | 2026-04-18 | 53f3494 | — | [260418-57a9-no-longer-available-inbox](./quick/260418-57a9-no-longer-available-inbox/) |

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
- Indeed NL: RSS blocked by Cloudflare April 2026; replaced with Apify free tier ($5/mo credit)

## Open questions

- Commute tolerance value (will capture from Avi during Phase 1 profile intake)
- Final domain name (TBD; default to `disha-cloud.vercel.app` until decided)

## Session log

**2026-04-14** Initial GSD scaffolding from existing superpowers spec + plan. Granularity = fine (12 phases). Research = on. Parallelization = on. Git commit of planning docs = on.

**2026-04-17** v2.0 Smarter Disha milestone started. Roadmap created: Phases 13-16 covering R-78 through R-89.

**2026-04-17** Executed 13-02: ScoreBreakdown UI (R-78), drift badges (R-80), feedback multiplier hook (R-79). 3 tasks, 6 files modified, 2 created. 209/209 tests pass.

**2026-04-17** Executed 13-03: ATS keyword post-pass module (R-84), wired into generateCV(), nightly batch CV generation for T1/T2 (cap 5, p-limit 2). 10 unit tests, zero new LLM calls. 209 tests pass.

**2026-04-17** Phase 13 complete. All 4 requirements satisfied (R-78, R-79, R-80, R-84). 9 commits total.

**2026-04-17** Phase 15 executed: Gap Coach UI (R-85), interview research prompt + clipboard (R-86), PDF interview brief via pdf-lib (R-89). 307 tests pass.

**2026-04-17** Phase 16 executed: Source Quality panel (R-83), Market Pulse panel (R-88), Weekly Strategy Brief cron via GitHub Actions (R-87). 307 tests pass.

**2026-04-17** Quick tasks: login page (260417-kqy), auth gap fix (260417-kgd), analytics real data (260417-g4p), Codex review closure (260417-o87).

**2026-04-18** Diagnosed Indeed NL source failure: Cloudflare 403 on RSS endpoint. Replaced with Apify `misceres/indeed-scraper` actor (free tier, ~$4.50/mo). `APIFY_API_TOKEN` set in Vercel + GitHub secrets. 5 sources live again. v2.0 milestone confirmed complete.

**2026-04-18 (session 2)** Bug fix sprint: (1) Inbox showing 0 jobs — LEFT JOIN was excluding status='new' apps created by generate routes; fixed with AND condition in JOIN. (2) Migration 0004 (storage_url/format/mime_type/render_kind columns) was recorded as applied in Drizzle journal but never actually ran against Neon — applied manually via node+neon SDK. (3) Proof artifacts 504 timeout — reduced anti-AI loop retries 5→2, disabled secondary artifact generation, added 10s total cap on company scraper. (4) GeneratePanel refactored from shared state to per-row GenRow components enabling parallel generation. (5) Inbox header alignment + QueueUrlForm fixed width. (6) TopBar Paste a role button grouped with nav links. (7) Not a fit option added to pipeline stage dropdown (same flagged status as inbox button). v3 brainstorm completed: LinkedIn Profile Optimizer spec written and approved. **260418-dd27 SHIPPED** — LinkedIn Profile Optimizer: `linkedin_optimizations` table + PDF upload → single Sonnet call → rewrites (headline, about, experience, skills) with copy buttons + reasoning. Tab A within /profile page (`?tab=linkedin`). Verified. Commit 72c2509 pushed to main.
