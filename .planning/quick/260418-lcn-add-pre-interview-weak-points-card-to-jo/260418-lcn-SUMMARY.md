---
quick_task: 260418-lcn
title: Add pre-interview weak points card to job detail page
date: 2026-04-18
commit: 6a2a074
status: complete
files_created:
  - src/components/job-detail/InterviewWeakPoints.tsx
files_modified:
  - src/components/job-detail/detail.css
  - src/app/(app)/inbox/[jobId]/page.tsx
---

# Quick Task 260418-lcn: Add pre-interview weak points card to job detail page

**One-liner:** Static weak-points prep card (5 items, amber badges, prepared framings) rendered only on interview-stage job detail pages.

## What was done

1. Created `InterviewWeakPoints.tsx` — server-compatible functional component (no client directive needed; no state/effects). Hardcodes 5 known weak points for Upashana with scripted framings. Renders only when called from the interview-stage conditional block in the page.

2. Extended `detail.css` with `.weak-points-list`, `.weak-point-item`, `.weak-point-title`, `.weak-point-index` (amber circle badge via `var(--warning)`), `.weak-point-framing`, and `.detail-section-desc` helper class.

3. Wired into `src/app/(app)/inbox/[jobId]/page.tsx` — import added, component rendered after `<InterviewBriefDownload>` inside the `status === "interview"` guard.

## Verification

- `npx tsc --noEmit` — clean, zero errors
- Committed and pushed: `6a2a074` on `main`

## Deviations

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/components/job-detail/InterviewWeakPoints.tsx` — created
- `src/components/job-detail/detail.css` — modified (CSS appended)
- `src/app/(app)/inbox/[jobId]/page.tsx` — modified (import + render)
- Commit `6a2a074` — verified in git log
