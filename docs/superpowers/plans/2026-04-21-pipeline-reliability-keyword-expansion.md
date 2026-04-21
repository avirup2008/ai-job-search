# Pipeline Reliability + Keyword Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the nightly pipeline so runs complete reliably (~7/7 instead of ~1/7) and discover more relevant jobs per run (8–15 instead of ~2).

**Architecture:** Two independent changes wired together. (1) Wrap each source's `fetch()` call in a `Promise.race` against a 45s timeout deadline so a hanging Apify actor can't consume the entire 300s Vercel budget. (2) Create a single canonical `keywords.ts` file imported by all 7 sources, replacing 7 divergent local arrays with one authoritative list that includes previously missing high-value terms and removes unwanted ones.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, pLimit, existing Apify source pattern

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify | `src/lib/pipeline/discover.ts` | Add `SOURCE_TIMEOUT_MS`, wrap `s.fetch()` in `Promise.race` |
| Create | `src/lib/sources/keywords.ts` | Canonical keyword list |
| Modify | `src/lib/sources/adzuna.ts` | Replace local `KEYWORDS` const with import |
| Modify | `src/lib/sources/jooble.ts` | Replace local `KEYWORDS` const with import |
| Modify | `src/lib/sources/magnetme.ts` | Replace local `KEYWORDS` const with import |
| Modify | `src/lib/sources/nvb.ts` | Replace local `KEYWORDS` const with import |
| Modify | `src/lib/sources/wttj.ts` | Replace local `KEYWORDS` const with import |
| Modify | `src/lib/sources/apify-indeed.ts` | Replace local `KEYWORDS` const with import |
| Modify | `src/lib/sources/apify-linkedin.ts` | Replace local `KEYWORDS` const with import |
| Create | `tests/unit/sources/keywords.test.ts` | Verify list contents |
| Modify | `tests/unit/pipeline/discover.test.ts` | Add timeout test |

---

### Task 1: Per-source timeout in `discover.ts`

**Files:**
- Modify: `src/lib/pipeline/discover.ts`
- Modify: `tests/unit/pipeline/discover.test.ts`

- [ ] **Step 1: Write the failing timeout test**

Open `tests/unit/pipeline/discover.test.ts` and add this test inside the existing `describe` block (after the existing tests):

```typescript
it("resolves timed-out sources to [] and continues", async () => {
  vi.doMock("@/lib/sources", () => ({
    allSources: () => [
      {
        name: "fast",
        fetch: async () => [{ source: "fast", sourceExternalId: "1", sourceUrl: "http://a.com", title: "Fast Job", jdText: "", companyName: null, companyDomain: null, location: null, postedAt: null }],
      },
      {
        name: "slow",
        // never resolves within the timeout
        fetch: () => new Promise(() => {}),
      },
    ],
  }));

  const { discover } = await import("@/lib/pipeline/discover");
  const result = await discover({ sourceTimeoutMs: 50 });

  expect(result.jobs).toHaveLength(1);
  expect(result.jobs[0].source).toBe("fast");
  expect(result.errors["slow"]).toMatch(/timeout/i);
  expect(result.perSource["slow"]).toBe(0);
  expect(result.perSource["fast"]).toBe(1);

  vi.doUnmock("@/lib/sources");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
npx vitest run tests/unit/pipeline/discover.test.ts 2>&1 | tail -20
```

Expected: FAIL — `discover` does not accept `sourceTimeoutMs`, no timeout logic exists.

- [ ] **Step 3: Implement the timeout in `discover.ts`**

Replace the entire file content with:

```typescript
import pLimit from "p-limit";
import { allSources } from "@/lib/sources";
import type { RawJob } from "@/lib/sources/types";

export interface DiscoverResult {
  jobs: RawJob[];
  perSource: Record<string, number>;
  errors: Record<string, string>;
  elapsedMs: number;
}

const SOURCE_TIMEOUT_MS = 45_000;

/**
 * Fan out to every registered job source in parallel (max 2 concurrent).
 * Each source is raced against a per-source deadline so one hanging source
 * (e.g. an Apify actor that never resolves) cannot consume the full Vercel
 * 300s function budget. Timeout failures are recorded in errors[source.name]
 * exactly like any other error — no change to the error isolation contract.
 */
export async function discover(
  opts: { sourceTimeoutMs?: number } = {}
): Promise<DiscoverResult> {
  const started = Date.now();
  const timeoutMs = opts.sourceTimeoutMs ?? SOURCE_TIMEOUT_MS;
  const limit = pLimit(6); // one slot per source — all fan out in parallel
  const sources = allSources();
  const perSource: Record<string, number> = {};
  const errors: Record<string, string> = {};

  const results = await Promise.all(
    sources.map((s) =>
      limit(async () => {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`timeout after ${timeoutMs}ms`)),
            timeoutMs
          )
        );
        try {
          const jobs = await Promise.race([s.fetch(), timeoutPromise]);
          perSource[s.name] = jobs.length;
          return jobs;
        } catch (e) {
          errors[s.name] = e instanceof Error ? e.message : String(e);
          perSource[s.name] = 0;
          return [] as RawJob[];
        }
      })
    )
  );

  return {
    jobs: results.flat(),
    perSource,
    errors,
    elapsedMs: Date.now() - started,
  };
}
```

- [ ] **Step 4: Run all discover tests**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
npx vitest run tests/unit/pipeline/discover.test.ts 2>&1 | tail -20
```

Expected: all tests PASS, including the new timeout test.

- [ ] **Step 5: TypeScript check**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
git add src/lib/pipeline/discover.ts tests/unit/pipeline/discover.test.ts
git commit -m "feat(pipeline): per-source 45s timeout in discover — prevents Apify hang from consuming Vercel budget"
```

---

### Task 2: Create centralised `keywords.ts` with test

**Files:**
- Create: `src/lib/sources/keywords.ts`
- Create: `tests/unit/sources/keywords.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/sources/keywords.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SEARCH_KEYWORDS } from "@/lib/sources/keywords";

describe("SEARCH_KEYWORDS", () => {
  it("contains all required high-value terms", () => {
    const list = [...SEARCH_KEYWORDS];
    expect(list).toContain("marketing automation");
    expect(list).toContain("marketing operations");
    expect(list).toContain("CRM marketing");
    expect(list).toContain("CRM specialist");
    expect(list).toContain("email marketing");
    expect(list).toContain("campaign manager");
    expect(list).toContain("marketing coordinator");
    expect(list).toContain("marketing specialist");
    expect(list).toContain("HubSpot");
    expect(list).toContain("digital marketing");
    expect(list).toContain("growth marketing");
    expect(list).toContain("demand generation");
  });

  it("does not contain removed terms", () => {
    const list = [...SEARCH_KEYWORDS];
    expect(list).not.toContain("paid media");
    expect(list).not.toContain("marketing manager");
    expect(list).not.toContain("email marketing manager");
  });

  it("has exactly 12 keywords", () => {
    expect(SEARCH_KEYWORDS).toHaveLength(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
npx vitest run tests/unit/sources/keywords.test.ts 2>&1 | tail -20
```

Expected: FAIL — `@/lib/sources/keywords` does not exist.

- [ ] **Step 3: Create `src/lib/sources/keywords.ts`**

```typescript
/**
 * Canonical keyword list for all job sources.
 * Single source of truth — import from here, never define locally in a source file.
 *
 * Decisions:
 * - "paid media" removed: Upashana's profile excludes paid/performance roles
 * - "marketing manager" removed: too broad, low LLM precision score
 * - "email marketing manager" retired: subsumed by "email marketing" + "campaign manager"
 * - "marketing operations", "CRM specialist", "campaign manager", "marketing coordinator",
 *   "marketing specialist", "demand generation" added: direct profile match, previously
 *   missing from most or all sources
 */
export const SEARCH_KEYWORDS = [
  "marketing automation",
  "marketing operations",
  "CRM marketing",
  "CRM specialist",
  "email marketing",
  "campaign manager",
  "marketing coordinator",
  "marketing specialist",
  "HubSpot",
  "digital marketing",
  "growth marketing",
  "demand generation",
] as const;

export type SearchKeyword = (typeof SEARCH_KEYWORDS)[number];
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
npx vitest run tests/unit/sources/keywords.test.ts 2>&1 | tail -20
```

Expected: all 3 tests PASS.

- [ ] **Step 5: TypeScript check**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
git add src/lib/sources/keywords.ts tests/unit/sources/keywords.test.ts
git commit -m "feat(sources): centralised SEARCH_KEYWORDS — 12 canonical terms, removes paid-media/marketing-manager"
```

---

### Task 3: Wire `SEARCH_KEYWORDS` into the 5 free sources

**Files:**
- Modify: `src/lib/sources/adzuna.ts`
- Modify: `src/lib/sources/jooble.ts`
- Modify: `src/lib/sources/magnetme.ts`
- Modify: `src/lib/sources/nvb.ts`
- Modify: `src/lib/sources/wttj.ts`

- [ ] **Step 1: Update `adzuna.ts`**

Replace the local `KEYWORDS` block (lines 33–43):

```typescript
// NL marketing keywords — can be extended later via profile.preferences.roleFamilies
const KEYWORDS = [
  "marketing automation",
  "CRM marketing",
  "email marketing",
  "digital marketing",
  "HubSpot",
  "growth marketing",
  "paid media",
  "marketing manager",
] as const;
```

With this import (add after the existing imports at the top of the file):

```typescript
import { SEARCH_KEYWORDS } from "./keywords";
```

Then replace the deleted `KEYWORDS` usage in the `fetch()` body:

```typescript
// Before:
for (const kw of KEYWORDS) {

// After:
for (const kw of SEARCH_KEYWORDS) {
```

- [ ] **Step 2: Update `jooble.ts`**

Replace the local `KEYWORDS` block (lines 36–43):

```typescript
const KEYWORDS = [
  "marketing automation",
  "CRM marketing",
  "email marketing",
  "HubSpot",
  "growth marketing",
  "digital marketing",
] as const;
```

Add import after existing imports:

```typescript
import { SEARCH_KEYWORDS } from "./keywords";
```

Replace usage in `fetch()`:

```typescript
// Before:
for (const kw of KEYWORDS) {

// After:
for (const kw of SEARCH_KEYWORDS) {
```

- [ ] **Step 3: Update `magnetme.ts`**

Replace the local `KEYWORDS` block (lines 12–19):

```typescript
const KEYWORDS = [
  "marketing automation",
  "CRM marketing",
  "email marketing",
  "HubSpot",
  "growth marketing",
  "digital marketing",
] as const;
```

Add import after existing imports:

```typescript
import { SEARCH_KEYWORDS } from "./keywords";
```

Replace usage in `fetch()`:

```typescript
// Before:
for (const kw of KEYWORDS) {

// After:
for (const kw of SEARCH_KEYWORDS) {
```

- [ ] **Step 4: Update `nvb.ts`**

Replace the local `KEYWORDS` block (lines 15–22):

```typescript
const KEYWORDS = [
  "marketing automation",
  "CRM marketing",
  "email marketing",
  "HubSpot",
  "growth marketing",
  "digital marketing",
] as const;
```

Add import after existing imports:

```typescript
import { SEARCH_KEYWORDS } from "./keywords";
```

Replace usage in `fetch()`:

```typescript
// Before:
for (const kw of KEYWORDS) {

// After:
for (const kw of SEARCH_KEYWORDS) {
```

- [ ] **Step 5: Update `wttj.ts`**

Replace the local `KEYWORDS` block (lines 19–26):

```typescript
const KEYWORDS = [
  "marketing automation",
  "CRM marketing",
  "email marketing",
  "HubSpot",
  "campaign manager",
  "marketing operations",
] as const;
```

Add import after existing imports:

```typescript
import { SEARCH_KEYWORDS } from "./keywords";
```

Replace usage in `fetch()`:

```typescript
// Before:
for (const keyword of KEYWORDS) {

// After:
for (const keyword of SEARCH_KEYWORDS) {
```

- [ ] **Step 6: TypeScript check**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 7: Run existing source unit tests**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
npx vitest run tests/unit/sources/ 2>&1 | tail -30
```

Expected: all tests pass (existing parse/normalize tests are not affected by keyword changes).

- [ ] **Step 8: Commit**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
git add src/lib/sources/adzuna.ts src/lib/sources/jooble.ts src/lib/sources/magnetme.ts src/lib/sources/nvb.ts src/lib/sources/wttj.ts
git commit -m "refactor(sources): wire SEARCH_KEYWORDS into 5 free sources — adzuna, jooble, magnetme, nvb, wttj"
```

---

### Task 4: Wire `SEARCH_KEYWORDS` into Apify sources

**Files:**
- Modify: `src/lib/sources/apify-indeed.ts`
- Modify: `src/lib/sources/apify-linkedin.ts`

- [ ] **Step 1: Update `apify-indeed.ts`**

Replace the local `KEYWORDS` block (lines 15–22):

```typescript
const KEYWORDS = [
  "marketing automation",
  "CRM marketing",
  "email marketing",
  "HubSpot",
  "campaign manager",
  "marketing operations",
] as const;
```

Add import after existing imports:

```typescript
import { SEARCH_KEYWORDS } from "./keywords";
```

Replace usage in `fetch()`:

```typescript
// Before:
KEYWORDS.map((keyword) =>

// After:
SEARCH_KEYWORDS.map((keyword) =>
```

- [ ] **Step 2: Update `apify-linkedin.ts`**

The current `KEYWORDS` in apify-linkedin.ts (lines 28–34) is:

```typescript
const KEYWORDS = [
  "marketing automation",
  "CRM specialist",
  "HubSpot",
  "campaign manager",
  "email marketing manager",
] as const;
```

Replace it. Add import after existing imports:

```typescript
import { SEARCH_KEYWORDS } from "./keywords";
```

Replace usage in `fetch()`:

```typescript
// Before:
const urls = KEYWORDS.map(buildLinkedInUrl);

// After:
const urls = SEARCH_KEYWORDS.map(buildLinkedInUrl);
```

Note: `MAX_ITEMS_PER_URL = 10` stays as-is. With 12 keywords × 10 results = 120 results per run. At $1/1,000 results that's $0.12/run — still within the $5/month Apify free tier.

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
npx vitest run 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
git add src/lib/sources/apify-indeed.ts src/lib/sources/apify-linkedin.ts
git commit -m "refactor(sources): wire SEARCH_KEYWORDS into apify-indeed and apify-linkedin"
```

- [ ] **Step 6: Push**

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"
git push
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task covering it |
|-----------------|-----------------|
| `Promise.race` with 45s deadline per source | Task 1 |
| `SOURCE_TIMEOUT_MS = 45_000` constant | Task 1 |
| Timeout recorded in `errors[source.name]` | Task 1 (test verifies) |
| No change to orchestrator's try/catch/finally | N/A — discover.ts is the only file changed for Task 1 ✓ |
| Create `src/lib/sources/keywords.ts` | Task 2 |
| 12-term canonical list | Task 2 |
| Remove "paid media" | Task 2 (test asserts absence) |
| Remove "marketing manager" | Task 2 (test asserts absence) |
| All 5 free sources import from keywords.ts | Task 3 |
| Both Apify sources import from keywords.ts | Task 4 |

**Placeholder scan:** None found.

**Type consistency:** `SEARCH_KEYWORDS` is used consistently as the import name across all 7 source files. `discover()` signature change (`opts: { sourceTimeoutMs?: number } = {}`) is backward-compatible — existing callers (orchestrator, scripts) that call `discover()` with no arguments continue to work unchanged.
