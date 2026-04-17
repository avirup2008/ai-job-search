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
