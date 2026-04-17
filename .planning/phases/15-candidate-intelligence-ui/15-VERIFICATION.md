---
phase: 15-candidate-intelligence-ui
verified: 2026-04-17T22:17:45Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /gap-coach in the running app"
    expected: "T2 jobs appear ranked by fitScore descending; each row shows title, company, NN% fit score, −N pts to T1 delta, and gap strings from gapAnalysis.gaps; clicking a row navigates to /inbox/[jobId]"
    why_human: "Requires live DB with T2 job records; server component rendering cannot be verified statically"
  - test: "Open a job detail page whose application.status is 'interview'"
    expected: "Interview research prompt panel appears with a textarea containing the assembled prompt and a Copy button; clicking Copy writes the prompt to the clipboard and toggles 'Copied!' for 2 seconds; panel is absent on non-interview jobs"
    why_human: "Clipboard API and status-gated conditional render require a live browser session"
  - test: "Click 'Download interview brief (PDF)' on an interview-status job detail page"
    expected: "Browser downloads a file named disha-interview-brief-{company}-{title}.pdf; opening the file shows a formatted PDF with title page, Company dossier section, and Interview prep section"
    why_human: "PDF download requires live DB data (interview-prep document in blobUrlDocx) and a running server"
  - test: "Request /api/interview-brief/{non-existent-uuid} directly"
    expected: "Response is 404 JSON with an error field"
    why_human: "API route behavior requires a running Next.js server"
---

# Phase 15: Candidate Intelligence UI — Verification Report

**Phase Goal:** Upashana can see exactly what is holding T2 jobs back from T1, get a structured research prompt for any interview at zero API cost, and download a pre-interview PDF brief from the job detail view.
**Verified:** 2026-04-17T22:17:45Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Gap Coach panel lists T2 jobs ranked by closeness-to-T1 with specific blocking keywords | ✓ VERIFIED | `page.tsx` queries `eq(schema.jobs.tier, 2)` + `desc(schema.jobs.fitScore)`; `GapCoachList` renders `gapAnalysis.gaps` per row as "What's holding this back" list |
| 2 | When application status is "interview", a structured research prompt appears with one-click copy, zero API cost | ✓ VERIFIED | `loadDetail()` returns `status: application?.status ?? null`; `InterviewPromptPanel` gated on `status === "interview"`; `assembleResearchPrompt` is a pure string builder with no fetch/LLM calls; `navigator.clipboard.writeText` wired in client component |
| 3 | From an interview-status job, user can download a single formatted PDF combining interview prep + company dossier, no new generation | ✓ VERIFIED | `InterviewBriefDownload` gated on `status === "interview"`; anchor links to `/api/interview-brief/${jobId}`; route fetches existing `blobUrlDocx`, calls `buildInterviewBriefPdf`, returns `application/pdf` with `Content-Disposition: attachment`; no LLM call in route |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(app)/gap-coach/page.tsx` | Gap Coach server-component page | ✓ VERIFIED | Exists; contains `eq(schema.jobs.tier, 2)` (line 23) and `desc(schema.jobs.fitScore)` (line 24); default async export present |
| `src/components/gap-coach/GapCoachList.tsx` | List renderer with gap details | ✓ VERIFIED | Exports `shapeGapCoachRow`, `sortGapCoachRows`, `GapCoachList`; no `"use client"` |
| `src/components/app-shell/TopBar.tsx` | Nav link to /gap-coach | ✓ VERIFIED | `{ href: "/gap-coach", label: "Gap Coach" }` at line 10, between Inbox and Pipeline; NAV has exactly 5 entries |
| `tests/unit/gap-coach.test.ts` | 6 unit tests for gap-coach data shaping | ✓ VERIFIED | 6 `it()` blocks; all pass (6/6 green) |
| `src/lib/interview/research-prompt.ts` | Pure `assembleResearchPrompt()` string builder | ✓ VERIFIED | Exports `assembleResearchPrompt`; no fetch/side effects; JD_LIMIT = 3000; NARRATIVE_LIMIT = 500 |
| `src/components/job-detail/InterviewPromptPanel.tsx` | Client component with Copy button | ✓ VERIFIED | `"use client"` on line 1; imports `assembleResearchPrompt`; contains `navigator.clipboard.writeText`; no `fetch(` or `"use server"` |
| `src/app/(app)/inbox/[jobId]/page.tsx` | Exposes application.status; renders panels conditionally | ✓ VERIFIED | `status: application?.status ?? null` at line 65; two `status === "interview"` guards (lines 149, 158); both `InterviewPromptPanel` and `InterviewBriefDownload` imported and conditionally rendered |
| `tests/unit/research-prompt.test.ts` | 8 unit tests for prompt assembly | ✓ VERIFIED | 8 `it()` blocks; all pass (8/8 green) |
| `package.json` | pdf-lib dependency | ✓ VERIFIED | `"pdf-lib": "^1.17.1"` in dependencies |
| `src/lib/interview/pdf-brief.ts` | Pure `buildInterviewBriefPdf()` returning Uint8Array | ✓ VERIFIED | Exports `buildInterviewBriefPdf`; imports `PDFDocument`, `StandardFonts` from `pdf-lib`; contains `wrapLine` word-wrap function; `addPage` for overflow; no network calls |
| `src/app/api/interview-brief/[jobId]/route.ts` | GET endpoint producing PDF | ✓ VERIFIED | `runtime = "nodejs"`; `maxDuration = 30`; exports `GET`; `"Content-Type": "application/pdf"`; `Content-Disposition: attachment`; 3x status 404 returns; imports `buildInterviewBriefPdf` |
| `src/components/job-detail/InterviewBriefDownload.tsx` | Download button component | ✓ VERIFIED | Anchor with `href="/api/interview-brief/${jobId}"` and `download` attribute |
| `tests/unit/pdf-brief.test.ts` | 4 unit tests for PDF builder | ✓ VERIFIED | 4 `it()` blocks; all pass (4/4 green) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TopBar.tsx` | `/gap-coach` | `href: "/gap-coach"` in NAV array | ✓ WIRED | Confirmed at line 10 of TopBar.tsx |
| `gap-coach/page.tsx` | `schema.jobs` + `schema.companies` | drizzle select with leftJoin, where tier=2, orderBy fitScore desc | ✓ WIRED | `eq(schema.jobs.tier, 2)` line 23, `desc(schema.jobs.fitScore)` line 24 |
| `inbox/[jobId]/page.tsx` | `InterviewPromptPanel` | `status === "interview"` conditional | ✓ WIRED | Lines 149–156; import at line 8 |
| `InterviewPromptPanel.tsx` | `research-prompt.ts` | import `assembleResearchPrompt` | ✓ WIRED | Line 4 of InterviewPromptPanel.tsx |
| `route.ts` | `pdf-brief.ts` | import `buildInterviewBriefPdf` | ✓ WIRED | Line 4 of route.ts |
| `route.ts` | `documents.blobUrlDocx` (kind=interview-prep) | drizzle select + `fetch(blobUrl).text()` | ✓ WIRED | `eq(schema.documents.kind, "interview-prep")` in route; `fetch(prepDoc.blobUrlDocx)` at line 75 |
| `InterviewBriefDownload.tsx` | `/api/interview-brief/[jobId]` | anchor href | ✓ WIRED | `href="/api/interview-brief/${jobId}"` with `download` attribute |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `GapCoachList.tsx` | `rows` (GapCoachRow[]) | Drizzle select from `schema.jobs` where tier=2 in page.tsx | Yes — live DB query, no hardcoded returns | ✓ FLOWING |
| `InterviewPromptPanel.tsx` | `prompt` via `assembleResearchPrompt` | `job.title`, `companyName`, `job.jdText`, `dossier` passed as props from `loadDetail()` in page.tsx | Yes — all props sourced from live DB load | ✓ FLOWING |
| `InterviewBriefDownload.tsx` | `jobId` (prop) | Destructured from `params` in page.tsx; anchor href passes to real API route | Yes — real route with DB + blob fetch | ✓ FLOWING |
| `route.ts` (`/api/interview-brief`) | `pdfBytes` from `buildInterviewBriefPdf` | DB: jobs, companies, applications, documents; blob: `fetch(prepDoc.blobUrlDocx)` | Yes — live DB queries; blob URL fetched at runtime | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `assembleResearchPrompt` pure function | vitest: 8 tests | 8/8 pass | ✓ PASS |
| `shapeGapCoachRow` + `sortGapCoachRows` | vitest: 6 tests | 6/6 pass | ✓ PASS |
| `buildInterviewBriefPdf` PDF bytes | vitest: 4 tests | 4/4 pass; %PDF magic bytes confirmed | ✓ PASS |
| Live route / browser rendering | Requires running server | Cannot verify statically | ? SKIP (routed to human) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R-85 | 15-01-PLAN.md | Profile Gap Coach: T2 jobs ranked by closeness-to-T1, specific blocking keywords shown | ✓ SATISFIED | `/gap-coach` route exists; queries tier=2 jobs ordered by fitScore desc; `gapAnalysis.gaps` rendered per row; nav link present |
| R-86 | 15-02-PLAN.md | Interview research prompt with one-click copy, zero API cost | ✓ SATISFIED | `assembleResearchPrompt` is pure (no network); `InterviewPromptPanel` uses clipboard API; panel gated on `status === "interview"` |
| R-89 | 15-03-PLAN.md | Pre-interview PDF brief (formatting only, no new generation) | ✓ SATISFIED | `buildInterviewBriefPdf` is pure (verified by tests); API route confirmed: no LLM/generation imports; `Content-Disposition: attachment` with pdf MIME type |

No orphaned requirements: REQUIREMENTS.md maps R-85, R-86, R-89 to Phase 15, and all three are claimed by plans 15-01, 15-02, 15-03 respectively.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/api/interview-brief/[jobId]/route.ts` | 78 | Comment: `// leave empty — PDF builder will insert placeholder` | ℹ️ Info | Not a stub — this is a code comment documenting the intended fallback behavior when the Vercel Blob fetch fails; `prepMarkdown` is left as empty string and `buildInterviewBriefPdf` renders "Interview prep document not yet generated." — real behavior, not a missing implementation |

No blocking anti-patterns found. No placeholder return values, no TODO/FIXME in implementation paths, no hardcoded empty data structures that flow to rendering.

### Human Verification Required

#### 1. Gap Coach Page — Live Data Rendering

**Test:** Navigate to `/gap-coach` in the running app with a seeded database containing T2 jobs (tier=2, fitScore in 65–84 range, gapAnalysis.gaps populated).
**Expected:** Jobs appear in fitScore descending order. Each row shows: company avatar, job title, company name, NN% fit score, "−N pts to T1" delta, and a "What's holding this back" list of gap strings. Empty state message appears when no T2 jobs exist. Clicking a row navigates to `/inbox/[jobId]`.
**Why human:** Requires live Neon DB with T2 job records. Server component rendering cannot be verified statically.

#### 2. Interview Research Prompt Panel — Status Gate and Clipboard

**Test:** Open two job detail pages — one where the application status is "interview" and one where it is not.
**Expected:** Panel with textarea and "Copy prompt" button appears only on the interview-status job. Clicking "Copy prompt" writes the full assembled prompt to the system clipboard and button label changes to "Copied!" for ~2 seconds, then reverts.
**Why human:** Clipboard API (`navigator.clipboard.writeText`) requires a browser context. Status-gated conditional render requires live DB data.

#### 3. PDF Download — File Integrity

**Test:** On a job with application status="interview" and an existing interview-prep document, click "Download interview brief (PDF)".
**Expected:** Browser downloads a file named `disha-interview-brief-{company-slug}-{title-slug}.pdf`. Opening the file shows: a title page with role and company name, a "Company dossier" section (if researchJson present), and an "Interview prep" section with the formatted markdown content.
**Why human:** Full end-to-end flow requires live DB, Vercel Blob URL for interview-prep document, and a running Next.js server with pdf-lib bundled.

#### 4. PDF Route 404 Guards

**Test:** Directly request `/api/interview-brief/{non-existent-uuid}` and `/api/interview-brief/{valid-job-id-with-no-application}`.
**Expected:** Both return 404 JSON responses with a descriptive error field.
**Why human:** Requires running server; cannot execute API route handlers statically.

### Gaps Summary

No gaps found. All 3/3 must-haves are verified at the code level. All 18 unit tests pass (6 gap-coach + 8 research-prompt + 4 pdf-brief). All key links are wired. All required artifacts exist and are substantive. No stub implementations detected.

Four human verification items remain for behaviors that require a live browser session and populated database — these are standard for a UI phase and do not indicate any implementation deficiency.

---

_Verified: 2026-04-17T22:17:45Z_
_Verifier: Claude (gsd-verifier)_
