# Phase 1 PLAN — Infrastructure & Data Model

**Goal:** Next.js 16 repo scaffolded, env validation live, Drizzle schema covering all v1 tables, Neon EU provisioned with pgvector, migrations applied, admin login functional.

**Requirements satisfied:** R-01, R-02, R-03, R-06, R-07, R-08, R-10.

**Source tasks:** T1–T4 + T19 partial (admin cookie) from `docs/superpowers/plans/2026-04-14-week-1-foundation.md`.

**Dependencies:** —

## Plans (subagent-driven, dispatched in order)

| # | Plan | Depends on | Parallelizable |
|---|---|---|---|
| 1.1 | Init Next.js 16 + tooling + minimal app shell | — | no |
| 1.2 | Env validation module (zod-based) | 1.1 | no |
| 1.3 | Drizzle schema — 10 tables + pgvector extension | 1.2 | no |
| 1.4 | Provision Neon + apply migrations (Avi-assisted) | 1.3 | no |
| 1.5 | Admin auth gate (login page + cookie + layout redirect) | 1.2 | parallel with 1.4 |

## Verification (end of Phase 1)

- [ ] `npm run build` succeeds locally
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` passes (env, schema, admin-auth tests)
- [ ] `.env.local` populated with real Neon DSN, `ADMIN_SECRET`, `CRON_SECRET`
- [ ] Running `npm run db:migrate` applies all migrations against Neon cleanly
- [ ] `SELECT count(*) FROM pg_tables WHERE schemaname='public'` returns ≥ 10
- [ ] `SELECT * FROM pg_extension WHERE extname='vector'` returns a row
- [ ] `/admin/login` route renders; correct `ADMIN_SECRET` sets cookie; wrong secret returns 401

## Threat model (spec §11 + GDPR)

- `ADMIN_SECRET` never committed to git (enforced via `.gitignore` + presence check in zod loader)
- `DATABASE_URL` never logged (serverless runtime only)
- Neon region = EU (Frankfurt) — GDPR data locality

## Commit policy

Atomic commits per sub-plan. Conventional Commits. No `--no-verify`. Co-authored as Opus 4.6.
