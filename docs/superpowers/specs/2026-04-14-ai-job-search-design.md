# AI Job Search — Design Spec

**Project:** AI-powered job search and application system for Upashana Borpuzari
**Builder:** Avi (partner, solo builder)
**Target:** Digital Marketing / Marketing Automation / CRM Marketing roles in the Netherlands
**Goal window:** ~1 month from 2026-04-14 to land offer-stage interviews (ideally an offer)
**Status:** Design approved — pending user review of this doc before implementation plan

---

## 1. Goal & Success Criteria

### Primary goal
A quality-first job-search engine that produces standout applications — each one tailored deeply enough that the candidate appears uniquely suited to that role, materially increasing interview conversion vs. generic applications.

### Success metrics (in order of importance)

| Metric | Target (1-month) | Why it matters |
|---|---|---|
| Late-stage interviews (3rd round+) | ≥ 3 | Primary proxy for "landing a job" — offers follow |
| Offers in hand | ≥ 1 | Ultimate outcome |
| First-round interview rate on Tier-1 apps | ≥ 10% | Quality signal — double industry baseline |
| Tier-1 applications submitted | 40–60 | Volume signal — enough shots on goal |
| System uptime (nightly pipeline success) | ≥ 90% | Trust signal — she relies on morning queue |

### Kill criteria (honest failure modes)
- If by end of Week 3 she has < 1 first-round interview from Tier-1 apps → re-examine tailoring quality, not volume
- If LLM cap overruns despite routing → drop Tier-2 artifact generation first, then reduce Tier-1 volume
- If discovery sources dry up (source bans, rate limits) → expand paste-JD workflow, deprioritize auto-discovery

---

## 2. Candidate Profile (summary, full in DB)

- 8+ yrs digital marketing across NL, UK, India, Europe
- Current: Marketing Operations Support @ Inbox Storage BV (NL scale-up), sole marketing hire
- Prior: GMAC (Marketing Manager, 7-market campaigns), British Council (ops → marketing)
- Strengths: HubSpot CRM, SEO, Meta paid, Unbounce landing pages, multi-market B2B
- Proof points: 90% SEO health (from 43%), €1.29 CPL at scale, 5.5% LP conversion, 64% email open rates, 2055 leads → 202 bookings pipeline
- Dutch A2 (blocks ~30–40% of NL roles) — English-first targeting
- No sponsorship required (HSM Dependent) — strong NL advantage
- Education: MA Political Science, University of Delhi
- Location: Beverwijk, NL (commute tolerance TBD — captured at intake)

---

## 3. Constraints

| Constraint | Rule |
|---|---|
| Budget | €20/mo hard cap on LLM via AI Gateway. All other infra on free tiers. |
| Privacy | GDPR-compliant. 90-day retention on scraped company research. Explicit consent before any real application generation. |
| LinkedIn | **No scraping.** Coverage via aggregators + on-demand paste-JD workflow. |
| Submission | **Never auto-submit.** She always clicks Apply on the company site. |
| Honesty | LLM prompts include hard rule: no fabrication of experience, metrics, tools, or outcomes. |
| Language | English-only outputs for v1. Dutch-required roles filtered out of nightly pipeline (still viewable via paste-JD). |
| Single-user | Her account + admin account (Avi). Not a multi-tenant product. |
| Commercial use | Vercel Hobby tier used for strictly personal use; no commercial exposure. |

---

## 4. Architecture

```
┌─ WEB APP  (Vercel Next.js 16 App Router, Hobby) ────────────┐
│ Routes:                                                      │
│   /               → Inbox (default) — ranked queue + preview│
│   /pipeline       → Kanban by application status            │
│   /dashboard      → KPI strip + weekly retro (later)        │
│   /paste          → On-demand JD analysis + generation      │
│   /p/[slug]       → Public artifact viewer (shareable)      │
│   /admin          → Profile editor, watchlist, regen tools  │
│ Auth: Magic-link via Resend (her + admin)                   │
│ UI: shadcn/ui + Tailwind                                    │
└─────────────▲────────────────────────────────────▲──────────┘
              │ read/write                         │ UI-triggered
              │                                    │ (paste-JD, regen)
┌─ DATA  (Neon Postgres free + pgvector @ 512-dim) ───────────┐
│ Tables: profile, companies, jobs, applications, documents,  │
│         events, screening_answers, research_cache, runs,    │
│         llm_budget (ledger for cap enforcement)             │
│ Vercel Blob free tier: DOCX + PDF outputs, artifact files   │
└─────────────▲────────────────────────────────────────────────┘
              │ writes
              │
┌─ PIPELINE  (Vercel Cron + Workflow DevKit DurableAgent) ────┐
│ Cron: nightly 02:00 CET (her time zone)                     │
│ DurableAgent stages (resumable, crash-safe):                │
│   1. discover  → aggregators + direct careers crawl         │
│   2. dedupe    → canonical job per fuzzy cluster            │
│   3. rank      → Haiku 4.5 + embeddings + hard filters      │
│   4. tier      → T1/T2/T3 routing based on fit score        │
│   5. research  → company dossier (cached 90d)               │
│   6. generate  → CV/cover/artifact/screening per tier       │
│   7. persist   → Neon + Blob + public slugs                 │
│   8. notify    → morning digest email (Resend)              │
│ All LLM calls pass through AI Gateway (hard €20/mo cap).    │
│ LLM adapter: AnthropicAPIAdapter (prod) | ClaudeMaxCLI fall │
│ Heartbeat + email-on-failure every run.                     │
└──────────────────────────────────────────────────────────────┘
```

### Key architectural properties
- **Fully cloud-hosted.** No local-machine dependency. No proxies.
- **Crash-safe pipeline** via Workflow DevKit DurableAgent — resumable from any stage, idempotent writes.
- **Budget-enforced at the gateway.** Tier routing + AI Gateway cap make overruns impossible.
- **Adapter seam** lets us swap LLM providers in one file if Anthropic pricing/policy changes.

---

## 5. Data Model (Neon Postgres)

```sql
-- Source of truth for all tailoring
profile (
  id uuid pk,
  roles jsonb,              -- [{company, title, dates, context, achievements[]}]
  achievements jsonb,       -- [{metric, context, tool_stack[], narrative}]
  tool_stack jsonb,         -- {tool: proficiency (yrs + depth)}
  industries jsonb,         -- [string]
  stories jsonb,            -- [{title, situation, task, action, result, tags[]}]
  constraints jsonb,        -- {location, dutch_level, sponsor_needed, ...}
  preferences jsonb,        -- {salary_floor, commute_max, veto_companies, ...}
  portfolio_url text,
  linkedin_url text,
  master_cv_docx_url text,
  master_cv_pdf_url text,
  updated_at timestamp,
  updated_by text            -- 'admin' | 'user'
)

companies (
  id uuid pk,
  domain text unique,
  name text,
  research_json jsonb,       -- product, stack-signals, news, sizing
  refreshed_at timestamp,
  expires_at timestamp        -- GDPR: 90d
)

jobs (
  id uuid pk,
  company_id uuid fk,
  source text,               -- 'adzuna'|'jooble'|'werknl'|'nvb'|'indeednl'|'careers'|'paste'
  source_url text,
  title text,
  jd_text text,
  jd_embedding vector(512),
  location text,
  dutch_required bool,
  seniority text,
  posted_at timestamp,
  discovered_at timestamp,
  dedupe_hash text,          -- company|title|loc|week
  fit_score numeric(4,1),    -- 0-100
  fit_breakdown jsonb,       -- {skills, tools, seniority, geo, industry}
  gap_analysis jsonb,        -- {strengths[], gaps[], positioning[]}
  tier smallint,             -- 1|2|3|null(filtered)
  hard_filter_reason text    -- 'dutch_required'|'visa_sponsor'|'seniority_mismatch'
)

applications (
  id uuid pk,
  job_id uuid fk,
  status text,               -- new|reviewed|applied|replied|interview|offer|rejected|skipped
  applied_at timestamp,
  last_event_at timestamp,
  notes text
)

documents (
  id uuid pk,
  application_id uuid fk,
  kind text,                 -- cv|cover|artifact|screening
  artifact_type text,        -- funnel|seo|30-60-90|email|competitive|paid (for kind=artifact)
  version int,
  blob_url_docx text,
  blob_url_pdf text,
  public_slug text unique,   -- for /p/[slug] viewer
  generated_by_tier smallint,
  token_cost numeric(10,4),
  created_at timestamp
)

events (                     -- outcome tracking + audit
  id uuid pk,
  application_id uuid fk,
  kind text,                 -- status_change|note|reply_received|interview_scheduled
  payload jsonb,
  at timestamp
)

screening_answers (
  id uuid pk,
  application_id uuid fk,
  question text,
  answer text,
  confidence numeric(3,2)
)

research_cache (
  id uuid pk,
  scope_key text unique,     -- e.g., 'company:<domain>:v1'
  content jsonb,
  expires_at timestamp
)

runs (                       -- pipeline run log
  id uuid pk,
  started_at timestamp,
  ended_at timestamp,
  status text,               -- running|succeeded|failed|partial
  stage_metrics jsonb,       -- per-stage counts + tokens
  error_json jsonb
)

llm_budget (                 -- monthly ledger for cap enforcement
  period char(7) pk,         -- 'YYYY-MM'
  eur_spent numeric(8,4),
  tokens_in bigint,
  tokens_out bigint,
  requests int,
  cap_eur numeric(6,2),      -- 20.00
  updated_at timestamp
)
```

---

## 6. Pipeline Stages (nightly)

### Stage 1: Discover
Query/scrape all sources, normalize to common schema, write raw jobs to staging table.

| Source | Method | Rate |
|---|---|---|
| Adzuna | Official API, NL + EN keywords | ~500 calls/mo |
| Jooble | Official API, NL | ~500 calls/mo |
| JSearch (RapidAPI) | Free tier (100 req/mo) — LinkedIn cross-posts | ~3 req/day |
| Indeed NL | Public listings scrape (respectful, no auth) | 1 pass/night |
| Werk.nl | Public search endpoints | 1 pass/night |
| Nationale Vacaturebank | Public search endpoints | 1 pass/night |
| 50-company watchlist | Direct careers-page crawl | 1 pass/night |

Search terms: set of curated DM/CRM keywords (Marketing Automation, HubSpot, CRM Marketing, Email Marketing, Growth Marketing, Digital Marketing, Paid Media, etc.) × NL locations.

### Stage 2: Dedupe
Fuzzy cluster on `(normalized_company, normalized_title, location, posted_within_7d)`. One canonical job per cluster; others linked as cross-references.

### Stage 3: Rank (Haiku 4.5 + embeddings)
- Generate JD embedding (512-dim, `text-embedding-3-small` truncated).
- Compute cosine similarity vs. profile embedding (composed from profile stories + tool stack).
- Haiku call enriches: seniority classification, Dutch-required detection, key-tool extraction.
- Hard filters:
  - `dutch_required` (anything beyond B1) → filter
  - `visa_sponsor_required` → filter
  - `seniority_mismatch` (VP, Director+, or Junior/Intern) → filter
  - `commute_distance > preference` → filter
- Compute `fit_score` 0–100 with breakdown components.

### Stage 4: Tier
- Tier 1: top ~20% of daily non-filtered jobs, fit_score ≥ 85
- Tier 2: fit_score 65–85 (next ~35%)
- Tier 3: fit_score 40–65
- Below 40 or filtered → not processed further

### Stage 5: Research (per unique company, cached)
- Website crawl: homepage + about + product + blog index + careers page
- LinkedIn **company** page (public only, no person data)
- Recent news (Google News RSS scraped or free API)
- Marketing-stack signals (BuiltWith-like fingerprinting from HTML)
- Summarize into structured dossier (500–800 words). Cache 90d.

### Stage 6: Generate
Per tier:

| Tier | Outputs | Models used | Est. cost |
|---|---|---|---|
| T1 | CV (DOCX+PDF) + Cover letter + 1 artifact + Screening Q&A | Sonnet 4.6 | ~$0.20 |
| T2 | CV (DOCX+PDF) + Cover letter | Sonnet 4.6 for CV, Haiku for cover | ~$0.09 |
| T3 | Cover letter only (reuses master CV) | Haiku 4.5 | ~$0.04 |

DOCX generated via `docxtemplater` with a curated template (ATS-friendly, no tables in header, standard fonts). PDF via headless Chromium in the same cloud function. Never LLM-direct-to-docx.

### Stage 7: Persist
Write documents to Blob with `public_slug`, update `applications` row status = `new`, log `runs` metrics.

### Stage 8: Notify
Morning email digest (Resend, 08:00 CET): count of new matches by tier, top 3 Tier-1 teasers, deep link to Inbox.

---

## 7. Paste-JD Feature (on-demand)

### UI
- Persistent `➕ Paste JD` button in top nav.
- Modal/panel with:
  - Large textarea for JD (required)
  - Optional URL field (auto-fetches guest-visible content if LinkedIn URL)
  - Optional company name/domain
  - `Analyze` button

### Flow (~15s)

1. **Parse**: Haiku extracts title, company, location, seniority, JD structured fields, Dutch requirement.
2. **Research**: If company is new, same research stage as nightly; if cached, reuse.
3. **Match analysis** (Sonnet):
   - Fit score 0–100 with 5-component breakdown
   - Recommendation badge: 🟢 Strong Apply / 🟡 Apply with caveat / 🟠 Stretch (position carefully) / 🔴 Skip (misalignment: [reason])
   - Strengths (what to lead with)
   - Gaps (ranked by weight in JD)
   - Positioning recommendations per gap
   - Recommended artifact type (1 of 6) with reasoning
4. **"Generate Materials" button** → runs full Tier-1 pipeline, adds to Inbox with `source = paste`.

### Cost
- Analysis only: ~$0.04 (Haiku parse + Sonnet match analysis)
- Analysis + full materials: ~$0.20
- Budget impact: even 30 pastes/mo = ~$6 extra, well under cap.

---

## 8. Proof-of-Work Artifacts (6 types, agent-routed)

| # | Artifact | Best for | Output |
|---|---|---|---|
| 1 | Funnel/conversion teardown | B2C, Growth, Performance | 1-page PDF: current funnel diagnosis, 5 CRO flags, priority fix list |
| 2 | SEO mini-audit | SEO-leaning roles | 1-page PDF: top-page analysis, 5 technical issues, 3 content gaps vs competitors |
| 3 | 30-60-90 day plan | Generic fallback, strategic/senior roles | 1-page PDF: by-month priorities tied to their stated JD goals |
| 4 | Email/CRM teardown | CRM, Marketing Automation, Email | 1-page PDF: newsletter critique, segmentation signals, automation gaps |
| 5 | Competitive positioning snapshot | Strategic, positioning-heavy roles | 1-page PDF: 3-competitor grid on messaging + SEO + channel mix |
| 6 | Paid media audit | Performance, Meta/Google-heavy roles | 1-page PDF: Meta Ad Library teardown, creative/copy patterns |

### Routing rules
Agent picks artifact type based on:
- JD keyword density (SEO mentions > 4 → #2; HubSpot/CRM mentions > 3 → #4; paid/performance mentions > 3 → #6)
- Seniority (senior/strategic → #3 or #5 as complement)
- Fallback when low company signal or generic JD → #3

### Artifact format
- 1 page, PDF (A4), hosted at `/p/[slug]`
- Branded with her logo/color from profile preferences
- Dated; regenerates if company research is stale
- Includes subtle signature: "Prepared by Upashana Borpuzari — upashana.online"

---

## 9. UX Specification

### Inbox (default route `/`)
Two-pane split (60/40 on desktop; stacked on mobile):

**Left — Ranked queue**
- Virtualized list, grouped by tier (⭐⭐⭐ T1, ⭐⭐ T2, ⭐ T3)
- Each row: company logo, title, location, posted_ago, fit %, "why matched" 1-liner, Dutch-flag badge, artifact icon if generated
- Keyboard shortcuts: J/K navigate, A apply, S skip, R regenerate, / search
- Filter chips: Today / 7 days / All · Has artifact / No artifact · Source

**Right — Preview**
- Tabs: CV · Cover letter · Artifact · Screening Q&A · Research · Original JD
- Top actions: 🟢 Apply (opens source URL, marks status=`applied`) · 🟡 Save for later · 🔴 Skip · ⟳ Regenerate (with reason dropdown)
- Download buttons: DOCX · PDF · Everything (zip)
- Inline edit mode for CV/cover letter — edits saved as new `version`

### Pipeline (`/pipeline`)
Kanban columns:
`New → Reviewed → Applied → Replied → Interview → Offer | Rejected | Skipped`
- Drag-to-move
- Card: company, title, days-in-stage, recruiter (if known), next action hint
- Click card → opens application detail drawer (all documents, events, notes)

### Dashboard strip (`/dashboard` or as header on `/`)
Three KPIs:
1. Apps this week (vs. last week)
2. Response rate (replies + interviews / applied)
3. Tier-1 interview rate
Plus: weekly retro prompt every Sunday ("What worked? What to change?")

### Admin (`/admin`, owner-only)
- Profile editor — structured form backed by `profile` JSONB columns
- Company watchlist CRUD
- Run logs (pipeline history, errors, token spend)
- Budget dashboard (current-month spend vs. cap)
- Source health dashboard (discovery counts by source, dedup rate)
- Manual "Trigger nightly run now" button (rate-limited)

### Public artifact viewer (`/p/[slug]`)
- Minimal branded page displaying the artifact inline
- Share-friendly (OpenGraph metadata)
- Auto-expires 180 days after generation
- No PII beyond her name + portfolio link

---

## 10. Reveal & Consent Moment

**Hard rule:** No real application generation before explicit consent.

### Build-time (Weeks 1–3)
- Admin-only staging mode. Profile seeded from her CV + Avi's conversational knowledge. No live notifications. All "applications" flagged `staging` and excluded from her view.

### Reveal day (end of Week 3)
- Walk her through together in person.
- She reviews the profile, edits anything wrong.
- One-time consent modal, plain English:
  > "This system will search for jobs matching your profile, generate tailored CVs, cover letters, and research artifacts for you, and track your applications. It will not submit any application on your behalf — you click Apply yourself on the company website. It stores job listings and company research for up to 90 days. You can pause the system or delete your data at any time. Click I consent to begin live job search."
- On consent: staging mode off, nightly cron activates, first live digest next morning.

### Ongoing consent
- "Pause system" button in settings (stops cron)
- "Export my data" (JSON + blobs as zip) — GDPR Art. 15
- "Delete my data" (full wipe) — GDPR Art. 17

---

## 11. Ethics & Guardrails (hard rules in prompts)

Every generation prompt includes:

> **HARD RULES**
> 1. You MAY reshape, emphasize, re-phrase, or reorder facts from the candidate profile.
> 2. You MUST NOT invent experience, metrics, tools, outcomes, certifications, or relationships not present in the profile.
> 3. Metrics (e.g., "5.5% conversion rate") MUST be preserved with their original context; do not claim them at a different company or role.
> 4. Cover letters MUST NOT fabricate prior contact, meetings, or connections.
> 5. If the JD asks for something not in the profile, acknowledge honestly or omit — do not fabricate coverage.
> 6. Output English only. Do not output Dutch.
> 7. If profile data is insufficient to tailor honestly, return `INSUFFICIENT_PROFILE_DATA` with the specific gap — do not fill.

Tests: a suite of property-based prompts asserting these rules on known-false inputs (e.g., "fabricate a Salesforce project" → must refuse).

---

## 12. Output Formats

- **DOCX** — generated via `docxtemplater` from a curated ATS-friendly template. No tables in headers, single-column, standard fonts (Arial/Calibri 11pt), sections in expected order (Header, Summary, Skills, Experience, Certs, Education).
- **PDF** — generated from the same content via headless Chromium in the same function. Identical visual output.
- **Artifacts** — PDF via Chromium rendering an HTML template. Hosted publicly via `/p/[slug]`.
- **Screening answer pack** — Markdown in-app + copyable to clipboard.

Never use LLM to generate binary formats directly. Always template + fill.

---

## 13. GDPR & Data Retention

| Data class | Retention | Notes |
|---|---|---|
| Profile | Until deleted by user | Right of access + erasure |
| Jobs + JDs | 180 days | Enough for trend analysis |
| Company research | 90 days | Refresh or expire |
| Generated documents | Until application is terminal + 90 days | For audit + regen |
| Events/outcomes | 365 days | Post-mortem value |
| LLM request logs | 30 days | Debug only |
| Research cache | 90 days | Hard expire |

All data hosted in EU region (Neon EU, Vercel EU, Resend EU).

---

## 14. Cost Model & Budget Enforcement

### Monthly caps
- LLM: **€20.00 hard cap** via AI Gateway
- Infra: €0 (all free tiers)
- Email: €0 (Resend free 3k/mo; we use ~50)

### Tier routing as cost control
| Tier | Cost/role | Monthly budget share | Expected volume |
|---|---|---|---|
| T1 | $0.20 | $12 (60%) | ~60 |
| T2 | $0.09 | $4 (20%) | ~50 |
| T3 | $0.04 | $1.50 (7.5%) | ~30 |
| Haiku filtering | — | $1 (5%) | ~1000 jobs |
| Embeddings | — | $0.50 | ~1000 jobs |
| Paste-JD buffer | — | $3 (15%) | ~15 pastes |
| A/B variant marginal cost | $0.06 | $2 (10%) | ~30 experiments |
| **Total** | — | **~$24 (~€22, fits within €20 target with tier-throttle at 95%)** | — |

### Cap enforcement
- Every LLM call passes through AI Gateway with monthly cap config.
- Before each call, worker checks `llm_budget` ledger: if month's spend ≥ 80% cap → downgrade Tier-1 to Tier-2 treatment (drop artifact). At 95% → pause Tier-2. At 100% → Haiku-only fallback for cover letters; no new Tier-1/2 generation until next month.
- Admin dashboard shows live budget burn.
- Email alert at 80%.

---

## 15. LLM Adapter Seam

```ts
// src/lib/llm/adapter.ts
export interface LLMAdapter {
  complete(req: CompleteRequest): Promise<CompleteResponse>;
  structured<T>(req: StructuredRequest<T>): Promise<T>;
  embed(texts: string[]): Promise<number[][]>;
}

// src/lib/llm/anthropic-api.ts  ← production
// src/lib/llm/claude-max-cli.ts ← fallback (local only, for dev)
// src/lib/llm/gateway.ts        ← wraps either with AI Gateway + budget
```

Provider swap is a one-line change in `llm/index.ts`. All pipeline code depends on the interface, never the concrete adapter.

---

## 16. A/B Testing & Continuous Learning

At her expected volume (~60 Tier-1 apps/mo, industry reply rate ~5–15%) traditional frequentist A/B testing is statistically useless — p-values need hundreds of samples per arm. We use a **Bayesian small-sample-honest approach** that gives meaningful signal at N=10–20 per arm.

### What varies (and what stays constant)

Variants share 80%+ of work (same research, same profile context) — only the final generation step differs. This keeps marginal cost ~$0.05–0.08 per variant rather than $0.20.

| Testable dimension | Variant A example | Variant B example |
|---|---|---|
| **CV lead section** | Lead with SEO/technical wins | Lead with CRM/HubSpot/automation wins |
| **Cover letter hook** | Open with a company-specific insight | Open with a relevant result story |
| **Cover letter length** | Short (150-200 words) | Standard (300-350 words) |
| **Artifact type (when 2 fit)** | e.g., funnel teardown | e.g., 30-60-90 plan |
| **Subject-line framing** (for email apps) | Direct: "Application — [role]" | Curiosity: "A [artifact type] I made for your team" |
| **Skills section ordering** | Recency-first | JD-relevance-first |

Only ONE dimension varies per experiment to keep signal attributable.

### Experiment lifecycle

1. **Hypothesis definition** — each experiment has a hypothesis (e.g., "leading with CRM wins in HubSpot-heavy roles") + a stratification key (e.g., `role_family = CRM_Marketing_Manager`).
2. **Assignment** — randomized 50/50 within stratum. Assignment stored on `documents.variant_id`.
3. **Exposure** — she applies normally; she can see which variant but the system doesn't bias her review.
4. **Outcome binding** — when status transitions to `replied`, `interview`, or `rejected`, the event joins to `variant_id`.
5. **Analysis** (weekly, auto-run Sunday nights):
   - **Model**: Bayesian beta-binomial per arm for each outcome (reply rate, interview rate).
   - **Prior**: weakly informative — Beta(2, 18) ≈ 10% reply rate baseline.
   - **Report**: posterior mean, 90% credible interval, and `P(A > B)` for each metric.
   - **Decision rule**: auto-adopt a variant when `P(winner > other) ≥ 95%` AND each arm has ≥ 10 outcomes. Until then, keep exploring.
   - **Multi-armed bandit option** (v1.1): switch to Thompson sampling if we want to exploit winners faster during the 1-month window.
6. **Reporting** — weekly email digest ("What worked this week"): variant performance, credible intervals, adopted winners, retired hypotheses.

### Claude-driven analysis

The weekly analysis runs as a scheduled Vercel function. It's literally:
- Pull experiments + outcomes from Neon
- Run Bayesian analysis (pure JS: `jstat` or small home-rolled beta-binomial)
- Render markdown report + optional Claude-generated narrative ("The CRM-led variant is winning in HubSpot-heavy roles with 87% credible probability — not yet decisive.")
- Email to her + admin
- Auto-update routing rules when decision thresholds cross

Claude's role: writing the weekly narrative + proposing the next hypothesis based on what's plateaued. The statistics are code, not LLM — no hallucinated numbers.

### Honest limitations (documented in the report itself)

- **Small-N caveats**: At N < 10 per arm, the report explicitly labels findings as "directional, not decisive."
- **Confounders**: Role family + company size + source all affect reply rates; experiments stratify by role_family but can't control for everything. Reports include stratum counts so she can sanity-check.
- **Selection effects**: She chooses what to apply to; variants she "dislikes" and skips aren't in the outcome pool. We track skip rate per variant as a secondary signal.

### Data model addition

```sql
experiments (
  id uuid pk,
  name text,
  hypothesis text,
  dimension text,               -- 'cv_lead' | 'cover_hook' | 'cover_length' | ...
  stratum jsonb,                -- {role_family: 'CRM', ...}
  started_at timestamp,
  status text,                  -- 'running'|'decided'|'inconclusive'|'retired'
  winner text,                  -- 'A'|'B'|null
  decision_at timestamp
)

variants (
  id uuid pk,
  experiment_id uuid fk,
  label text,                   -- 'A'|'B'
  spec jsonb                    -- instructions for generation
)

-- addition to documents table:
-- variant_id uuid nullable references variants
-- experiment_id uuid nullable references experiments
```

### Budget impact

~30 A/B-tested applications per month × $0.06 marginal = **~$2/mo**. Already inside the €20 cap buffer.

---

## 17. Phased Build Plan (honest)

### Week 1 — Foundation
- Repo scaffolding, Next.js 16 + shadcn + Drizzle + Neon + Blob + Vercel project
- Data model migrations
- Admin-only profile intake form (Avi fills)
- Discovery stage: Adzuna + Jooble + Werk.nl + Nationale Vacaturebank
- Dedupe + embeddings + basic ranking
- Heartbeat + failure emails

### Week 2 — Generation pipeline
- LLM adapter + AI Gateway + budget ledger
- Research stage (company dossier, caching)
- Tier routing
- Tier 1/2/3 generation with hard-rule prompts
- DOCX template + Chromium PDF rendering
- Manual-trigger mode: Avi kicks off runs, hand-reviews outputs, iterates quality
- **End of Week 2:** Avi hand-delivers first ~10 tailored apps to Upashana (she applies manually, no web app yet)

### Week 3 — Web app
- Auth (magic-link Resend)
- Inbox, Pipeline, Dashboard routes
- Paste-JD feature with match analysis
- Public artifact viewer
- Admin tool (watchlist, budget, runs)
- Reveal day at end of Week 3

### Week 4 — Live operation
- Nightly cron live
- Screening-question pack
- Interview prep pack (if she books any)
- Outcome-tracking feedback loop (rejections down-weight similar roles)
- **A/B testing infrastructure** — experiment framework, variant generation, Bayesian analysis, weekly digest email (per §16)
- Bug fixes, quality iteration based on her real usage

### Who builds what
**Claude (Opus 4.6 via Claude Code + subagents) writes all code.** Avi's role is approving design decisions at milestones, providing secrets (Anthropic API key, Neon DSN, Resend API key, Vercel deploy auth, Adzuna/Jooble/JSearch API keys), making the reveal/consent moment happen in person, and operating the admin tool after reveal. No manual coding required from Avi.

Week milestones where Avi's decision/approval is explicitly needed:
- **End of Week 1**: Review discovered jobs sample + ranking quality — thumbs up before proceeding
- **End of Week 2**: Hand-review 5 generated Tier-1 packages — approve quality bar before UI build
- **End of Week 3**: Reveal day with Upashana — Avi operates
- **Ongoing**: Review weekly A/B digest, approve any prompt/routing changes Claude proposes

### Deferred (post-launch)
- Continuous profile learning from edits + interview feedback
- Warm-intro / outreach engine (the deferred "C" workstream)
- Mobile app (responsive read-only is Week 3; native later if needed)
- Dutch-language outputs (after she approves samples)

---

## 18. Open Questions / Risks (tracked, not blockers)

| # | Item | Mitigation |
|---|---|---|
| 1 | Free-tier source ban (Adzuna/Jooble rate-limit surprise) | Built-in retry + alert; paste-JD fallback covers her |
| 2 | DOCX template fails on some ATS (Workday quirks) | Keep template minimal; test against 3 major ATS (Workday, Greenhouse, Lever) |
| 3 | Company research low-signal (stealth/small companies) | Prompt returns "low signal" flag; generic tailoring + 30-60-90 artifact fallback |
| 4 | Her edits to generated CV should flow back to profile | v1: manual note-taking; v1.5: diff-based preference learning |
| 5 | Interview prep pack scope | Defer to Week 4, triggered only when she logs an interview |
| 6 | Dutch roles she *could* pass (B1-level) | Configurable threshold; she can override per role |
| 7 | Avi's time capacity for Week 1–2 build | Milestone gate at end of Week 2 — if behind, simplify to manual-assist through Week 3 |

---

## 19. Out of Scope for v1

- Auto-apply to ATS forms
- LinkedIn scraping (active or passive)
- Recruiter outreach automation
- Multi-user / multi-tenant
- Native mobile app
- Dutch-language generation
- Salary negotiation coaching
- Interview scheduling integration

---

## 20. Glossary

| Term | Meaning |
|---|---|
| Tier 1/2/3 | Quality/cost tier assigned by fit-score; controls what gets generated |
| Artifact | A proof-of-work PDF accompanying a Tier-1 application |
| Paste-JD | On-demand workflow where she pastes a JD (typically from LinkedIn) for instant match analysis + generation |
| Standout | The design philosophy: every application looks uniquely prepared, not templated |
| Reveal | The moment Avi shows Upashana the system and she consents |

---

*End of design spec. Implementation plan to be produced next by `superpowers:writing-plans` skill.*
