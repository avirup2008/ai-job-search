# REQUIREMENTS — AI Job Search v1 + v2

Derived from `docs/superpowers/specs/2026-04-14-ai-job-search-design.md`. Authoritative source is the spec; this file groups requirements by capability for GSD phase mapping.

## Legend

- **R-xx** = requirement id
- **Tier** = in-scope for v1 unless marked `v1.5` or `deferred`

---

## A. Foundation & Infrastructure

- **R-01** Repo scaffolded with Next.js 16 App Router, TypeScript strict, shadcn/ui, Tailwind, Drizzle ORM, Vitest.
- **R-02** Neon Postgres project provisioned in EU region with pgvector enabled at 512 dimensions.
- **R-03** Vercel Hobby project linked, env vars configured, EU deployment region.
- **R-04** Vercel Blob store provisioned for generated documents.
- **R-05** Resend free tier configured for heartbeat + failure emails.
- **R-06** Env loader validates all required variables at startup, fails fast with clear diagnostics.
- **R-07** `.gitignore` excludes secrets, build artifacts, and any embedded worktrees.

## B. Data Model

- **R-08** All tables from spec §5 exist: `profile`, `companies`, `jobs`, `applications`, `documents`, `events`, `screening_answers`, `research_cache`, `runs`, `llm_budget`.
- **R-09** A/B testing tables exist: `experiments`, `variants`, plus `variant_id` / `experiment_id` on `documents`.
- **R-10** Foreign-key cascade semantics match spec (cascade on application delete).
- **R-11** All data classes honor retention windows per spec §13 (research 90d, jobs 180d, events 365d, llm logs 30d).

## C. LLM Platform

- **R-12** `LLMAdapter` interface with `complete`, `structured`, `embed` methods.
- **R-13** `AnthropicAPIAdapter` production implementation using Sonnet 4.6 + Haiku 4.5 model IDs, with Anthropic prompt caching for cached system prompts.
- **R-14** `ClaudeMaxCLIAdapter` stub (dev fallback, not in production path).
- **R-15** Per-call cost computation in EUR reflecting current Anthropic pricing; updated as rates change.
- **R-16** `BudgetGateway` wraps any adapter with monthly ledger: allow / downgrade-Sonnet-to-Haiku (≥80%) / block (≥100%). Writes to `llm_budget` table on every call.
- **R-17** Embeddings via OpenAI `text-embedding-3-small` truncated to 512 dims.

## D. Discovery Sources

- **R-18** Adzuna API source: keyword-fan-out over NL marketing keywords, last 14 days, pagination up to 3 pages.
- **R-19** Jooble API source: keyword-fan-out over NL marketing keywords.
- **R-20** Werk.nl public-search HTML scraper with cheerio; polite 1.5s delay between requests; fixture-based tests.
- **R-21** Nationale Vacaturebank HTML scraper; same polite pattern.
- **R-22** JSearch RapidAPI source (free tier 100 req/mo) for LinkedIn cross-posts. [v1.5 — Week 2+ addition]
- **R-23** Direct careers-page crawl for curated 50-company watchlist. [v1.5 — Week 2+ addition]
- **R-24** `JobSource` interface contract; all sources normalize to `RawJob` shape.
- **R-25** Source registry with parallel-limited fan-out; per-source error capture without failing the whole run.

## E. Pipeline Stages

- **R-26** Discover stage: fan out all sources, normalize, return jobs + perSource counts + errors.
- **R-27** Dedupe: cluster on `(normalized_company, normalized_title, normalized_location, iso_week(posted_at))`. Source-rank-preferring canonical selection.
- **R-28** Hard filters: Dutch-required detection via bilingual regex patterns; seniority mismatch (VP/C-level/intern/junior) via title patterns.
- **R-29** Haiku JD enrichment: structured extraction of tools, seniority, dutchRequired, industries, locationText.
- **R-30** Fit scoring: blended formula (skills 40%, tools 25%, seniority 15%, geo 10%, industry 10%).
- **R-31** Tier routing: T1 ≥85, T2 65-85, T3 40-65, filtered <40.
- **R-32** Orchestrator: DurableAgent-compatible, resumable per stage, writes `runs` row per execution with stage metrics.
- **R-33** Idempotency: re-runs do not duplicate jobs (unique on `source + source_external_id`).

## F. Company Research

- **R-34** Per-company dossier: homepage + about + product + blog index + careers crawl; LinkedIn company public page; recent news.
- **R-35** Marketing-stack fingerprinting from HTML signals.
- **R-36** 500–800 word summary cached 90 days in `research_cache`.
- **R-37** "Low signal" flag when research returns insufficient data; downstream tailoring uses generic fallback.

## G. Generation Pipeline

- **R-38** DOCX generation via `docxtemplater` with ATS-friendly template (no header tables, single-column, standard fonts).
- **R-39** PDF rendering via headless Chromium from same content; visually identical to DOCX.
- **R-40** Tier 1 package: CV (DOCX+PDF) + cover letter + routed artifact + screening Q&A pack.
- **R-41** Tier 2 package: CV + cover letter.
- **R-42** Tier 3 package: cover letter only (reuses master CV).
- **R-43** Six artifact types with routing rules (§8 of spec).
- **R-44** Public artifact viewer at `/p/[slug]` with OpenGraph metadata, 180d expiry.

## H. Ethics & Guardrails

- **R-45** Every generation prompt includes the hard-rules preamble from spec §11.
- **R-46** Property-based test suite asserting no-fabrication on known-false inputs.
- **R-47** System returns `INSUFFICIENT_PROFILE_DATA` rather than fill when profile lacks coverage.
- **R-48** English-only guard in v1.

## I. Web App UX

- **R-49** Triage Inbox `/` with virtualized queue + preview side-panel + keyboard shortcuts.
- **R-50** Pipeline Kanban `/pipeline` with drag-to-move status columns.
- **R-51** Dashboard KPIs strip (apps-this-week, response-rate, T1-interview-rate).
- **R-52** Paste-JD `/paste` with match analysis + optional full generation (~15s analysis).
- **R-53** Public artifact viewer `/p/[slug]`.
- **R-54** Admin `/admin` with profile editor, watchlist, run logs, budget dashboard, manual trigger.
- **R-55** Auth: magic-link via Resend; owner + admin accounts only.

## J. Operations

- **R-56** Vercel Cron nightly 02:00 CET via `/api/cron/nightly` with `CRON_SECRET` bearer auth.
- **R-57** Heartbeat email on success with run summary.
- **R-58** Failure email on error with stack + last-successful-stage pointer.
- **R-59** Manual-trigger endpoint for admin.
- **R-60** Health endpoint `/api/health` for uptime monitoring.

## K. Reveal & Consent

- **R-61** Staging mode: admin-only, no applications visible to candidate account.
- **R-62** One-time plain-English consent modal before live run activation.
- **R-63** "Pause system" toggle (stops cron).
- **R-64** GDPR export (JSON + blob zip) and delete (full wipe) endpoints.

## L. A/B Testing & Learning

- **R-65** Experiment/variant data model with single-dimension experiments (CV lead, cover hook, cover length, artifact type, subject-line framing, skills ordering).
- **R-66** Shared-context variant generation (variants reuse research + profile, only final generation differs; marginal cost ~$0.06).
- **R-67** Bayesian beta-binomial analysis per metric with weakly informative prior.
- **R-68** Auto-adoption rule: P(winner > other) ≥ 95% AND ≥10 outcomes per arm.
- **R-69** Weekly Sunday-night digest email with code-computed stats + Claude-written narrative (no hallucinated numbers).
- **R-70** Skip-rate secondary signal per variant.

## M. Outcome Tracking

- **R-71** Application status state machine: new → reviewed → applied → replied → interview → offer | rejected | skipped.
- **R-72** Events ledger capturing every transition with payload.
- **R-73** One-click status updates from inbox and kanban.
- **R-74** Rejection feedback down-weights similar roles in future ranking. [v1.5]

## N. Observability

- **R-75** `runs` table per execution with stage-by-stage metrics + errors.
- **R-76** Admin budget dashboard showing current-month spend vs €20 cap, alert at 80%.
- **R-77** Source health dashboard (discovery counts by source, dedup rate, error counts).

---

## Requirements-to-phase mapping

See `.planning/ROADMAP.md`. Each phase lists the R-ids it satisfies.

---

# v2.0 Requirements — Smarter Disha

**Hard constraints:** No new paid API keys. No new direct LLM calls outside nightly cron. Rules engine, free scraping, or existing cron budget only.

---

## P. Smarter Scoring

- **R-78** User can see a score breakdown for any job: which profile fields matched, which were missing, and the weighted contribution of each component (skills, tools, seniority, geo, industry).
- **R-79** When user records an outcome (rejected, interview, offer) on an application, the system adjusts future fit scoring weights for similar roles using a simple feedback multiplier stored in the profile.
- **R-80** When a job's tier changes on rescore (T2→T1 or T1→T2), a score drift alert is surfaced in the triage inbox with the old and new tier.

## Q. Enhanced Discovery

- **R-81** Indeed Netherlands added as a discovery source via free HTML scraping; normalises to `RawJob` shape; polite delay; fixture-based tests.
- **R-82** User can paste a non-LinkedIn job URL into the app; Disha scrapes the page, extracts JD text, creates a job record, and queues it for the next nightly scoring run.

## R. Analytics

- **R-83** Source quality chart on the analytics page: for each discovery source, shows count of T1 jobs discovered and T1 conversion rate, enabling comparison across sources.

## S. Application Quality

- **R-84** After CV generation in the nightly pipeline, a rules-based ATS keyword post-pass compares the generated CV text against the JD, identifies high-frequency exact-match keywords that are missing, and injects them naturally into the skills section — within the existing nightly cron budget, no additional LLM calls outside that window.

## T. Candidate Intelligence

- **R-85** Profile Gap Coach: a page or panel that shows T2 jobs ranked by "closeness to T1", with the specific keywords and profile fields that are holding each job back — so Upashana knows exactly what to strengthen.
- **R-86** When a job moves to "interview" status, Disha generates a structured research prompt (using company name, role, JD text, dossier fields) and displays it with a one-click copy button — she pastes it into her Claude.ai subscription to get company research at zero API cost.

## U. Reporting

- **R-87** Weekly Strategy Brief: a rules-based summary card (or email-ready block) generated each Monday showing: applications sent this week vs target pace, T1 jobs available vs applied, top source this week, and one actionable callout derived from the data.
- **R-88** Market Pulse panel on the analytics page: shows average days-to-response across her applications, T1 job volume trend (this week vs last 4-week average), and source response rate — all derived from internal data, no external API.

## V. Documents

- **R-89** Pre-interview brief: a single formatted PDF combining the existing interview prep document and company dossier for a job, downloadable from the job detail view — formatting only, no new LLM generation.

---

## v2 Requirements-to-phase mapping

See `.planning/ROADMAP.md` (v2 phases start at Phase 13).
