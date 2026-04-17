---
phase: quick
plan: 260417-kqy
subsystem: auth
tags: [auth, login, middleware, cookie, security]
dependency_graph:
  requires: []
  provides: [disha_session cookie auth, login page, logout route]
  affects: [src/middleware.ts, src/app/page.tsx, src/components/app-shell/TopBar.tsx]
tech_stack:
  added: []
  patterns: [sha256 cookie auth, Web Crypto Edge middleware, Node crypto timingSafeEqual]
key_files:
  created:
    - src/app/page.tsx
    - src/app/api/auth/login/route.ts
    - src/app/api/auth/logout/route.ts
  modified:
    - src/middleware.ts
    - src/components/app-shell/TopBar.tsx
decisions:
  - "Keep middleware.ts filename — Next.js 16 supports both middleware.ts and proxy.ts; existing convention retained"
  - "secure cookie flag gated on NODE_ENV=production to allow local dev without HTTPS"
metrics:
  duration_minutes: 15
  completed_date: "2026-04-17"
  tasks_completed: 3
  files_modified: 5
---

# Quick Task 260417-kqy: Disha Login Page Summary

**One-liner:** Single-password auth gate using sha256 cookie with shake-on-error login card and middleware rewrite from aijs_admin to disha_session.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Auth API routes — /api/auth/login and /api/auth/logout | bd47cf2 | src/app/api/auth/login/route.ts, src/app/api/auth/logout/route.ts |
| 2 | Login page at / and middleware rewrite | a10697f | src/app/page.tsx, src/middleware.ts |
| 3 | Sign out button in TopBar | c430e50 | src/components/app-shell/TopBar.tsx |

## What Was Built

**Login page (`/`):** Full-viewport centred card with Cormorant Garamond "Disha" heading, "Job search, handled." subtitle, password input, Enter button. Wrong password triggers a CSS keyframe shake (`disha-shake`) and red error text. Input clears on failure. Success redirects to `/inbox` via `window.location.href`.

**`/api/auth/login` (Node.js runtime):** Reads `DISHA_PASSWORD` env var; returns 503 if absent. Computes sha256 of both expected and submitted passwords, compares with `timingSafeEqual` (prevents timing oracle). On match: sets `disha_session` cookie (httpOnly, sameSite=lax, maxAge 30 days, secure in production). Returns 401 on mismatch.

**`/api/auth/logout` (Node.js runtime):** Deletes `disha_session` cookie (maxAge=0), redirects to `/`.

**`src/middleware.ts` (Edge runtime):** Full rewrite. Switched from `aijs_admin`/`ADMIN_SECRET` plain-string compare to `disha_session`/`DISHA_PASSWORD` sha256 compare using Web Crypto (`crypto.subtle.digest`). Fails closed if env var absent. Unauthenticated page routes now redirect to `/` (not `/admin/login`). Matcher unchanged.

**TopBar:** Added `handleSignOut` async function + "Sign out" ghost button after "+ Paste a role". Clicking POSTs to `/api/auth/logout` and redirects to `/`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — all surfaces were in the plan's threat model.

## Self-Check: PASSED

- src/app/api/auth/login/route.ts: FOUND
- src/app/api/auth/logout/route.ts: FOUND
- src/app/page.tsx: FOUND
- src/middleware.ts: FOUND (updated)
- src/components/app-shell/TopBar.tsx: FOUND (updated)
- Commits bd47cf2, a10697f, c430e50: all present in git log
- `npx tsc --noEmit`: zero errors

---

## Update — 2026-04-17: Polished login page as app home

**One-liner:** Root `/` now renders the full Today aesthetic with live DB data plus an embedded password login card; authenticated users redirect to `/inbox`; Today nav entry removed.

### Additional tasks completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add LoginCard component | f5fbced | src/components/login/LoginCard.tsx |
| 2 | Rewrite root page as server component with live DB data | df0233e | src/app/page.tsx |
| 3 | Replace today page with redirect to /inbox | cd1b3f1 | src/app/(app)/page.tsx |
| 4 | Remove Today from TopBar nav, simplify active logic | 47ad093 | src/components/app-shell/TopBar.tsx |

### What was built

**`LoginCard` (`src/components/login/LoginCard.tsx`):** Client component with inline scoped styles — shake animation on wrong password, focus ring, error state border, disabled button state. Posts to `/api/auth/login`, navigates to `/inbox` on success.

**Root page (`src/app/page.tsx`):** Converted to async Server Component. Auth check via `crypto.timingSafeEqual` against `disha_session` cookie — redirects to `/inbox` if already logged in. Live DB queries: featured job, strong match count, new-today count, total inbox count. Full Today aesthetic (floating SVGs, growth curve, greeting, featured job card dimmed pre-login, KPI pills dimmed pre-login) with `LoginCard` embedded. `.home` wrapper overridden to `min-height: 100vh` since there is no app shell on the login page.

**Today page (`src/app/(app)/page.tsx`):** Replaced with 3-line redirect to `/inbox`. Route is unreachable from nav and auto-redirects if hit directly.

**TopBar:** Removed `{ href: "/", label: "Today" }` entry. Simplified active-link condition — dead `item.href === "/"` branch removed.

### Deviations

- Simplified the TopBar `active` condition as a bonus cleanup (dead branch). No behavior change.

### Verification

- `npx tsc --noEmit`: zero errors
- `git push origin main`: succeeded at 47ad093
