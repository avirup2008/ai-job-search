---
phase: quick
plan: 260417-kgd
type: execute
wave: 1
depends_on: []
files_modified:
  - src/middleware.ts
  - src/app/(app)/pipeline/actions.ts
  - src/app/(app)/profile/actions.ts
  - src/lib/retention/purge.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "(app) routes (/inbox, /pipeline, /analytics, /paste) redirect unauthenticated users to /admin/login"
    - "/api/generate/* and /api/download-pack/* return 401 to unauthenticated requests"
    - "/p/[slug] remains publicly accessible (no auth required)"
    - "/admin/* continues to work exactly as before"
    - "updateApplicationStatus awaits interview-prep generation before the server action completes"
    - "triggerRescore is awaited in all profile actions before they return"
    - "Jobs older than 180 days with no application rows are purged by the cron"
  artifacts:
    - path: "src/middleware.ts"
      provides: "Edge middleware enforcing auth cookie on (app) and API routes"
    - path: "src/app/(app)/pipeline/actions.ts"
      provides: "Awaited interview-prep auto-generation"
    - path: "src/app/(app)/profile/actions.ts"
      provides: "Awaited rescore in all profile mutation actions"
    - path: "src/lib/retention/purge.ts"
      provides: "Second purge path for orphaned jobs with no application rows"
  key_links:
    - from: "src/middleware.ts"
      to: "src/lib/auth/admin.ts"
      via: "Cookie name 'aijs_admin' read directly from request headers (no imported helper — middleware runs on Edge, auth helper uses next/headers)"
    - from: "src/lib/retention/purge.ts"
      to: "schema.jobs / schema.applications"
      via: "LEFT JOIN / NOT EXISTS subquery targeting discoveredAt < 180 days and no application row"
---

<objective>
Fix three findings from the Codex security review:

1. P1-A: Auth gap — the entire (app) route group and all /api/generate/* and /api/download-pack/* routes are publicly accessible. Only /admin is currently gated.
2. P1-B: Fire-and-forget async in server actions — unawaited interview-prep generation (pipeline/actions.ts) and unawaited rescore (profile/actions.ts) risk being cut off when Vercel serverless ends the request.
3. P2: Retention misses filtered jobs — jobs inserted as filtered/rank-failed (no application row) accumulate forever because purge.ts only finds jobs via application rows.

Purpose: Harden a personal, single-user app to the minimum security and reliability standard an external review expects. No new auth system — reuse existing isAdmin() cookie gate.
Output: middleware.ts (new), two updated server actions, updated purge.ts.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@src/lib/auth/admin.ts
@src/app/admin/(gated)/layout.tsx
@src/db/schema.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create middleware.ts to gate (app) and API routes</name>
  <files>src/middleware.ts</files>
  <action>
Create `src/middleware.ts` (Next.js edge middleware). The file must:

1. Read the `aijs_admin` cookie from the request directly (do NOT import from `@/lib/auth/admin` — that module uses `next/headers` which is not available on the Edge runtime).
2. Read the expected secret from `process.env.ADMIN_SECRET`. If the env var is missing at edge time, fail closed (redirect to login).
3. Gate the following path patterns:
   - `/(app)` route group pages: `/inbox`, `/pipeline`, `/analytics`, `/paste` (and any sub-paths)
   - `/api/generate/:path*`
   - `/api/download-pack/:path*`
4. For page requests (not API): redirect unauthenticated users to `/admin/login`.
5. For API requests: return `Response.json({ error: "unauthorized" }, { status: 401 })`.
6. Leave ALL other paths open:
   - `/p/:slug*` (public artifact viewer)
   - `/admin/*` (has its own layout-level gate)
   - `/api/cron/*` (uses Bearer token auth, not cookie)
   - Everything else

Use the `matcher` config in `export const config` to restrict the middleware to only the relevant paths — do not run it on every request.

Cookie name constant: `aijs_admin` (same as in `src/lib/auth/admin.ts`).
Comparison: `cookieValue === process.env.ADMIN_SECRET` — same pattern as `isAdmin()`.

Do NOT use next-auth, Auth.js, or any external auth library. This is a pure cookie-check pattern.

Example matcher covering all guarded paths:
```ts
export const config = {
  matcher: [
    "/inbox/:path*",
    "/pipeline/:path*",
    "/analytics/:path*",
    "/paste/:path*",
    "/api/generate/:path*",
    "/api/download-pack/:path*",
  ],
};
```
  </action>
  <verify>
    <automated>cd /Users/avi/Downloads/Claude/Code/AI\ Job\ Search && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
- src/middleware.ts exists and compiles without TypeScript errors
- Matcher covers (app) pages and the two API path groups
- Cookie check uses `process.env.ADMIN_SECRET` directly (no next/headers import)
- API routes return 401 JSON; page routes redirect to /admin/login
  </done>
</task>

<task type="auto">
  <name>Task 2: Await fire-and-forget async in pipeline and profile actions</name>
  <files>
    src/app/(app)/pipeline/actions.ts
    src/app/(app)/profile/actions.ts
  </files>
  <action>
**pipeline/actions.ts — fix interview-prep auto-generation (lines 91–104):**

Replace the `void (async () => { ... })()` IIFE with a direct `await`:

```ts
// BEFORE (fire-and-forget, may be cut off):
void (async () => {
  try {
    const gen = await generateInterviewPrep(app.jobId);
    await storeInterviewPrep({ ... });
    console.log(...);
  } catch (err) {
    console.error(...);
  }
})();

// AFTER (awaited, safe on Vercel serverless):
try {
  const gen = await generateInterviewPrep(app.jobId);
  await storeInterviewPrep({
    applicationId,
    markdown: gen.markdown,
    tokenCostEur: gen.costEur,
    tier: job?.tier ?? null,
  });
  console.log(`[interview-prep-autogen] done for applicationId=${applicationId}`);
} catch (err) {
  console.error("[interview-prep-autogen]", err);
}
```

Keep the surrounding `if (status === "interview" && app)` and `if (existing.length === 0)` guards exactly as they are. The only change is replacing the IIFE with direct await.

**profile/actions.ts — fix triggerRescore:**

The `triggerRescore()` function (lines 16–27) uses `.then()/.catch()` without being awaited by callers. The function is called in `addTool`, `removeTool`, `addAchievement`, `removeAchievement`, and `updatePreferences`.

Convert `triggerRescore` to an async function that awaits the rescore, and await it at each call site:

```ts
// BEFORE:
function triggerRescore() {
  rescoreMatchedJobs()
    .then((r) => { ... })
    .catch((err) => { ... });
}

// AFTER:
async function triggerRescore() {
  try {
    const r = await rescoreMatchedJobs();
    console.log(`[rescore] updated=${r.updated} costEur=${r.costEur.toFixed(4)}`);
    revalidatePath("/inbox");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[rescore] failed: ${msg}`);
  }
}
```

And update each call site from `triggerRescore()` to `await triggerRescore()`. There are 5 call sites: end of `addTool`, `removeTool`, `addAchievement`, `removeAchievement`, and `updatePreferences`.
  </action>
  <verify>
    <automated>cd /Users/avi/Downloads/Claude/Code/AI\ Job\ Search && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
- pipeline/actions.ts: the `void` IIFE is gone; interview-prep generation is awaited inline within the status === "interview" branch
- profile/actions.ts: `triggerRescore` is now `async function triggerRescore()` and all 5 call sites use `await triggerRescore()`
- TypeScript compiles clean
  </done>
</task>

<task type="auto">
  <name>Task 3: Purge orphaned jobs with no application rows</name>
  <files>src/lib/retention/purge.ts</files>
  <action>
Add a second purge path in `purgeOldJobs` that catches jobs which were inserted by the pipeline (discovered, filtered/rank-failed) but never got an application row. These accumulate forever under the current logic because `selectPurgeCandidates` only finds jobs via their application rows.

**Retention rule:** A job with NO application row and `discoveredAt < now - 180 days` is safe to purge.

**Changes to `src/lib/retention/purge.ts`:**

1. Add a constant at the top alongside `RETENTION_DAYS`:
```ts
const ORPHAN_RETENTION_DAYS = 180;
```

2. Add a new function `selectOrphanJobIds` after `selectPurgeCandidates`:
```ts
/**
 * Jobs that were discovered but never had an application row created.
 * These are filtered/rank-failed jobs that the pipeline never promoted.
 * Purge threshold: 180 days since discoveredAt.
 */
export async function selectOrphanJobIds(now: Date): Promise<string[]> {
  const cutoff = new Date(now.getTime() - ORPHAN_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Pull all jobIds that have at least one application row
  const withApps = await db
    .selectDistinct({ jobId: schema.applications.jobId })
    .from(schema.applications);

  const withAppsSet = new Set(withApps.map((r) => r.jobId));

  // Pull all jobs older than the cutoff
  const oldJobs = await db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(lt(schema.jobs.discoveredAt, cutoff));

  return (oldJobs as Array<{ id: string }>)
    .filter((j) => !withAppsSet.has(j.id))
    .map((j) => j.id);
}
```

3. Add `lt` to the drizzle-orm import at the top of the file:
```ts
import { inArray, lt } from "drizzle-orm";
```

4. In `purgeOldJobs`, after the existing `selectPurgeCandidates` call, also call `selectOrphanJobIds` and merge the results:
```ts
const { jobIds, applicationIds, documents } = await selectPurgeCandidates(now);
const orphanJobIds = await selectOrphanJobIds(now);

// Merge, deduplicate (selectPurgeCandidates and orphans are disjoint by definition,
// but guard anyway)
const allJobIds = [...new Set([...jobIds, ...orphanJobIds])];
```

5. Replace every reference to `jobIds` in the delete + result sections with `allJobIds`:
- `if (jobIds.length > 0)` → `if (allJobIds.length > 0)`
- `await db.delete(schema.jobs).where(inArray(schema.jobs.id, jobIds))` → `...inArray(schema.jobs.id, allJobIds)`
- `jobsDeleted: jobIds.length` → `jobsDeleted: allJobIds.length`

The `applicationIds` and `documents` arrays remain unchanged (orphan jobs have no applications or documents to delete separately — the job row cascade handles anything downstream).

The `PurgeResult` type and the cron route handler require no changes.
  </action>
  <verify>
    <automated>cd /Users/avi/Downloads/Claude/Code/AI\ Job\ Search && npx tsc --noEmit 2>&1 | head -20 && npx vitest run --reporter=verbose src/lib/retention 2>&1 | tail -20</automated>
  </verify>
  <done>
- `lt` is imported from drizzle-orm
- `ORPHAN_RETENTION_DAYS = 180` constant exists
- `selectOrphanJobIds(now)` function exported and callable
- `purgeOldJobs` merges orphan job IDs with application-based candidates before deleting
- TypeScript compiles clean; existing retention tests pass
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Public internet → (app) pages | Previously open; now cookie-gated in middleware |
| Public internet → /api/generate/* | Previously open; now cookie-gated in middleware |
| Public internet → /api/download-pack/* | Previously open; now cookie-gated in middleware |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-kgd-01 | Elevation of Privilege | (app) route group + generate/download APIs | mitigate | Edge middleware checks aijs_admin cookie against ADMIN_SECRET env var before serving any response |
| T-kgd-02 | Information Disclosure | /api/generate/* returning LLM-generated documents | mitigate | Covered by T-kgd-01; additionally returns 401 JSON (not redirect) so clients get a machine-readable error |
| T-kgd-03 | Denial of Service | Unawaited async in serverless functions | mitigate | Awaiting interview-prep and rescore prevents premature function termination cutting off DB writes |
| T-kgd-04 | Denial of Service | Unbounded job table growth from filtered/orphan jobs | mitigate | 180-day orphan purge path added to daily cron |
</threat_model>

<verification>
After all three tasks:

1. TypeScript: `npx tsc --noEmit` — zero errors
2. Tests: `npx vitest run` — all existing tests pass (no regressions)
3. Middleware check (manual or curl): unauthenticated GET /pipeline redirects to /admin/login; unauthenticated GET /api/generate/cv/test returns 401 JSON
4. Public path check: /p/[slug] is NOT matched by middleware config (verify via `config.matcher` inspection)
</verification>

<success_criteria>
- middleware.ts created; (app) pages and generate/download-pack APIs require valid aijs_admin cookie
- /p/[slug] and /api/cron/* remain publicly accessible
- No `void` IIFE or unawaited .then() calls in pipeline/actions.ts or profile/actions.ts
- purge.ts deletes jobs older than 180 days with no application rows
- `npx tsc --noEmit` passes
- `npx vitest run` all green
</success_criteria>

<output>
After completion, create `.planning/quick/260417-kgd-fix-auth-gap-fire-and-forget-async-and-r/260417-kgd-SUMMARY.md` with what was done, files modified, and any decisions made.
</output>
