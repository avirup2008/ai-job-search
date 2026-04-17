---
phase: 14-enhanced-discovery
plan: "03"
subsystem: inbox-ui
tags: [queue-url, inbox, client-component, form, react, tdd]
dependency_graph:
  requires: [14-02]
  provides: [QueueUrlForm, inbox-queue-url-ui]
  affects: [src/app/(app)/inbox/page.tsx, src/components/inbox/]
tech_stack:
  added: []
  patterns: [client-component, exported-validation-helper, css-variable-tokens]
key_files:
  created:
    - src/components/inbox/QueueUrlForm.tsx
    - src/components/inbox/QueueUrlForm.css
    - tests/unit/components/queue-url-form.test.tsx
  modified:
    - src/app/(app)/inbox/page.tsx
    - vitest.config.ts
decisions:
  - "Exported validateQueueUrl() as a pure function so validation logic can be unit-tested in node environment without jsdom or testing-library"
  - "Used .test.tsx extension for component test; updated vitest.config.ts include pattern to match both .test.ts and .test.tsx"
  - "Pre-existing TypeScript errors in [jobId]/docs/page.tsx (next RequestInit.next type) are out of scope; TypeScript build step completes cleanly"
  - "Build fails at prerender stage due to missing DATABASE_URL in worktree environment; this is pre-existing and not caused by this plan"
metrics:
  duration: ~25min
  completed: "2026-04-17"
  tasks_completed: 2
  tasks_total: 3
  files_created: 3
  files_modified: 2
---

# Phase 14 Plan 03: QueueUrlForm Inbox UI Summary

QueueUrlForm client component mounted in inbox toolbar — lets Upashana paste any non-LinkedIn job URL and get an immediate confirmation, with client-side validation before POST to /api/queue-url.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build QueueUrlForm client component with tests | 63b1e79 | QueueUrlForm.tsx, QueueUrlForm.css, queue-url-form.test.tsx |
| fix | Restore wave-1 files after accidental soft-reset deletion | 9fcf697 | 11 files restored from 74e52d8 |
| 2 | Mount QueueUrlForm in inbox page toolbar | c0a61ec | src/app/(app)/inbox/page.tsx |

## What Was Built

### QueueUrlForm (`src/components/inbox/QueueUrlForm.tsx`)

- `"use client"` directive — renders interactively in the browser
- Exports `QueueUrlForm` (the component) and two testable primitives:
  - `validateQueueUrl(raw: string)` — pure validation function returning `{ ok: true }` or `{ ok: false, error }`
  - `LINKEDIN_MESSAGE` — canonical rejection string, shared between component and tests
- Validation order (client-side, before any network call):
  1. Empty input → "Paste a job URL first."
  2. Non-http(s) URL → "URL must start with http:// or https://"
  3. linkedin.com detected → exact LinkedIn rejection message
- On valid URL: POSTs to `/api/queue-url` with `{ url }`, disables button while pending
- Success (`ok: true, alreadyQueued: false`): green "Queued for tonight's run — tier and fit score will appear here tomorrow."
- Success (`ok: true, alreadyQueued: true`): green "This URL is already in the queue."
- Error (`ok: false`): red error with verbatim `error` field from response
- On success: clears the input

### QueueUrlForm.css (`src/components/inbox/QueueUrlForm.css`)

Uses the same CSS variable tokens as `inbox.css` (`--surface`, `--border`, `--text-1`, `--accent`, `--dur-150`). Light green success state, light red error state with matching borders.

### Tests (`tests/unit/components/queue-url-form.test.tsx`)

8 tests covering all validation paths — run in vitest node environment (no jsdom/testing-library needed) because the validation logic is exported as a pure function:

- t1: empty string → "Paste a job URL first."
- t2: whitespace-only → "Paste a job URL first."
- t3: ftp:// URL → contains "http://"
- t4: linkedin.com HTTPS → exact LINKEDIN_MESSAGE constant
- t5: linkedin.com HTTP variant → LINKEDIN_MESSAGE
- t6: valid https URL → `{ ok: true }`
- t7: valid http URL → `{ ok: true }`
- t8: LINKEDIN_MESSAGE contains canonical text

All 235 tests pass (40 test files).

### Inbox page (`src/app/(app)/inbox/page.tsx`)

Added import and mounted `<QueueUrlForm />` inside `.inbox-toolbar` after the tab-group:

```tsx
<div className="inbox-toolbar">
  <div className="tab-group" role="tablist" ...>
    {tabs.map(...)}
  </div>
  <QueueUrlForm />
</div>
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wave-1 files accidentally deleted by soft-reset**

- **Found during:** Task 1 commit
- **Issue:** `git reset --soft 74e52d8` left wave-1 file additions (14-01, 14-02 work) in the index as staged deletions; they were accidentally swept into the feat commit.
- **Fix:** Restored all 11 affected files from `74e52d8` tree in a separate fix commit (9fcf697)
- **Files modified:** 14-01-SUMMARY.md, 14-02-SUMMARY.md, route.ts, indeed-nl.ts, fixture, queue-url-scoring.test.ts, indeed-nl.test.ts, orchestrator.ts, sources/index.ts, api-routes.test.ts, registry.test.ts
- **Commit:** 9fcf697

**2. [Rule 2 - Architecture] Exported validateQueueUrl as testable pure function**

- **Found during:** Task 1 TDD setup
- **Issue:** No testing-library/jsdom available; vitest env is "node". Plan's fallback was "minimal smoke test", but that would leave validation logic untested.
- **Fix:** Extracted validation into an exported pure function `validateQueueUrl()` that can be called directly in node tests, enabling 8 real behavioral tests instead of a smoke test.
- **Files modified:** QueueUrlForm.tsx (export), queue-url-form.test.tsx (imports + uses it)

**3. [Rule 3 - Blocking] vitest.config.ts didn't include .test.tsx files**

- **Found during:** Task 1 (test file created with .tsx extension per plan)
- **Issue:** vitest include pattern was `tests/**/*.test.ts`, missing `.tsx` extension
- **Fix:** Updated include to `["tests/**/*.test.ts", "tests/**/*.test.tsx"]`
- **Files modified:** vitest.config.ts
- **Commit:** 63b1e79

## Known Stubs

None — the form posts to a real API endpoint (`/api/queue-url`) built in Plan 14-02, with no hardcoded mock data.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. The client-side LinkedIn guard (T-14-10) is implemented as defense-in-depth per the threat model; server-side enforcement remains in Plan 14-02's route.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/components/inbox/QueueUrlForm.tsx | FOUND |
| src/components/inbox/QueueUrlForm.css | FOUND |
| tests/unit/components/queue-url-form.test.tsx | FOUND |
| export function QueueUrlForm | FOUND |
| "use client" directive | FOUND |
| /api/queue-url literal | FOUND |
| LinkedIn rejection message | FOUND |
| QueueUrlForm imported in page.tsx | FOUND |
| QueueUrlForm mounted in page.tsx | FOUND |
| commit 63b1e79 (feat component) | FOUND |
| commit 9fcf697 (fix restore) | FOUND |
| commit c0a61ec (mount in page) | FOUND |
