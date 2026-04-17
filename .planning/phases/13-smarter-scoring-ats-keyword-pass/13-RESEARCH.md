# Phase 13: Smarter Scoring + ATS Keyword Pass - Research

**Researched:** 2026-04-17
**Domain:** Fit scoring UI, feedback multipliers, tier drift detection, ATS keyword injection
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R-78 | Score breakdown panel per job: component weights + matched/missing profile fields | `fitBreakdown` (JSONB) and `gapAnalysis` (JSONB) already stored on `jobs` table. Detail page already renders a breakdown bar chart — needs extension to show matched/missing fields, not just raw scores. |
| R-79 | Outcome feedback loop: rejection/interview/offer updates scoring weight multipliers for similar roles | `profile` table has a freeform `preferences` JSONB column. Feedback multipliers can be stored there without schema migration. `updateApplicationStatus` server action is the correct hook point. |
| R-80 | Score drift alerts when tier changes between runs | No `previousTier` column exists. `jobs` table must gain a `previousTier` column (nullable smallint). Orchestrator re-score path must write old tier before updating. Alert surfaced in triage inbox UI. |
| R-84 | ATS keyword post-pass in nightly cron: compare generated CV vs JD, inject missing exact-match keywords into skills section, no extra LLM calls | CV generation is currently on-demand (API route only), NOT run in the nightly cron. The nightly orchestrator only scores jobs. A new T1/T2 batch-generation step must be added to the cron. ATS pass runs after `generateCV`, before `renderCvDocx`. |

</phase_requirements>

---

## Summary

Phase 13 adds four capabilities on top of the existing v1 pipeline. Three are scoring/feedback enhancements (R-78, R-79, R-80) that operate on data already in the database. The fourth (R-84) requires wiring CV generation into the nightly cron, which currently only scores jobs.

**Key discovery:** CV generation does not run in the nightly cron today. `src/app/api/cron/nightly/route.ts` calls only `runNightly()` (orchestrator), which ends at tier assignment. CV generation happens on-demand via the `/api/generate/cv/[jobId]` API route. R-84 requires a new nightly generation step that (1) picks up newly-tiered T1/T2 jobs, (2) calls `generateCV`, (3) runs the ATS keyword post-pass, and (4) stores the document. This is the largest structural change in the phase.

The feedback multiplier (R-79) fits cleanly into the existing `profile.preferences` JSONB without a schema migration. The tier drift alert (R-80) requires one new nullable column on `jobs`. The score breakdown panel (R-78) is largely a UI enhancement — the data already exists in `fitBreakdown` and `gapAnalysis`.

**Primary recommendation:** Plan this phase in three plans: (1) schema + data layer changes, (2) nightly generation pipeline + ATS post-pass, (3) UI enhancements (breakdown panel, drift alert).

---

## Standard Stack

### Core (already in project)
| Library | Purpose | Relevant to Phase |
|---------|---------|-------------------|
| Drizzle ORM + `drizzle-kit` | Schema migrations, DB queries | New `previousTier` column migration |
| Next.js App Router server actions | Mutation entry points | Feedback multiplier hook in `updateApplicationStatus` |
| `src/lib/analytics/keywords.ts` | Keyword extraction, regex matching | Reuse `keywordRegex`/`KEYWORDS` for ATS pass |
| `src/lib/generate/cv-types.ts` | `CvStruct` type with `skillsGrouped` | ATS injection target field |
| `src/lib/generate/cv.ts` `generateCV()` | CV generation | Called in new nightly batch step |
| `src/lib/pipeline/rank.ts` `blendFitScore()` | Weighted scoring formula | Feedback multiplier applied here |
| Vitest | Unit tests | New tests for multiplier math, ATS injector |

### No new dependencies required
All capabilities can be implemented with the existing stack. No new packages needed.

**Installation:** None required.

---

## Architecture Patterns

### Recommended File Structure for New Code
```
src/lib/
├── scoring/
│   ├── multipliers.ts       # R-79: read/write feedback multipliers from profile.preferences
│   └── drift.ts             # R-80: compare old tier vs new tier, flag changes
├── ats/
│   └── keyword-pass.ts      # R-84: extract JD keywords, diff against CV text, inject into skillsGrouped
src/db/
└── migrations/
    └── 0003_phase13.sql     # R-80: ADD COLUMN previous_tier SMALLINT
src/app/(app)/inbox/[jobId]/
└── page.tsx                 # R-78: extend breakdown section with matched/missing fields
```

### Pattern 1: fitBreakdown + gapAnalysis already stored on jobs (R-78)

**What:** `jobs.fitBreakdown` is JSONB storing `{ skills, tools, seniority, industry }` as 0..1 floats. `jobs.gapAnalysis` stores `{ strengths, gaps, recommendation, recommendationReason }`. Both already rendered in the detail page.

**What is missing for R-78:** The current breakdown shows raw component scores as bars. R-78 requires showing which specific profile fields matched and which were missing. The Haiku assessment already returns `strengths` and `gaps` arrays (up to 4 each). These are currently displayed as "Why you're a strong fit" copy. They need to be re-presented in the breakdown panel as structured matched/missing fields with component attribution.

**No schema change needed.** All data is already stored; it's a UI restructuring task.

**Example — current shape of `gapAnalysis`:**
```typescript
// Source: src/app/(app)/inbox/[jobId]/page.tsx line 10-11
type GapAnalysis = {
  strengths?: string[];       // up to 4 — "matched" signals
  gaps?: string[];            // up to 4 — "missing" signals
  recommendation?: string;
  recommendationReason?: string;
} | null;
```

**Example — current shape of `fitBreakdown`:**
```typescript
// Source: src/lib/pipeline/rank.ts FitComponents
type FitBreakdown = {
  skills: number;    // 0..1 — 40% weight
  tools: number;     // 0..1 — 30% weight  (NOTE: rank.ts WEIGHTS shows tools=0.30, not 0.25 as stated in R-78)
  seniority: number; // 0..1 — 15% weight
  industry: number;  // 0..1 — 15% weight
};
```

**Important discrepancy:** REQUIREMENTS.md R-30 says weights are `skills 40%, tools 25%, seniority 15%, geo 10%, industry 10%`. But `rank.ts` current implementation has `skills 40%, tools 30%, seniority 15%, industry 15%` (no geo component). R-78 description says "skills, tools, seniority, geo, industry". The geo component was dropped (or never implemented). The planner should use the current `rank.ts` weights as ground truth — R-78's display must match what the code actually computes. `[VERIFIED: src/lib/pipeline/rank.ts]`

### Pattern 2: Feedback Multipliers in profile.preferences (R-79)

**What:** When an outcome (rejected/interview/offer) is recorded, a multiplier adjusts future scoring weights for similar-role categories. Stored in `profile.preferences` JSONB — no migration needed.

**Storage approach:**
```typescript
// Extend profile.preferences JSONB (no schema migration — it's already jsonb)
// Source: src/db/schema.ts line 17 — preferences: jsonb("preferences")
interface ScoringMultipliers {
  byIndustry?: Record<string, number>;    // e.g. { "SaaS": 0.9 } after rejection
  bySeniority?: Record<string, number>;   // e.g. { "senior": 1.1 } after interview
  byToolKeyword?: Record<string, number>; // e.g. { "HubSpot": 1.05 }
}
// Stored at profile.preferences.scoringMultipliers
```

**Hook point:** `src/app/(app)/pipeline/actions.ts` `updateApplicationStatus()` — this server action is called for every status transition. Add multiplier update logic here for `rejected`, `interview`, and `offer` outcomes.

**How multiplier is applied:** `blendFitScore()` in `rank.ts` currently takes raw component floats. A thin wrapper `blendFitScoreWithMultipliers(components, multipliers)` applies multipliers before blending. This keeps the base function testable in isolation.

**Multiplier decay:** Simple approach — cap each multiplier at 0.75 (min) and 1.25 (max). Clamp in the multiplier writer, not the reader. `[ASSUMED]` — specific decay curve not specified in requirements; this is Claude's discretion.

### Pattern 3: Tier Drift Detection (R-80)

**What:** When a job's tier changes between nightly runs, record the old tier and surface an alert.

**Schema change required:** Add `previous_tier SMALLINT` column to `jobs` table. Migration via `drizzle-kit generate`.

**Where drift is detected:** The nightly orchestrator currently only inserts new jobs (idempotency check skips existing rows). Tier drift implies the orchestrator needs a re-score pass for existing jobs. R-80 says "when a job's tier changes between scoring runs" — this means the orchestrator must also re-score jobs already in DB (at least those seen in the current discovery batch). `[ASSUMED]` — the requirement doesn't specify a rescore cadence; the cleanest implementation re-scores only jobs re-discovered in the current run (already in `existingSet`), updating `fitScore` + `tier` + `previousTier`. Jobs not re-discovered are not re-scored.

**Drift alert surface:** The triage inbox page (`/inbox`) is the right surface. A drift alert is a job where `previousTier IS NOT NULL AND previousTier != tier`. Display as a badge/callout in the `JobCard` component. The `loadJobs()` query needs to select `previousTier`.

**No new notification infrastructure needed.** [VERIFIED: existing `inbox/page.tsx` — already a server component that can trivially add a drift-badge UI element]

### Pattern 4: ATS Keyword Post-Pass (R-84)

**What:** After CV generation, compare generated CV text against JD text. Extract high-frequency exact-match keywords in JD that are absent from CV's skills section. Inject missing keywords into the most relevant `skillsGrouped` group (or add a new "Additional Skills" group). Zero new LLM calls.

**Key constraint:** CV generation must be added to the nightly cron. Currently the orchestrator does NOT call `generateCV`. A new `generateForNewJobs()` function must:
1. Query jobs with `tier IN (1, 2)` that have no document yet (join against `applications` and `documents`)
2. For each, call `generateCV(job.id)`
3. Run ATS post-pass on the `CvStruct`
4. Call `renderCvDocx` and `storeCv`

**The nightly budget constraint:** Sonnet 4.5 CV generation costs ~$0.20 per T1 job. If 5 new T1 jobs land per night, that's $1.00 — within the €20/mo budget. The orchestrator's existing budget gateway will block if limit is hit. The cron has `maxDuration = 300s` (Vercel Fluid Compute). Generation should run concurrently with `p-limit(2)` to stay within time budget.

**ATS keyword extraction algorithm (rules-based, no LLM):**
```typescript
// Source for pattern: src/lib/analytics/keywords.ts — keywordRegex() already exists
// Reuse the same word-boundary regex approach

function atsKeywordPass(cv: CvStruct, jdText: string): CvStruct {
  // 1. Extract all words/phrases from JD that appear >= 2 times (frequency threshold)
  //    Focus on noun phrases 1-3 words long. Use simple tokenization.
  // 2. Flatten skillsGrouped items to a string blob
  // 3. Diff: JD keywords NOT in CV skills blob
  // 4. Inject up to N missing keywords into most relevant group
  //    (match group name to keyword domain, or append to last group)
  // 5. Return modified CvStruct — same shape, no schema change
  return cv; // modified
}
```

**Key implementation detail:** The `CvStruct.skillsGrouped` field is `Array<{ group: string; items: string[] }>`. Injection appends to `items` of an existing group, or adds a new group `{ group: "Additional Skills", items: [...] }`. This is the only structural change to the CV. The DOCX renderer in `cv-docx.ts` already loops over `skillsGrouped` so no renderer change is needed.

**What "exact-match keywords" means here:** The JD frequently repeats certain terms (tool names, methodologies, skill labels). Terms appearing 2+ times in the JD that are absent from the CV skills section are candidates. Limit injection to 3-5 keywords to avoid stuffing. Filter out stop words and job-generic words ("required", "experience", "team").

### Anti-Patterns to Avoid

- **Do not re-run Haiku on existing jobs for drift detection.** Re-scoring via LLM would consume budget. Drift detection should use the existing score math — only LLM score if the job is re-discovered in a new run.
- **Do not store feedback multipliers as a separate DB table.** A new `scoring_feedback` table adds migration overhead. `profile.preferences` JSONB is the correct lightweight store for a single-user tool.
- **Do not add geo to the breakdown display.** Geo component does not exist in `rank.ts`. Displaying it would require a schema change and backfill. R-78 display should show the 4 components that actually exist.
- **Do not use LLM for ATS keyword injection.** R-84 explicitly prohibits extra LLM calls. All keyword extraction is regex/frequency-based.
- **Do not refactor `blendFitScore()` in place.** Existing unit tests (`tests/unit/fit-scoring.test.ts`) test the pure function. Keep it pure; wrap it in a multiplier-aware function instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Keyword regex matching | Custom tokenizer | `keywordRegex()` from `src/lib/analytics/keywords.ts` — already tested, handles word boundaries |
| DOCX skills section rendering | New DOCX layout | Existing `cv-docx.ts` loop over `skillsGrouped` already handles arbitrary groups |
| Status transition hook | New API route | `updateApplicationStatus` server action in `pipeline/actions.ts` — already the single point for all status changes |
| DB migration | Raw SQL | `drizzle-kit generate` + `drizzle-kit migrate` — matches existing pattern in `drizzle.config.ts` |

---

## Common Pitfalls

### Pitfall 1: Re-scoring existing jobs consumes Haiku budget
**What goes wrong:** If drift detection triggers a Haiku call for every job re-discovered in a run, a 50-job run costs ~$0.05 extra — small but cumulative.
**Why it happens:** Misreading R-80 as "always re-score to detect drift."
**How to avoid:** Only re-score a job if it was re-discovered in the current run's discovery batch AND does not have a score yet (or its JD changed). For jobs already scored, drift should be detected at the time of the initial insert by comparing against the pre-existing DB row's tier. Alternatively, store `previousTier` at the time of a re-score triggered by a JD change signal.
**Simpler approach for v2:** Since the orchestrator currently skips existing jobs (`existingSet` check), drift detection applies to the moment a job is first inserted. "Tier drift" in R-80 most likely refers to: the user manually requests a re-score (via admin), and the new tier differs from the old tier. The planner should confirm this scope with Avi.

### Pitfall 2: Nightly CV generation timing out on Vercel Hobby (300s limit)
**What goes wrong:** If 10+ new T1/T2 jobs land in one run, Sonnet CV generation at ~15s/job = 150s+ plus existing pipeline work may exceed the 300s Fluid Compute ceiling.
**Why it happens:** CV generation is Sonnet-based with up to 5 retry attempts; anti-AI checks add latency.
**How to avoid:** Cap batch CV generation at 5 jobs per cron run (`p-limit(2)`, max 5 jobs). Remaining jobs generate on-demand when Upashana opens the detail page. The cron already has idempotency — next tick picks up remaining jobs.

### Pitfall 3: ATS keyword injection breaks anti-AI rules
**What goes wrong:** Injected keywords are appended verbatim (e.g. "HubSpot, Marketo, Pardot") but the sanitiser (`sanitizeMechanicalTells`) runs after generation, not after ATS post-pass.
**Why it happens:** The `sanitizeMechanicalTells` + `findViolations` checks in `cv.ts` run on the LLM-generated text. The ATS post-pass happens after those checks.
**How to avoid:** The ATS pass only appends keywords (tool names, skill nouns) to the `items` array of `skillsGrouped`. These are proper nouns / tool names — they won't trigger anti-AI rules. No need to re-run the violation checker, but document this assumption clearly in code comments.

### Pitfall 4: Multiplier drift — weights diverge from useful range
**What goes wrong:** After many rejections, all multipliers collapse to 0.75, making every role look equal in score.
**Why it happens:** Multiplicative decay without a floor per-category.
**How to avoid:** Clamp multipliers at write time to [0.75, 1.25]. Apply multipliers additively to the component floats (clamp result to [0,1]), not multiplicatively to the final blended score.

### Pitfall 5: The `fitBreakdown` weights mismatch between display and actual computation
**What goes wrong:** R-78 spec mentions "skills 40%, tools 25%, seniority 15%, geo 10%, industry 10%" but the actual `WEIGHTS` in `rank.ts` are `skills:0.40, tools:0.30, seniority:0.15, industry:0.15`. Displaying the spec weights in the UI creates a lie.
**Why it happens:** Requirements doc copied from original design spec which included geo; geo was later removed from implementation but requirements text was not updated.
**How to avoid:** Display the weights as they appear in `rank.ts` (`WEIGHTS` constant). Label the geo row as absent. Consider updating `REQUIREMENTS.md` as a cleanup task in Wave 0.

---

## Code Examples

### Score Breakdown Panel Extension (R-78)
```typescript
// Source: src/app/(app)/inbox/[jobId]/page.tsx — existing breakdownRows pattern
// Extend to show weight labels alongside bar:
const COMPONENT_WEIGHTS = { Skills: 0.40, Tools: 0.30, Seniority: 0.15, Industry: 0.15 };
const breakdownRows = breakdown
  ? [
      { label: "Skills",    weight: 0.40, value: breakdown.skills    ?? 0 },
      { label: "Tools",     weight: 0.30, value: breakdown.tools     ?? 0 },
      { label: "Seniority", weight: 0.15, value: breakdown.seniority ?? 0 },
      { label: "Industry",  weight: 0.15, value: breakdown.industry  ?? 0 },
    ]
  : [];
// matched = gap.strengths, missing = gap.gaps (already in gapAnalysis JSONB)
```

### Feedback Multiplier Writer (R-79)
```typescript
// src/lib/scoring/multipliers.ts
// Source: inferred from profile.preferences JSONB structure [ASSUMED pattern]
export interface ScoringMultipliers {
  byIndustry: Record<string, number>;
  bySeniority: Record<string, number>;
}
const CLAMP_MIN = 0.75;
const CLAMP_MAX = 1.25;
const STEP = { rejected: -0.05, interview: +0.05, offer: +0.10 };

export function applyOutcome(
  current: ScoringMultipliers,
  outcome: "rejected" | "interview" | "offer",
  jobIndustries: string[],
  jobSeniority: string,
): ScoringMultipliers {
  const delta = STEP[outcome];
  const next = structuredClone(current);
  for (const ind of jobIndustries) {
    const prev = next.byIndustry[ind] ?? 1.0;
    next.byIndustry[ind] = Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, prev + delta));
  }
  const prev = next.bySeniority[jobSeniority] ?? 1.0;
  next.bySeniority[jobSeniority] = Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, prev + delta));
  return next;
}
```

### ATS Keyword Post-Pass (R-84)
```typescript
// src/lib/ats/keyword-pass.ts
// Reuses word-boundary regex pattern from src/lib/analytics/keywords.ts
import type { CvStruct } from "@/lib/generate/cv-types";

const STOP_WORDS = new Set(["experience", "required", "skills", "team", "work", "role", "job"]);
const MAX_INJECT = 5;
const MIN_JD_FREQUENCY = 2;

export function atsKeywordPass(cv: CvStruct, jdText: string): { cv: CvStruct; injected: string[] } {
  // 1. Tokenize JD into unigrams + bigrams
  // 2. Count frequency, keep those >= MIN_JD_FREQUENCY and not in STOP_WORDS
  // 3. Flatten cv.skillsGrouped items to blob
  // 4. Find missing keywords (in JD freq map, not in CV skills blob)
  // 5. Take top MAX_INJECT by frequency
  // 6. Append to last skillsGrouped group (or new "Additional Skills" group)
  // Return modified cv + list of injected keywords for logging
  const injected: string[] = [];
  // ... implementation
  return { cv, injected };
}
```

### Drift Detection Schema Migration
```sql
-- src/db/migrations/0003_phase13.sql (generated by drizzle-kit)
ALTER TABLE jobs ADD COLUMN previous_tier SMALLINT;
```

### Drift Badge in Inbox (R-80)
```typescript
// Extend loadJobs() in src/app/(app)/inbox/page.tsx to select previousTier
// Extend JobCardData type to include previousTier
// In JobCard component: render drift badge when job.previousTier != null && job.previousTier != job.tier
// Example: "Moved from T2 → T1" or "Moved from T1 → T2 (score dropped)"
```

---

## State of the Art

| Area | Current State | After Phase 13 |
|------|--------------|----------------|
| Score display | Single % number + bar chart of raw 0..1 components | Component weights shown, matched/missing profile fields labelled |
| Outcome recording | Status transition stored in `applications.status`, fires interview-prep gen | Also updates `profile.preferences.scoringMultipliers` |
| Tier history | Not stored | `previousTier` column persists last tier for drift display |
| CV generation cadence | On-demand only (UI click) | Also batch-generated in nightly cron for new T1/T2 jobs |
| ATS keyword coverage | CV keywords = whatever Sonnet chose | Post-pass injects JD-frequent missing keywords into skills section |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tier drift means "old tier vs new tier when the same job is re-scored" — and that re-scoring only happens on manual admin trigger, not automatically every night | Architecture Patterns — Pattern 3 | If drift should be detected on every nightly re-discovery, the orchestrator needs a re-score path for existing rows; the idempotency logic must change |
| A2 | Feedback multiplier step sizes (−0.05/+0.05/+0.10) and clamp range [0.75, 1.25] are appropriate for single-user use | Code Examples — Multiplier Writer | If step too large, a few rejections will collapse scores; if too small, multipliers never meaningfully shift ranking |
| A3 | ATS keyword injection should target `skillsGrouped` only (not `experience` bullets or `summary`) | Architecture Patterns — Pattern 4 | If ATS systems also scan experience bullets, injecting only into skills may under-index for some JD terms |
| A4 | Maximum 5 new T1/T2 CV generations per nightly cron run is the right cap | Common Pitfalls — Pitfall 2 | If more than 5 strong jobs arrive on a single night, some will not have CVs ready until next run or on-demand trigger |

---

## Open Questions

1. **Drift detection scope (R-80)**
   - What we know: The orchestrator skips existing jobs (idempotency). There is no re-score pass today.
   - What's unclear: Does R-80 mean (a) a job is re-scored by a new nightly run after its JD was updated, (b) a manual re-score from admin triggers a tier comparison, or (c) the nightly run should begin re-scoring existing jobs each night?
   - Recommendation: Clarify with Avi before plan. Option (b) is simplest and aligns with the "no extra LLM budget" constraint.

2. **R-79 "similar roles" definition**
   - What we know: Jobs have `industries` (from Haiku assessment) and `seniority` fields.
   - What's unclear: "Similar roles" could mean same industry, same seniority, or same tool keywords. The multiplier storage design above uses industry + seniority. Is that sufficient?
   - Recommendation: Start with industry + seniority as the similarity axes. Tool keyword dimension can be added in v2.

3. **Nightly CV generation — which tier?**
   - What we know: T1 (≥85) always gets CV+Cover. T2 (65-85) also gets CV+Cover per R-41.
   - What's unclear: Should the ATS post-pass apply to T2 CVs as well, or only T1?
   - Recommendation: Apply ATS pass to all generated CVs (T1 and T2) — cost is zero, upside is consistent keyword coverage.

---

## Environment Availability

Step 2.6: Skipped for this phase — no new external dependencies. All tools (Neon Postgres, Drizzle, Next.js, Vitest) are already live in production.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/unit/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R-78 | Breakdown rows correctly derive from `fitBreakdown` JSONB | unit | `npx vitest run tests/unit/fit-scoring.test.ts` | Partial — existing; needs extension |
| R-79 | `applyOutcome()` clamps multipliers, applies correct step | unit | `npx vitest run tests/unit/scoring-multipliers.test.ts` | No — Wave 0 |
| R-79 | `blendFitScoreWithMultipliers()` applies multipliers before blend | unit | `npx vitest run tests/unit/fit-scoring.test.ts` | Partial — extend existing |
| R-80 | Drift badge renders when `previousTier != tier` | unit | `npx vitest run tests/unit/drift.test.ts` | No — Wave 0 |
| R-84 | `atsKeywordPass()` injects missing high-frequency JD keywords | unit | `npx vitest run tests/unit/ats-keyword-pass.test.ts` | No — Wave 0 |
| R-84 | `atsKeywordPass()` does not inject keywords already present in CV | unit | same file | No — Wave 0 |
| R-84 | ATS pass returns unchanged CV when no keywords are missing | unit | same file | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/scoring-multipliers.test.ts` — covers R-79 multiplier math
- [ ] `tests/unit/ats-keyword-pass.test.ts` — covers R-84 injection logic (present/absent/no-op cases)
- [ ] `tests/unit/drift.test.ts` — covers R-80 tier comparison logic

---

## Security Domain

Security enforcement is enabled (`security_enforcement: true`, `security_asvs_level: 1`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — no new auth surfaces | — |
| V3 Session Management | No | — |
| V4 Access Control | Yes — feedback multiplier write and ATS generation are admin-only operations | `isAdmin()` check already in `updateApplicationStatus`; new nightly generation path is cron-only (CRON_SECRET auth) |
| V5 Input Validation | Yes — ATS keyword injection processes JD text (external data) | Keyword extraction must be length-limited; cap JD processing at 10,000 chars; no eval, no DOM injection |
| V6 Cryptography | No | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JD text containing malicious regex patterns | Tampering | `keywordRegex()` uses `escapeRegex()` — already present in `keywords.ts` |
| Multiplier manipulation via crafted status update | Tampering | `isAdmin()` guard on `updateApplicationStatus` already enforces single-user access |
| Cron endpoint abuse | Elevation of Privilege | `CRON_SECRET` bearer auth already on `/api/cron/nightly` |

---

## Sources

### Primary (HIGH confidence)
- `src/db/schema.ts` — all table/column shapes confirmed by direct read
- `src/lib/pipeline/orchestrator.ts` — nightly pipeline flow; confirmed CV generation is NOT called here
- `src/lib/pipeline/rank.ts` — actual `WEIGHTS` constants (`tools: 0.30`, not 0.25 as in spec)
- `src/lib/generate/cv.ts`, `cv-types.ts`, `cv-docx.ts` — CV generation flow and `skillsGrouped` injection target
- `src/app/(app)/inbox/[jobId]/page.tsx` — existing breakdown UI; confirmed `fitBreakdown` + `gapAnalysis` already rendered
- `src/app/(app)/pipeline/actions.ts` — `updateApplicationStatus` as the correct outcome hook point
- `src/lib/analytics/keywords.ts` — `keywordRegex()` and `KEYWORDS` list reusable for ATS pass
- `tests/unit/fit-scoring.test.ts` — existing test structure; multiplier tests should follow same pattern

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md R-78 through R-84 — requirements text
- ROADMAP.md Phase 13 success criteria — confirmed scope

### Tertiary (LOW confidence — assumptions flagged)
- Multiplier step sizes and clamp range — `[ASSUMED]` — no specification in requirements
- Drift detection scope interpretation — `[ASSUMED]` — requirement ambiguous on re-score trigger

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed via direct codebase read
- Architecture: HIGH — hooks, data shapes, and file locations all verified
- Pitfalls: HIGH — derived from direct code inspection of timing and weight discrepancies
- Multiplier design details: LOW — step sizes and decay are unspecified; flagged as assumed

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable stack; no fast-moving external dependencies)
