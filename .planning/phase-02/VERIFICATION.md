# Phase 2 — Verification Report

**Status:** ✅ COMPLETE — 2026-04-14
**Commits:** `bf23c02`, `57762e7`, `7e790c6`, `89ee0fb`

## Requirements satisfied

| R-id | Requirement | Evidence |
|---|---|---|
| R-12 | `LLMAdapter` interface with `complete`, `structured` | `src/lib/llm/adapter.ts`; `embed` intentionally absent |
| R-13 | `AnthropicAPIAdapter` with Sonnet 4.6 + Haiku 4.5, prompt caching | `src/lib/llm/anthropic-api.ts`; `cacheSystem` flag; tool-use structured output |
| R-14 | `ClaudeMaxCLIAdapter` stub | present; throws if used |
| R-15 | Cost computation in EUR | `costEur()`; 3 tests pass |
| R-16 | `BudgetGateway` with allow/downgrade/block policy | `src/lib/llm/gateway.ts`; 5 tests pass |
| R-17 | Embeddings | **Superseded**: replaced with Haiku-based fit scoring per Phase 2 architectural decision. `embed` removed from interface. |

## Architectural decision: no embeddings

Replaced OpenAI embeddings + pgvector similarity with a single Haiku call that returns:
1. Enrichment (tools, seniority, Dutch-required, industries, location)
2. Five fit components (skills, tools, seniority, geo, industry) scored 0..1
3. Strengths / gaps / recommendation

**Reasoning:**
- Anthropic doesn't ship an embeddings API; adding OpenAI/Voyage violates "single provider" preference
- Haiku costs ~$2/mo at 900 JDs/mo (vs ~$0.50 for embeddings) — acceptable tradeoff
- Haiku output is richer: structured reasoning per JD, not just a cosine score
- Profile goes in cached system prompt → ~10× cheaper after first call
- pgvector remains installed for future similarity features (company clustering, past-application matching)

## Verification steps executed

1. `npm test` → 23 passing
2. `npm run typecheck` → 0 errors
3. `npm run build` → clean, all routes intact
4. `curl` smoke test against Anthropic API with rotated key → authenticated successfully (credit balance empty — user adding credits; not a code defect)
5. Lazy-init bug discovered in `src/db/index.ts` during smoke test and fixed (commit `89ee0fb`)

## Bug found + fixed

`src/db/index.ts` previously called `neon("")` at module load when any env var was missing, cascading crashes through the import graph. Now lazy-initialized via Proxy — `db` can be safely imported anywhere, neon client only materializes on first property access with a clear error if `DATABASE_URL` is missing at that point.

## Deviations from plan

- **Plan 2.1:** `assessJob` in rank.ts uses `await import()` for `@/lib/llm` (lazy import) so `blendFitScore` can be unit-tested without env. Minor deviation; functionally identical.
- **Plan 2.2:** Dropped the 95% intermediate threshold. Policy simplified to: allow <80%, downgrade Sonnet→Haiku at 80-100%, block at 100%. Three thresholds was over-engineered.
- **Plan 2.3:** Same lazy-import pattern.

## Gate

**Phase 2 complete.** Blocked on user adding Anthropic credits before first real LLM call in Phase 4 integration.

Ready for Phase 3: Discovery Sources.
