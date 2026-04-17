---
phase: 13
plan: "03"
subsystem: cv-generation
tags: [ats, keyword-injection, cv, orchestrator, nightly-batch]
dependency_graph:
  requires: [13-01, 13-02]
  provides: [ats-keyword-pass, nightly-cv-batch]
  affects: [generateCV, runNightly, RunSummary]
tech_stack:
  added: []
  patterns: [pure-function-post-pass, p-limit-concurrency, drizzle-leftjoin-null-filter]
key_files:
  created:
    - src/lib/ats/keyword-pass.ts
    - tests/unit/ats-keyword-pass.test.ts
  modified:
    - src/lib/analytics/keywords.ts
    - src/lib/generate/cv.ts
    - src/lib/pipeline/orchestrator.ts
decisions:
  - "ATS pass runs after anti-AI sanitisation so injected tool names don't re-trigger mechanical-tell rules"
  - "isInSkills uses word-boundary regex (case-insensitive) to detect existing coverage — avoids injecting 'hubspot' when 'HubSpot' is already present"
  - "Nightly batch mirrors on-demand route: generateCV() -> renderCvDocx() -> storeCv() with docxBuffer"
  - "LEFT JOIN on documents with IS NULL filter selects only applications with no existing cv document"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-17"
  tasks_completed: 3
  files_changed: 5
---

# Phase 13 Plan 03: ATS Keyword Post-Pass + Nightly Batch CV Generation Summary

Pure rules-based ATS keyword injector wired into generateCV() after anti-AI sanitisation, plus nightly batch CV generation for new T1/T2 jobs (cap 5, concurrency 2).

## What Was Built

### Task 1: atsKeywordPass module

`src/lib/ats/keyword-pass.ts` exports:
- `atsKeywordPass(cv, jdText): AtsPassResult` — pure function, zero LLM calls
- `ATS_MAX_INJECT = 5` — cap on keywords injected per CV
- `ATS_MIN_JD_FREQUENCY = 2` — minimum JD occurrences to qualify
- `ATS_MAX_JD_CHARS = 10000` — character limit on JD processed

Algorithm:
1. Tokenize jdText (first 10000 chars), skip stop-words and tokens < 3 chars that don't start uppercase
2. Count frequency per lowercased token, track original casing
3. Filter to tokens with count >= 2 that are absent from skillsGrouped (word-boundary, case-insensitive)
4. Sort by frequency desc, pick top 5
5. Inject into first group matching `/skill|tool/i`; else append new "Additional Skills" group if < 5 groups; else append to last group

`escapeRegex` and `keywordRegex` were exported from `src/lib/analytics/keywords.ts` (previously unexported).

10 unit tests covering: basic injection, case-insensitive dedup, below-frequency exclusion, stop-word exclusion, cap enforcement, all-present no-op, char limit boundary, and all three group routing paths.

### Task 2: Wire into generateCV()

`src/lib/generate/cv.ts` now calls `atsKeywordPass(sanitised, job.jdText ?? "")` after `mapStrings(sanitizeMechanicalTells)` and returns `atsResult.cv`. Logs injected count and candidate count per jobId.

### Task 3: Nightly batch CV generation

`src/lib/pipeline/orchestrator.ts` step 8 (inserted before summary construction):
- Queries applications inner-joined to jobs, left-joined to documents (kind="cv"), where `tier IN (1,2)` AND `documents.id IS NULL`
- Limits to MAX_CV_PER_RUN = 5
- Generates with p-limit(CV_CONCURRENCY=2): `generateCV(jobId)` -> `renderCvDocx(gen.cv)` -> `storeCv({ applicationId, docxBuffer, tokenCostEur: gen.costEur, tier })`
- Exact storage call sequence: `renderCvDocx` produces a `Buffer`, passed as `docxBuffer` to `storeCv` which uploads to Vercel Blob and inserts a `documents` row with `kind="cv"`

## Final Shape of RunSummary.counts

```typescript
counts: {
  discovered: number;
  clusters: number;
  inserted: number;
  skipped: number;
  filtered: number;
  ranked: number;
  byTier: Record<string, number>;
  rescored: number;
  drifted: number;
  cvGenerated: number; // R-84: new field
  cvFailed: number;    // R-84: new field
}
```

## Implementation Notes

- STOP_WORDS: no adjustments needed — the provided list correctly excludes generic English words while passing tool/platform names
- ATS_MIN_JD_FREQUENCY=2 and ATS_MAX_INJECT=5 were not adjusted — thresholds proved correct in testing
- Typical CV skillsGrouped groups from the LLM are named "Core Marketing Skills", "Technical Tools", etc. — these match `/skill|tool/i` so keywords inject into the existing group rather than creating "Additional Skills". The "Additional Skills" path triggers when all groups have non-skill/tool names (e.g., "Languages", "Certifications")
- The test fixture for the "5 groups, no skill/tool match" case uses "Interpersonal" instead of "Soft Skills" because "Soft Skills" contains "Skills" and would match the regex

## Deviations from Plan

None — plan executed exactly as written. The only deviation was a test fixture adjustment (using "Interpersonal" instead of "Soft Skills" in the 5-groups routing test) which is a test correctness fix, not a plan deviation.

## Self-Check: PASSED
