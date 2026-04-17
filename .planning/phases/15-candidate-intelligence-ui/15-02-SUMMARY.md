---
phase: 15-candidate-intelligence-ui
plan: "02"
subsystem: candidate-intelligence-ui
tags: [interview, research-prompt, clipboard, zero-api-cost]
dependency_graph:
  requires: []
  provides: [interview-research-prompt-panel, assembleResearchPrompt]
  affects: [src/app/(app)/inbox/[jobId]/page.tsx]
tech_stack:
  added: [src/lib/interview/research-prompt.ts, src/components/job-detail/InterviewPromptPanel.tsx]
  patterns: [pure-string-builder, client-component, clipboard-api, conditional-render]
key_files:
  created:
    - tests/unit/research-prompt.test.ts
    - src/lib/interview/research-prompt.ts
    - src/components/job-detail/InterviewPromptPanel.tsx
  modified:
    - src/app/(app)/inbox/[jobId]/page.tsx
decisions:
  - "DossierLite interface defined in research-prompt.ts (not imported from types.ts) to keep the module dependency-free and testable in node environment"
  - "JD truncated server-side in assembleResearchPrompt() at 3000 chars; narrative truncated at 500 chars to keep prompt focused"
  - "InterviewPromptPanel uses useMemo to avoid re-assembling prompt on every render"
metrics:
  duration_seconds: 116
  completed_date: "2026-04-17"
  tasks_completed: 3
  files_modified: 4
requirements_satisfied: [R-86]
---

# Phase 15 Plan 02: Interview Research Prompt Panel Summary

**One-liner:** Zero-cost clipboard-ready interview research prompt assembly with pure string-builder and client component, shown only when application status is "interview".

## What Was Built

Three tasks delivered R-86: structured interview research prompt on job detail page with one-click copy, zero API cost.

**Task 1 (RED):** Created `tests/unit/research-prompt.test.ts` with 8 failing tests covering role, company name, JD content, JD truncation at 3000 chars, dossier field presence, null dossier omission of "Company context:" section, instruction block, and minimum 200-char output.

**Task 2 (GREEN):** Implemented `src/lib/interview/research-prompt.ts` — pure `assembleResearchPrompt()` with no side effects. Created `src/components/job-detail/InterviewPromptPanel.tsx` — client component with `useMemo` prompt assembly, clipboard copy via `navigator.clipboard.writeText`, 2-second "Copied!" feedback state, and textarea fallback selection. All 8 tests pass.

**Task 3:** Modified `src/app/(app)/inbox/[jobId]/page.tsx` to: (a) return `status: application?.status ?? null` from `loadDetail()`, (b) destructure `status`, (c) import `InterviewPromptPanel`, (d) conditionally render it before the "Your application" section when `status === "interview"`. Build passes clean.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (RED) | 74505c8 | test(15-02): add failing unit tests for assembleResearchPrompt() |
| 2 (GREEN) | 0285813 | feat(15-02): implement assembleResearchPrompt() and InterviewPromptPanel |
| 3 | 465f873 | feat(15-02): wire application.status and render InterviewPromptPanel on job detail page |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All data sources are wired: `job.title`, `job.jdText`, `companyName`, and `dossier` flow from the existing `loadDetail()` into the panel. No placeholder values.

## Threat Flags

None. No new network endpoints, auth paths, or file access patterns introduced. The panel is purely presentational — it reads already-loaded data and writes to the clipboard only.

## Self-Check: PASSED

- [x] `tests/unit/research-prompt.test.ts` exists
- [x] `src/lib/interview/research-prompt.ts` exists
- [x] `src/components/job-detail/InterviewPromptPanel.tsx` exists
- [x] Commits 74505c8, 0285813, 465f873 present in git log
- [x] 8/8 unit tests pass
- [x] `npx next build` completes without errors
