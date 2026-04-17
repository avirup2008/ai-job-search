---
phase: 13-smarter-scoring-ats-keyword-pass
plan: "01"
subsystem: scoring
tags: [scoring, database, drizzle, migration, multipliers, drift, orchestrator]
dependency_graph:
  requires: []
  provides:
    - previousTier column on jobs table
    - ScoringMultipliers type + applyOutcome + blendFitScoreWithMultipliers
    - readMultipliersFromProfile + writeMultipliersToProfile
    - detectDrift + DriftDescriptor
    - Nightly re-score pass with tier_drift events
  affects:
    - src/lib/pipeline/orchestrator.ts
    - src/lib/pipeline/rank.ts
    - src/db/schema.ts
tech_stack:
  added: []
  patterns:
    - Drizzle schema + drizzle-kit generate for nullable smallint column
    - Pure math multiplier module (no LLM calls) stored in profile.preferences JSONB
    - structuredClone for immutable multiplier updates
    - Furthest-from-1.0 multiplier selection when multiple industries match
key_files:
  created:
    - src/lib/scoring/multipliers.ts
    - src/lib/scoring/drift.ts
    - src/db/migrations/0003_phase13_scoring.sql
    - tests/unit/scoring-multipliers.test.ts
    - tests/unit/scoring-drift.test.ts
  modified:
    - src/db/schema.ts
    - src/lib/pipeline/orchestrator.ts
    - src/lib/pipeline/rank.ts
    - tests/unit/fit-scoring.test.ts
decisions:
  - "Multiplier clamp range locked at [0.7, 1.3] step 0.05 per plan spec (D-2 / D-5)"
  - "Re-score uses industries=[] (seniority-only bucket) because industries are not stored as a dedicated column on jobs — Plan 02 consumers should surface this gap"
  - "Multiplier selection picks the bucket furthest from 1.0 when multiple industry buckets match, preserving strongest signal"
  - "tier_drift event is skipped (not errored) when no application row exists for a job"
  - "Non-drifted jobs with fitScore delta > 0.5 still get fitScore updated silently (no event)"
metrics:
  duration_minutes: 12
  completed_date: "2026-04-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 4
---

# Phase 13 Plan 01: Schema + Scoring Primitives Summary

**One-liner:** Drizzle migration adds `previous_tier` column; pure-math multiplier module with [0.7,1.3] clamped feedback weights and nightly re-score pass emitting `tier_drift` events.

## What Was Built

### Task 1 — previous_tier column + migration

Added `previousTier: smallint("previous_tier")` (nullable) to the `jobs` pgTable in `src/db/schema.ts`. Ran `drizzle-kit generate --name phase13_scoring` which produced:

```
src/db/migrations/0003_phase13_scoring.sql
```

Migration content (exactly one ALTER TABLE):
```sql
ALTER TABLE "jobs" ADD COLUMN "previous_tier" smallint;
```

### Task 2 — Scoring primitives

**`src/lib/scoring/multipliers.ts`** exports:

| Export | Purpose |
|--------|---------|
| `ScoringMultipliers` | `{ byIndustrySeniority: Record<string, number> }` — key format: `` `${industry.toLowerCase()}|${seniority.toLowerCase()}` `` |
| `MULTIPLIER_MIN = 0.7` | Lower clamp bound |
| `MULTIPLIER_MAX = 1.3` | Upper clamp bound |
| `MULTIPLIER_STEP = 0.05` | Per-outcome step (offer = 2 steps) |
| `applyOutcome()` | Adjusts bucket multiplier; clamps at write time (T-13-01 mitigation) |
| `blendFitScoreWithMultipliers()` | Wraps `blendFitScore`, picks furthest-from-1.0 matching bucket, clamps result to [0,100] |
| `readMultipliersFromProfile()` | Type-guards all values are numbers before trusting the JSONB map |
| `writeMultipliersToProfile()` | Merges into `preferences.feedbackWeights.byIndustrySeniority`, preserves other keys |

**`src/lib/scoring/drift.ts`** exports:

| Export | Purpose |
|--------|---------|
| `DriftDescriptor` | `{ drifted, oldTier, newTier, delta }` |
| `detectDrift()` | `null` oldTier or newTier → `drifted:false`; different non-null tiers → `drifted:true, delta:newTier-oldTier` |

**Test coverage:** 40 tests across 3 files — all passing.

### Task 3 — Orchestrator wiring

`runNightly()` now:
1. Reads `ScoringMultipliers` from `profileRow.preferences` immediately after profile load.
2. After the discovery/rank/insert pass (step 6), runs a **step 7 re-score pass** over all `jobs` rows where `tier IS NOT NULL`.
3. Per row: re-computes score via `blendFitScoreWithMultipliers(fitBreakdown, multipliers, { industries: [], seniority })` (no LLM calls).
4. Computes `newTier = assignTier(newScore)`.
5. If `detectDrift(row.tier, newTier).drifted`:
   - `UPDATE jobs SET previousTier = oldTier, tier = newTier, fitScore = newScore`
   - If an application row exists: `INSERT INTO events (kind='tier_drift', payload={jobId, oldTier, newTier, delta})`
6. If not drifted but `|fitScore - newScore| > 0.5`: silently update `fitScore` only.

`RunSummary.counts` now includes:
```typescript
rescored: number;  // all ranked jobs iterated
drifted: number;   // jobs whose tier changed
```

`rank.ts` change: `const WEIGHTS` → `export const WEIGHTS` (no value changes).

## JSONB Storage Shape

Multipliers are stored at `profile.preferences.feedbackWeights.byIndustrySeniority`:

```json
{
  "feedbackWeights": {
    "byIndustrySeniority": {
      "saas|senior": 0.95,
      "fintech|mid": 1.10,
      "|senior": 1.05
    }
  }
}
```

The seniority-only fallback key (empty industry prefix, e.g. `"|senior"`) is written when `applyOutcome` is called with `jobIndustries = []`.

## Assumptions Documented in Code

**Industries not stored as a dedicated column:** The re-score pass in the orchestrator passes `industries: []` to `blendFitScoreWithMultipliers`, triggering the seniority-only fallback bucket. Industry-keyed multipliers (e.g. `"saas|senior"`) will not be applied during nightly re-scoring until a dedicated `industries` column is added to `jobs`. Plan 02 consumers should surface this gap.

This means: if a user records a rejection on a SaaS role (writing `"saas|senior": 0.95`), the nightly re-score will use `"|senior": ...` (if set) rather than the SaaS-specific bucket. The multiplier is correct for direct calls from `updateApplicationStatus` (Plan 02 wiring) which will pass real industry arrays.

## Deviations from Plan

None. Plan executed exactly as written.

- Task 1: schema + migration — match plan spec exactly.
- Task 2: multiplier constants, step table, clamp logic, drift rules — all match plan spec interfaces.
- Task 3: re-score pass, drift event, RunSummary extension — all match plan spec pseudocode.

## Known Stubs

None. All contracts are fully implemented and tested. The `industries: []` approximation in the orchestrator is documented (not a stub — the data genuinely does not exist yet in that column).

## Threat Flags

No new security surface beyond what the plan's threat model covers. T-13-01 (multiplier tampering) is mitigated by `readMultipliersFromProfile` type-guarding all JSONB values as numbers and `applyOutcome` clamping at [0.7, 1.3]. T-13-02 (DoS via re-score loop) is accepted — pure in-memory math, O(n) over <1000 rows.

## Self-Check: PASSED

All files exist and all commits are present:

| Item | Status |
|------|--------|
| src/db/schema.ts | FOUND |
| src/db/migrations/0003_phase13_scoring.sql | FOUND |
| src/lib/scoring/multipliers.ts | FOUND |
| src/lib/scoring/drift.ts | FOUND |
| tests/unit/scoring-multipliers.test.ts | FOUND |
| tests/unit/scoring-drift.test.ts | FOUND |
| commit a907a81 (Task 1 — schema + migration) | FOUND |
| commit ab20a27 (Task 2 — multipliers + drift + tests) | FOUND |
| commit d9f0c79 (Task 3 — orchestrator wiring) | FOUND |
