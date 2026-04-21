# Pipeline Reliability + Keyword Expansion — Design Spec

**Date:** 2026-04-21
**Milestone:** v3.0 — More jobs, fewer silent failures
**Status:** Approved

---

## Problem

The nightly pipeline delivers ~2 new ranked jobs per run. Root cause is two compounding issues:

1. **Silent timeouts:** Apify-backed sources (LinkedIn, Indeed) can hang for 60s+. `discover.ts` has no per-source deadline, so one slow source burns the 300s Vercel budget before ranking even starts. The run row is never updated — it stays `running` forever. Evidence: 6 of the last 7 runs stuck at `running`.

2. **Stale and incomplete keywords:** Each source hardcodes its own keyword list. Lists are inconsistent across sources, include `"paid media"` (a role family Upashana explicitly doesn't want), and are missing several high-value terms (`"campaign manager"`, `"marketing operations"`, `"CRM specialist"`, `"marketing coordinator"`, `"demand generation"`).

---

## Design

### Part 1 — Per-source timeout in `discover.ts`

Wrap each source's `fetch()` call in a `Promise.race` against a 45-second deadline. If the source doesn't respond in time, it resolves to `[]` (same as an error today) and the run continues with the remaining sources.

```
Promise.race([
  source.fetch(),
  new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), SOURCE_TIMEOUT_MS))
])
```

- `SOURCE_TIMEOUT_MS = 45_000` — gives each source 45s; with 7 sources in parallel, discovery completes in ≤60s worst case, leaving 240s for deduplication, ranking, and persistence.
- Timeout failures are recorded in `errors[source.name]` like any other error — no change to the error isolation contract.
- The orchestrator's existing try/catch + finally already marks the run row `"failed"` if `runNightly` throws — no change needed there.

**Files touched:** `src/lib/pipeline/discover.ts` only.

---

### Part 2 — Centralised keyword list

Create `src/lib/sources/keywords.ts` as the single source of truth for all search terms. Every source imports from it instead of maintaining its own array.

**New canonical keyword list:**

```typescript
export const SEARCH_KEYWORDS = [
  "marketing automation",
  "marketing operations",
  "CRM marketing",
  "CRM specialist",
  "email marketing",
  "campaign manager",
  "marketing coordinator",
  "marketing specialist",
  "HubSpot",
  "digital marketing",
  "growth marketing",
  "demand generation",
] as const;

export type SearchKeyword = (typeof SEARCH_KEYWORDS)[number];
```

**Changes vs. current state:**
- ❌ Removed: `"paid media"` (was Adzuna-only) — Upashana doesn't want these roles
- ❌ Removed: `"marketing manager"` (was Adzuna-only) — too broad, low precision
- ✅ Added: `"marketing operations"` — was WTTJ-only, now all sources
- ✅ Added: `"CRM specialist"` — direct profile match, was missing everywhere
- ✅ Added: `"campaign manager"` — was WTTJ-only, now all sources
- ✅ Added: `"marketing coordinator"` — adjacent roles worth scoring
- ✅ Added: `"marketing specialist"` — broad but filtered precisely by LLM scorer
- ✅ Added: `"demand generation"` — high overlap with HubSpot/email marketing skill set

All 5 free sources (Adzuna, Jooble, Magnet.me, NVB, WTTJ) replace their local `KEYWORDS` constant with `import { SEARCH_KEYWORDS } from "./keywords"`. The two Apify sources (ApifyIndeed, ApifyLinkedIn) pass keywords as actor input — they are updated to use the same shared list.

**Files touched:**
- Create: `src/lib/sources/keywords.ts`
- Modify: `src/lib/sources/adzuna.ts`
- Modify: `src/lib/sources/jooble.ts`
- Modify: `src/lib/sources/magnetme.ts`
- Modify: `src/lib/sources/nvb.ts`
- Modify: `src/lib/sources/wttj.ts`
- Modify: `src/lib/sources/apify-indeed.ts`
- Modify: `src/lib/sources/apify-linkedin.ts`

---

## Expected outcome

| Metric | Before | After (estimated) |
|--------|--------|-------------------|
| Runs completing successfully | ~1/7 | ~7/7 |
| New ranked jobs per run | ~2 | 8–15 |
| T1+T2 jobs per week | ~5 | 20–40 |
| Stuck `running` runs | 6+ | 0 |

---

## Constraints

- No new paid APIs or API keys
- No Apify for new sources (Apify already used for LinkedIn + Indeed only)
- Must stay within 300s Vercel function limit — 45s per-source timeout is the budget control
- No change to scoring, tier thresholds, or hard filters

---

## Out of scope

- Adding new sources (Undutchables — to be discussed after v3 ships)
- Changing hard filter logic (Dutch-language detection, location filters)
- Changing tier thresholds or scoring weights
- CV generation in nightly run (already disabled)
