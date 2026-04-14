# AI Job Search

**Project:** AI-powered job-search + application tool for Upashana Borpuzari.
**Builder:** Avi (solo).
**Target window:** 1 month from 2026-04-14 to land offer-stage interviews.

## Status
Design spec complete. See `docs/superpowers/specs/2026-04-14-ai-job-search-design.md`.

## Core constraints
- **€20/mo LLM cap** via Vercel AI Gateway (hard). All other infra on free tiers.
- **No LinkedIn scraping.** Aggregators + on-demand paste-JD workflow only.
- **Never auto-submit.** She always clicks Apply on the company site.
- **No fabrication** in LLM outputs — hard-rule prompts.
- **English-only** outputs for v1.
- **GDPR** — 90d research retention, consent before live run, EU-hosted infra.

## Architecture at a glance
Vercel Next.js 16 (Hobby) · Neon Postgres (free + pgvector @ 512-dim) · Vercel Blob · Resend (free) · Anthropic API via AI Gateway · Vercel Cron + Workflow DevKit DurableAgent.

No local-machine dependency. No proxies. All cloud, all legal.

## Tier routing (cost control)
| Tier | Fit score | Outputs | Est. cost |
|---|---|---|---|
| T1 | ≥85 | CV + Cover + Artifact + Screening Q&A | $0.20 |
| T2 | 65–85 | CV + Cover | $0.09 |
| T3 | 40–65 | Cover only | $0.04 |

## Workflow reminders
- No direct code edits without a plan. Follow `superpowers:writing-plans` → phase plans → execute.
- Every LLM prompt includes the hard-rule ethics preamble.
- Every generation path tests against the "no-fabrication" property suite.
