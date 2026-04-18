---
phase: quick-260418-l5c
plan: 01
subsystem: pipeline
tags: [scoring, soft-penalty, avoid-patterns, orchestrator]
tech-stack:
  added: []
  patterns: [pure-function-module, additive-gapAnalysis-fields]
key-files:
  created:
    - src/lib/pipeline/avoid-patterns.ts
  modified:
    - src/lib/pipeline/orchestrator.ts
decisions:
  - Agency penalty is 10 points (not 15) — matches plan spec for agency vs brand/content/industrial
  - Pattern checks ordered brand-manager → content-only → industrial-B2B → agency; first match wins
  - Re-score path uses title-only (empty jdText string) — JD not stored in re-score select
metrics:
  duration: ~6 minutes
  completed: 2026-04-18
  tasks_completed: 3
  files_modified: 2
---

# Quick 260418-l5c: Add Roles-to-Avoid Soft Penalty to Job Scoring

**One-liner:** Soft-penalty scoring module (`applyAvoidPenalty`) wired into all 3 orchestrator scoring paths — brand manager / content-only / industrial B2B / agency roles penalized 10–15 points with visible reason in `gapAnalysis`.

## What Was Built

### `src/lib/pipeline/avoid-patterns.ts` (new)

Pure function `applyAvoidPenalty(title, jdText)` returns `{ penalty, reason }`. Four pattern groups:

| Group | Check scope | Penalty |
|---|---|---|
| BRAND_MANAGER_PATTERNS | title only | -15 |
| CONTENT_ONLY_PATTERNS | title only | -15 |
| INDUSTRIAL_B2B_PATTERNS | title + first 4000 chars of JD | -15 |
| AGENCY_PATTERNS | title + first 4000 chars of JD | -10 |

First match wins. Returns `{ penalty: 0, reason: null }` when no pattern matches.

### `src/lib/pipeline/orchestrator.ts` (modified)

Three scoring paths updated:

- **Path A (queued url_paste):** `applyAvoidPenalty(row.title, row.jdText ?? "")` after LLM rank; `finalFitScore = max(0, rank.fitScore - penalty)`; penalized score used for `assignTier` and `fitScore` DB write; `gapAnalysis.penaltyReason` added; reason appended to `gaps` array.
- **Path B (new-job rank):** Same pattern applied after LLM rank in `toRank.map` loop.
- **Path C (re-score):** `title` added to `existingRanked` select; `applyAvoidPenalty(row.title, "")` applied after `blendFitScoreWithMultipliers`; `finalNewScore` used for tier assignment, drift comparison, and both DB update paths.

## Commits

| Hash | Message |
|---|---|
| c378528 | feat: soft-penalty scoring for roles-to-avoid — brand manager, content-only, industrial B2B, agency roles |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/lib/pipeline/avoid-patterns.ts` exists and exports `applyAvoidPenalty` and `AvoidPenaltyResult`
- `src/lib/pipeline/orchestrator.ts` imports `applyAvoidPenalty` and applies it in all 3 paths
- `npx tsc --noEmit` passes (no output = clean)
- Commit c378528 exists on branch
