---
phase: quick
plan: 260418-hk3
subsystem: inbox
tags: [inbox, pipeline, actions, ux]
key-files:
  modified:
    - src/app/(app)/pipeline/actions.ts
    - src/components/inbox/SaveButton.tsx
    - src/components/inbox/inbox.css
decisions:
  - Flag button uses a second independent useTransition so save and flag pending states do not bleed into each other
  - flag-btn styles added to inbox.css alongside save-btn (not globals.css) since this is inbox-scoped CSS
  - Both buttons cross-disable during either transition to prevent double-fire
metrics:
  duration: ~5min
  completed: 2026-04-18
  tasks: 2
  files: 3
---

# Quick Task 260418-hk3: Add "Not a fit" Flag Button to Inbox Job Cards

**One-liner:** Ghost "Not a fit" button added to inbox cards that upserts `status='flagged'` via a new `flagJobAsBadMatch` server action, immediately removing the card from the inbox list.

## What Was Built

### Task 1: flagJobAsBadMatch server action (`src/app/(app)/pipeline/actions.ts`)

Appended `flagJobAsBadMatch(jobId: string)` after `saveJobToPipeline`. Pattern is identical:

- `isAdmin()` guard
- SELECT existing application by `jobId`
- UPDATE `status='flagged'` + `lastEventAt` if row exists; INSERT new row with `status='flagged'` if not
- Three `revalidatePath` calls: `/pipeline`, `/inbox`, `/inbox/${jobId}`

No schema migration required — `status` is plain text.

### Task 2: Flag button in SaveButton.tsx + CSS (`src/components/inbox/SaveButton.tsx`, `inbox.css`)

Rewrote `SaveButton` to render two buttons side by side:

- `save-btn` — unchanged behaviour, existing styles
- `flag-btn` — "Not a fit" label, ghost/muted appearance, independent `useTransition`

Each button has its own `useTransition` (`isSavePending` / `isFlagPending`). Both buttons disable when either is pending to prevent double-fire.

`.flag-btn` styles added to `inbox.css` (not globals.css — inbox CSS is already inbox-scoped). Matches hover-reveal pattern of `.save-btn`: `opacity: 0.55` at rest, `opacity: 1` on `.job-card:hover`.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `2e4e46d` | feat(quick-260418-hk3): add flagJobAsBadMatch server action |
| 2 | `e76b7df` | feat(quick-260418-hk3): add Not a fit flag button to inbox job cards |

## Deviations from Plan

**1. CSS target: inbox.css instead of globals.css**

The plan said to find `.save-btn` in `globals.css` and append `.flag-btn` there. `.save-btn` actually lives in `inbox.css` (inbox-scoped). Added `.flag-btn` to the same file to keep related styles co-located. No functional difference.

**2. Hover-reveal opacity added to flag-btn**

Added `opacity: 0.55` at rest + `.job-card:hover .flag-btn { opacity: 1 }` to match the existing `.save-btn` hover-reveal pattern. Not in the plan spec but required for visual consistency with the existing design system.

## Self-Check

- `flagJobAsBadMatch` in actions.ts: FOUND (line 127)
- `Not a fit` in SaveButton.tsx: FOUND (line 32)
- `.flag-btn` in inbox.css: FOUND
- Commit `2e4e46d`: exists
- Commit `e76b7df`: exists

## Self-Check: PASSED
