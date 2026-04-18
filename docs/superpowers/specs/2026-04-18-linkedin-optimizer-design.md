# LinkedIn Profile Optimizer — Design Spec

**Date:** 2026-04-18  
**Status:** Approved for implementation  
**Scope:** v3 feature — optimise Upashana's LinkedIn public profile for recruiter discoverability in digital marketing / automation / CRM / NL market

---

## Problem

Upashana's LinkedIn profile is written for a generalist audience. Recruiters in the NL marketing automation space search specific terms (HubSpot, CRM, automation, lifecycle) that may not appear prominently in her current headline and about section. The CV and cover letter are already tailored per application; her public LinkedIn profile is not optimised for inbound recruiter discovery at all.

---

## Solution

A LinkedIn Profile Optimizer tab inside the existing Profile page. She uploads her LinkedIn PDF export once; Disha calls Sonnet with the full PDF text and returns rewritten sections with reasoning. Rewrites are stored in the database and shown with one-click copy buttons. No re-run unless she re-uploads.

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Placement | Tab within `/profile` page | LinkedIn profile is about professional identity — same mental model as her Disha profile. Avoids a 6th nav item for an occasional feature. |
| Tab layout | "Your profile" \| "LinkedIn" two tabs | Clean separation; LinkedIn Optimizer feels intentional, not appended. |
| Content layout | Rewrite-only + reasoning (Option B) | She already knows her current profile. Copy + reasoning is more actionable than a side-by-side. |
| Optimisation scope | General (not job-specific) | LinkedIn is a public profile. Job-specific tailoring is what the CV/cover letter are for. |
| Processing | One Sonnet call per upload | Sufficient for structured rewrite. No retry loop needed — structured JSON output is deterministic enough. |
| Re-runs | Only on re-upload | Prevents accidental re-generation and unnecessary LLM cost. Show "last optimised X ago" instead of a re-run button. |
| Versioning | Overwrite on re-upload (no history) | v1 simplicity. Profile rewrites don't need audit trail. |

---

## Sections Optimised

| Section | What Disha rewrites | Copy target |
|---|---|---|
| **Headline** | Single line, keyword-rich, NL-market signal | Paste directly into LinkedIn headline field |
| **About** | 3–5 sentence summary opening with the most-searched term, positioning as specialist not generalist | Paste into LinkedIn about section |
| **Experience bullets** | 2–3 bullet rewrites for each of the top 3 most recent roles — outcome-focused, metric-forward | Per-role, per-bullet copy |
| **Skills** | Ordered skill list prioritising recruiter-searched terms (HubSpot, CRM, Marketing Automation, etc.) | Copy full list |

---

## Data Model

New table: `linkedin_optimizations`

```sql
CREATE TABLE linkedin_optimizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  raw_text    text NOT NULL,           -- extracted PDF text
  rewrites    jsonb NOT NULL,          -- structured output (see schema below)
  token_cost  numeric(10,6),           -- EUR cost of Sonnet call
  model       text                     -- model used (e.g. "claude-sonnet-4-5")
);
```

### `rewrites` JSON schema

```json
{
  "headline": {
    "text": "Marketing Automation Specialist | HubSpot · CRM · Email · NL",
    "reasoning": "Target roles search 'automation' + location signal boosts NL visibility"
  },
  "about": {
    "text": "Marketing automation specialist with 10 years driving CRM-led growth...",
    "reasoning": "Opens with the most searched term; positions as specialist not generalist"
  },
  "experience": [
    {
      "company": "Inbox Storage BV",
      "role": "Digital Marketing Manager",
      "bullets": [
        "Grew HubSpot-managed lifecycle revenue by 34% in 18 months through segmentation and A/B testing",
        "Built CRM automation flows reducing manual outreach time by 60%"
      ],
      "reasoning": "Replaced generic task descriptions with outcome metrics and tool names recruiters search"
    }
  ],
  "skills": {
    "text": "HubSpot · Marketing Automation · CRM · Email Marketing · SEO · Google Analytics · Paid Media · A/B Testing · Salesforce · Pardot",
    "reasoning": "Reordered to front-load the most-searched terms in NL marketing automation market"
  }
}
```

---

## Architecture

### New files

| Path | Purpose |
|---|---|
| `src/app/(app)/profile/linkedin/page.tsx` | LinkedIn tab content (server component — reads latest optimization from DB) |
| `src/app/api/linkedin/optimize/route.ts` | POST endpoint — accepts PDF, extracts text, calls Sonnet, stores result |
| `src/lib/linkedin/extract.ts` | PDF text extraction via `pdf-parse` |
| `src/lib/linkedin/optimize.ts` | Sonnet prompt + structured output schema |
| `src/db/migrations/0005_linkedin_optimizations.sql` | Table creation |
| `src/components/linkedin/OptimizerPanel.tsx` | Client component — upload form + rewrite display + copy buttons |
| `src/components/linkedin/CopyButton.tsx` | Reusable copy-to-clipboard button with "Copied!" feedback |

### Modified files

| Path | Change |
|---|---|
| `src/app/(app)/profile/page.tsx` | Add tab navigation ("Your profile" \| "LinkedIn") |
| `src/db/schema.ts` | Add `linkedinOptimizations` table definition |

### Request flow

```
User uploads PDF
  → POST /api/linkedin/optimize (multipart/form-data)
  → extract text via pdf-parse
  → validate: must be >500 chars (basic sanity check)
  → call Sonnet with full text + system prompt
  → parse structured JSON response
  → INSERT into linkedin_optimizations
  → return { ok: true, id, rewrites }
  → client renders OptimizerPanel with rewrites
```

### Tab routing

Profile page uses a simple query param: `/profile` (Your profile tab) and `/profile?tab=linkedin` (LinkedIn tab). No nested routing — both tabs are within the existing `/profile` page component.

---

## UI Behaviour

### Upload state (no optimization yet)

```
[ LinkedIn tab ]

  Upload your LinkedIn PDF export to get Disha's suggestions.
  
  [ 📄 Upload PDF ]  ← file input, accepts .pdf only
  
  Disha will rewrite your headline, about section, top 3 roles,
  and skills list for recruiter discoverability in the NL market.
```

### Loaded state (optimization exists)

```
[ LinkedIn tab ]

  Last optimised 3 days ago  [ ↑ Re-upload ]

  ─── HEADLINE ───────────────────────────────────────────
  Marketing Automation Specialist | HubSpot · CRM · Email · NL
                                              [ Copy ]
  ↳ Target roles search "automation" + location signal boosts NL visibility

  ─── ABOUT ──────────────────────────────────────────────
  Marketing automation specialist with 10 years driving...
                                              [ Copy ]
  ↳ Opens with the most searched term; positions as specialist

  ─── EXPERIENCE — Inbox Storage BV ─────────────────────
  Digital Marketing Manager
  • Grew HubSpot-managed lifecycle revenue by 34% in 18 months...  [ Copy ]
  • Built CRM automation flows reducing manual outreach time...     [ Copy ]
  ↳ Replaced generic tasks with outcome metrics and searchable tool names

  ─── SKILLS ─────────────────────────────────────────────
  HubSpot · Marketing Automation · CRM · Email Marketing · SEO...
                                              [ Copy ]
  ↳ Reordered to front-load most-searched terms in NL market
```

### Loading state (during generation)

- Spinner with "Disha is reading your profile…" message
- Estimated time: 15–25 seconds
- Disable re-upload during processing

---

## LLM Prompt Design

**Model:** Sonnet (one call, no retry loop — structured output is reliable enough)  
**Max tokens:** 2500  
**Temperature:** 0.3

**System prompt summary:**
- You are a LinkedIn profile specialist for the Netherlands digital marketing market
- Optimize for recruiter searchability — not creativity
- Ground every suggestion in the candidate's actual profile — no fabrication
- Lead with the most-searched term in each section
- Anti-AI rules: no em-dashes, no "leverage", no "dynamic", no negative parallelisms
- Output strict JSON matching the schema

**User prompt:**
```
Here is the candidate's LinkedIn profile PDF text:

{raw_text}

Rewrite headline, about, top 3 experience sections (bullet points), and skills.
Return JSON only. No preamble.
```

---

## Error handling

| Scenario | Behaviour |
|---|---|
| Non-PDF uploaded | Client-side rejection before upload |
| PDF too short (<500 chars) | Return `{ ok: false, error: "PDF appears empty or too short" }` |
| Sonnet call fails | Return `{ ok: false, error: "Generation failed — try again" }` — do not store partial result |
| pdf-parse fails | Return `{ ok: false, error: "Could not read PDF — try re-exporting from LinkedIn" }` |

---

## Constraints

- No new paid API keys — uses existing `ANTHROPIC_API_KEY`
- `pdf-parse` is the only new dependency (MIT license, no external calls)
- Single stored optimization — overwrite on re-upload
- No versioning in v1
- Mobile: upload + copy works on mobile Safari (file input accepts PDF from Files app)

---

## Out of scope (v3)

- Job-specific optimization (CV/cover letter already handle this)
- Side-by-side diff view
- Optimization history / versioning
- Sharing or exporting the optimized profile
- Auto-detection of LinkedIn PDF format vs other PDF types
