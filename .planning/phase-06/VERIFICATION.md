# Phase 6 — Week-1 Deploy & Acceptance

**Status:** ✅ COMPLETE — 2026-04-15

Phase 6 is a checkpoint phase, not new code. It verifies Week 1 (Phases 1-5) delivered what the spec promised before moving into the generation half of the project.

## Week 1 acceptance checklist (spec §17)

| # | Criterion | Status |
|---|---|---|
| 1 | Next.js 16 repo deployed to Vercel | ✅ Live at https://ai-job-search-eta.vercel.app |
| 2 | `/api/health` returns `{ok: true}` | ✅ `HTTP 200` verified |
| 3 | Neon Postgres live with 12+ tables + pgvector | ✅ 14 tables, pgvector installed |
| 4 | All migrations applied cleanly | ✅ 2 migrations, no errors |
| 5 | LLM adapter with budget gateway | ✅ Anthropic + BudgetGateway, €20 cap enforced |
| 6 | 4 job sources live | ✅ Adzuna (292), Jooble (10), Magnet.me (58), NVB (0 today, 99 yesterday) |
| 7 | Pipeline runs end-to-end with real data | ✅ Today's run: 360 discovered, 56 ranked cleanly |
| 8 | Profile row seeded in Neon | ✅ Row id `8e87cf21-cfbf-4132-8253-18dfb4c6b432` |
| 9 | Admin auth + views | ✅ Login works, 5 admin routes rendering from live DB |
| 10 | Nightly cron firing automatically | ✅ GitHub Actions `*/15 0-5 * * *` |
| 11 | ≥30 jobs in DB | ✅ ~508 jobs total |
| 12 | ≥3 Tier-1 matches | ✅ ~15 T1 (today added 1 new) |
| 13 | ≥5 jobs hard-filtered | ✅ 86 filtered so far (Dutch + seniority) |
| 14 | Heartbeat email per run | ⚠️ Deferred — Resend dropped from v1. Admin runs view covers it. |

**Avi hand-review ✅** — logged into `/admin`, visually inspected jobs + runs + profile + budget. Quality bar approved.

## Week 1 spend

- Infrastructure: €0/mo (all free tiers)
- LLM: ~€1.20 total across yesterday's runs + today's nightly
- Remaining of €20 monthly cap: ~€18.80

## Open items carried into Week 2

1. **NVB returned 0 today** (vs 99 yesterday) — investigate if persistent
2. **~37 rank-failed rows** from earlier runs — will auto-clean on next nightly via re-rank-on-null logic
3. **Resend email notifications** — deferred
4. **Preview-env `CRON_SECRET` + `ADMIN_SECRET`** not set (non-blocking; preview env unused in production workflow)

## Gate

**Week 1 shipped. Phase 6 closed.** Ready for Phase 7 (Company Research) and beyond.
