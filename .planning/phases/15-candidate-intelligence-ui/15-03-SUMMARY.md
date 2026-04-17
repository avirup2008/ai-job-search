---
phase: 15-candidate-intelligence-ui
plan: "03"
subsystem: candidate-intelligence-ui
tags: [pdf-generation, interview, download, pdf-lib]
dependency_graph:
  requires: ["15-02"]
  provides: ["/api/interview-brief/[jobId]", "InterviewBriefDownload", "buildInterviewBriefPdf"]
  affects: ["src/app/(app)/inbox/[jobId]/page.tsx"]
tech_stack:
  added: ["pdf-lib@^1.17.1"]
  patterns: ["Node.js PDF generation", "pdf-lib PDFDocument", "Next.js App Router route handler"]
key_files:
  created:
    - src/lib/interview/pdf-brief.ts
    - src/app/api/interview-brief/[jobId]/route.ts
    - src/components/job-detail/InterviewBriefDownload.tsx
    - tests/unit/pdf-brief.test.ts
  modified:
    - package.json
    - package-lock.json
    - src/app/(app)/inbox/[jobId]/page.tsx
decisions:
  - "Used pdf-lib (pure JS, no headless Chrome) over @react-pdf/renderer — simpler API, smaller bundle, sufficient for markdown-to-PDF formatting"
  - "Bullet symbol rendered as unicode U+2022 rather than ASCII dash to avoid pdf-lib rendering artifacts"
  - "No observability instrumentation added to route — consistent with existing download-pack route pattern in this project"
metrics:
  duration_minutes: 12
  completed_date: "2026-04-17"
  tasks_completed: 4
  tasks_total: 4
  files_created: 4
  files_modified: 3
---

# Phase 15 Plan 03: Pre-interview Brief PDF Download Summary

**One-liner:** One-click PDF download combining interview-prep markdown and company dossier using pdf-lib, gated on application status="interview" with zero new LLM calls.

## What Was Built

R-89 satisfied: Upashana can download a formatted PDF briefing document from any job detail page where the application status is "interview". The PDF combines the existing interview-prep markdown (stored in Vercel Blob) and the company dossier (from `companies.researchJson`) into a structured multi-section document. No new LLM generation occurs.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 59c8a61 | chore(15-03): install pdf-lib dependency |
| 2 | 5426ff6 | feat(15-03): implement buildInterviewBriefPdf() with unit tests |
| 3 | 2725f86 | feat(15-03): create GET /api/interview-brief/[jobId] route |
| 4 | 4fe7b21 | feat(15-03): add InterviewBriefDownload button to job detail page |

## Task Summary

**Task 1 — pdf-lib installation:** `pdf-lib@^1.17.1` added to dependencies. Verified importable via `node -e "require('pdf-lib').PDFDocument"`.

**Task 2 — buildInterviewBriefPdf() (TDD):** Pure async function in `src/lib/interview/pdf-brief.ts`. Accepts `{ title, companyName, prepMarkdown, dossier }`, returns `Promise<Uint8Array>` of valid PDF bytes. Features: word-wrap at 90 chars, automatic page overflow, markdown rendering (h1/h2 headers, bullets, blank line spacing), null-safe dossier and prepMarkdown handling. 4 unit tests: %PDF magic bytes, null dossier, empty markdown, size ordering — all pass.

**Task 3 — API route:** `GET /api/interview-brief/[jobId]` with `runtime="nodejs"`, `maxDuration=30`. Returns 404 for missing job, missing application, or missing interview-prep document. Fetches markdown from Vercel Blob, builds PDF via `buildInterviewBriefPdf`, returns `application/pdf` with `Content-Disposition: attachment` and slugified filename `disha-interview-brief-{company}-{title}.pdf`.

**Task 4 — Download button:** `InterviewBriefDownload` server-safe component renders a `<section>` with an anchor `download` link pointing to `/api/interview-brief/${jobId}`. Mounted in `inbox/[jobId]/page.tsx` immediately after `InterviewPromptPanel`, both gated on `status === "interview"`.

## Verification

- `npx vitest run tests/unit/pdf-brief.test.ts` — 4/4 tests pass
- `npx next build` — compiles cleanly, `/api/interview-brief/[jobId]` appears in build output
- Zero LLM calls in route: no `generateCV`, `anthropic`, `complete`, or `structured` references in route file

## Deviations from Plan

None — plan executed exactly as written. The observability suggestion from the Vercel plugin was noted but deferred: existing routes in this project (download-pack) follow the same no-logging pattern and this is a personal project without production monitoring requirements.

## Known Stubs

None. The download button links to a real API route; the route fetches real data from the database and Vercel Blob. No placeholder data.

## Threat Flags

None. The new API route is authenticated via the existing middleware (all `/api/*` routes in this project require session). The route reads from Vercel Blob using the stored URL (no user-supplied URL). The `jobId` parameter is used only in Drizzle parameterized queries (no SQL injection surface).

## Self-Check: PASSED

All 4 created files confirmed present on disk. All 4 task commits (59c8a61, 5426ff6, 2725f86, 4fe7b21) confirmed in git log.
