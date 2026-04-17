# PROJECT — AI Job Search

## Purpose

Private, single-user AI-powered job-search and application system for Upashana Borpuzari. Quality-first: every application looks uniquely prepared to materially increase interview conversion. Target: land offer-stage interviews in Netherlands digital marketing / marketing automation / CRM roles within ~1 month from 2026-04-14.

## Source of truth

**Design spec:** `docs/superpowers/specs/2026-04-14-ai-job-search-design.md` — authoritative for requirements, architecture, constraints, ethics, and phased build plan.

This PROJECT.md is a GSD-framework summary of what the spec defines. Where PROJECT.md and the spec disagree, trust the spec.

## Core constraints

| Constraint | Rule |
|---|---|
| Budget | €20/mo hard LLM cap via Vercel AI Gateway. All other infra on free tiers. |
| Privacy | GDPR-compliant. EU-hosted. 90-day retention on scraped company research. Explicit consent before live run. |
| Submission | Never auto-submit. She always clicks Apply on the company site. |
| Honesty | Hard-rule prompts: no fabrication of experience, metrics, tools, or outcomes. |
| Language | English-only outputs in v1. |
| LinkedIn | No scraping. Aggregators + on-demand paste-JD workflow only. |
| Single-user | Her account + admin (Avi). Not multi-tenant. |
| Commercial use | Vercel Hobby tier for strictly personal use. |

## Stack

Next.js 16 App Router (Vercel Hobby) · TypeScript strict · Drizzle ORM · Neon Postgres EU + pgvector 512-dim · Vercel Blob · Vercel Cron + Workflow DevKit DurableAgent · AI SDK v6 · Anthropic SDK (Sonnet 4.6 + Haiku 4.5 via AI Gateway) · OpenAI embeddings · Resend · shadcn/ui + Tailwind · Vitest.

## Architecture

Three tiers:
1. **Web App** on Vercel — triage inbox, pipeline kanban, dashboard, paste-JD, admin, public artifact viewer
2. **Data** on Neon Postgres + Vercel Blob — structured profile, jobs, companies, applications, documents, events, experiments, budget ledger
3. **Pipeline** via Vercel Cron + DurableAgent — nightly discover → dedupe → rank → tier → research → generate → persist

All LLM calls pass through AI Gateway with monthly budget ledger enforcing hard €20/mo cap and tiered routing (T1 full-package top-20%, T2 CV+cover, T3 cover-only).

## Success criteria

| Metric | Target (1-month) |
|---|---|
| Late-stage interviews (3rd round+) | ≥ 3 |
| Offers in hand | ≥ 1 |
| First-round interview rate on Tier-1 apps | ≥ 10% |
| Tier-1 applications submitted | 40–60 |
| Pipeline uptime | ≥ 90% |

## Out of scope for v1

Auto-apply to ATS forms · LinkedIn scraping · Recruiter outreach automation · Multi-tenant · Native mobile app · Dutch-language generation · Salary negotiation · Interview scheduling integration.

## Current Milestone: v2.0 Smarter Disha

**Goal:** Make Disha smarter about scoring, discovery, and application quality — reducing the ATS black hole and giving Upashana clarity on why things are or aren't working.

**Hard constraint:** No new paid API keys. Rules engine, free-source scraping, or existing Anthropic budget only.

**Target features:**
- Smarter Scoring: explain why T1/T2/T3, feedback loop from outcomes, score drift alerts
- Analytics: source quality (which discovery source produces best T1s)
- Discovery: Indeed Netherlands, manual URL paste (non-LinkedIn)
- Agentic: pre-interview brief PDF, auto-research on interview move
- Profile Gap Coach: surface T2→T1 conversion opportunities from existing data
- Weekly Strategy Brief: rules-based weekly review card
- Market Pulse: response timing context, volume trends, internal benchmarks
- ATS keyword injection: post-pass on generated CVs to add exact-match JD keywords

**Dropped from brainstorm (require paid API):** Salary intelligence (Glassdoor/SerpAPI).

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
