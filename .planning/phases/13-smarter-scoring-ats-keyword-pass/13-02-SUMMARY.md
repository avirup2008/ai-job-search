---
phase: 13-smarter-scoring-ats-keyword-pass
plan: "02"
subsystem: scoring-ui
tags: [score-breakdown, drift-badge, feedback-multiplier, R-78, R-79, R-80]
dependency_graph:
  requires: [13-01]
  provides: [score-breakdown-ui, drift-badge-ui, feedback-multiplier-hook]
  affects: [inbox, job-detail, pipeline-actions, profile-preferences]
tech_stack:
  added: []
  patterns: [server-component, drizzle-select-chain, vitest-mock-chain]
key_files:
  created:
    - src/components/job-detail/ScoreBreakdown.tsx
    - tests/unit/feedback-hook.test.ts
  modified:
    - src/app/(app)/inbox/[jobId]/page.tsx
    - src/components/job-detail/detail.css
    - src/app/(app)/inbox/page.tsx
    - src/components/inbox/JobCard.tsx
    - src/components/inbox/inbox.css
    - src/app/(app)/pipeline/actions.ts
decisions:
  - "Drift badge placed inside JobCard (not inbox/page.tsx directly) so previousTier flows through JobCardData interface"
  - "Badge uses wrapper div with flexbox rather than inline-flex on score span to avoid breaking existing mono font layout"
  - "Feedback hook silently catches errors so a multiplier DB failure never breaks the status update user action"
  - "Unit tests reconstruct expected multiplier values via applyOutcome directly (avoids brittle DB mock argument capture)"
metrics:
  duration_minutes: 4
  completed_date: "2026-04-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 6
---

# Phase 13 Plan 02: Score Breakdown UI, Drift Badges, Feedback Multiplier Hook Summary

**One-liner:** Server-rendered ScoreBreakdown bar chart with weight annotations, T-tier drift badges in the inbox, and a feedback multiplier hook that persists rejected/interview/offer outcomes to profile.preferences JSONB.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ScoreBreakdown component + wire into job detail | 97a6ca0 | ScoreBreakdown.tsx, [jobId]/page.tsx, detail.css |
| 2 | Drift badge in triage inbox list | 86bcb84 | JobCard.tsx, inbox/page.tsx, inbox.css |
| 3 | Feedback multiplier hook + unit tests | 4bb6437 | pipeline/actions.ts, feedback-hook.test.ts |

## Drift Badge JSX Shape

File: `src/components/inbox/JobCard.tsx` (lines ~42-52 in the updated file)

```tsx
{job.previousTier != null && job.previousTier !== job.tier && (
  <span
    className="drift-badge"
    data-direction={job.previousTier > (job.tier ?? 0) ? "up" : "down"}
    title="Score drift detected on last nightly run"
  >
    T{job.previousTier} &rarr; T{job.tier}
  </span>
)}
```

`data-direction="up"` = improved (lower tier number = better), `"down"` = regressed. CSS in `src/components/inbox/inbox.css`.

## profile.preferences.feedbackWeights JSONB Structure

After a "rejected" outcome on a SaaS/B2B senior role, the profile preferences column contains:

```json
{
  "feedbackWeights": {
    "byIndustrySeniority": {
      "saas|senior": 0.95,
      "b2b|senior": 0.95
    }
  }
}
```

Key format: `${industry.toLowerCase()}|${seniority.toLowerCase()}`. Steps: rejected = -0.05, interview = +0.05, offer = +0.10. Clamped to [0.7, 1.3]. All other top-level preference keys are preserved via spread.

## CSS Files Touched

- `src/components/job-detail/detail.css` — appended `.score-breakdown*` and `.score-fields-*` classes for the ScoreBreakdown component
- `src/components/inbox/inbox.css` — appended `.drift-badge` with `data-direction` variants (up = green, down = amber)
- No new CSS modules created; both appended to existing files already imported by their respective pages

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired from live DB columns (`fitBreakdown`, `gapAnalysis`, `previousTier`, `tier`).

## Self-Check: PASSED

- `src/components/job-detail/ScoreBreakdown.tsx` — exists, exports `ScoreBreakdown`, imports `WEIGHTS` from `@/lib/pipeline/rank`
- `src/app/(app)/inbox/[jobId]/page.tsx` — imports and renders `<ScoreBreakdown ...>`, no `breakdownRows`/`bandOf` identifiers remain
- `src/app/(app)/inbox/page.tsx` — selects `previousTier: schema.jobs.previousTier`
- `src/components/inbox/JobCard.tsx` — renders `.drift-badge` when `previousTier != null && previousTier !== tier`
- `src/app/(app)/pipeline/actions.ts` — contains `applyOutcome`, `writeMultipliersToProfile`
- `tests/unit/feedback-hook.test.ts` — 3/3 tests pass
- `npx tsc --noEmit` — exits 0
- `npx vitest run` — 209/209 tests pass, 0 regressions
