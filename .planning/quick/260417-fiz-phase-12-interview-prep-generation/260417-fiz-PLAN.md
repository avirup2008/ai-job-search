---
phase: 260417-fiz-phase-12-interview-prep-generation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/generate/interview-prep.ts
  - src/lib/generate/storage.ts
  - src/app/api/generate/interview-prep/[jobId]/route.ts
  - src/app/(app)/pipeline/actions.ts
  - src/components/job-detail/GeneratePanel.tsx
  - src/app/(app)/inbox/[jobId]/docs/page.tsx
  - src/app/api/download-pack/[jobId]/route.ts
autonomous: true
requirements: [phase-12-interview-prep]
must_haves:
  truths:
    - "Moving an application to status=\"interview\" triggers a fire-and-forget interview-prep generation if no prep doc exists yet."
    - "The POST /api/generate/interview-prep/:jobId route produces a single markdown doc with four ## section headers + closing questions section and stores it via @vercel/blob with kind=\"interview-prep\"."
    - "The GeneratePanel shows an Interview prep row with Generate/Regenerate and Review-in-app buttons; regenerate deletes the prior row and blob before creating a fresh one."
    - "The /inbox/:jobId/docs page renders ?doc=interview-prep inline as markdown, reusing the existing screening-qa render path."
    - "The download pack zip includes interview-prep.md (when present) with a README blurb line."
    - "The LLM prompt injects JD, company dossier (companies.researchJson via getCompanyDossier), and user profile (achievements, tools, preferences), routed to Sonnet through the existing BudgetGateway."
  artifacts:
    - path: src/lib/generate/interview-prep.ts
      provides: "generateInterviewPrep(jobId) returning { markdown, tokens, costEur, attempts } with four-section structure"
    - path: src/app/api/generate/interview-prep/[jobId]/route.ts
      provides: "POST route mirroring screening-qa route (nodejs runtime, maxDuration=300)"
    - path: src/lib/generate/storage.ts
      provides: "storeInterviewPrep() exported, writes documents row kind=\"interview-prep\" plus matching delete helper used by regenerate"
  key_links:
    - from: src/app/(app)/pipeline/actions.ts
      to: src/app/api/generate/interview-prep/[jobId]/route.ts (via direct function call to generateInterviewPrep+storeInterviewPrep)
      via: "fire-and-forget call inside updateApplicationStatus when new status === 'interview' and no existing interview-prep doc"
      pattern: "rescore.ts fire-and-forget pattern"
    - from: src/components/job-detail/GeneratePanel.tsx
      to: /api/generate/interview-prep/[jobId]
      via: "fetch POST"
      pattern: "existing ROWS spec array"
    - from: src/app/(app)/inbox/[jobId]/docs/page.tsx
      to: document row kind=\"interview-prep\"
      via: "docKey + docLabel branch; markdown render path"
      pattern: "screening-qa markdown render"
---

<objective>
Add a new `interview-prep` generated document type to Disha.

**Purpose:** When Upashana moves an application to `status="interview"`, Disha auto-generates a tailored interview prep doc (phone screen, hiring manager, marketing case tailored to this company, culture-fit, and questions to ask). She can also manually regenerate from the job detail page. Output is a single markdown doc stored in blob, surfaced in the docs viewer, and included in the download pack.

**Output:**
- New generator: `src/lib/generate/interview-prep.ts` (Sonnet via existing LLM gateway, anti-AI loop, 4 sections + closing).
- New API route: `src/app/api/generate/interview-prep/[jobId]/route.ts`.
- Storage helper `storeInterviewPrep` + `deleteInterviewPrep` in `src/lib/generate/storage.ts`.
- Wire-up: `updateApplicationStatus` auto-trigger, `GeneratePanel` row, docs page viewer branch, download-pack inclusion.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@src/db/schema.ts
@src/app/api/generate/screening-qa/[jobId]/route.ts
@src/lib/generate/screening-qa.ts
@src/lib/generate/storage.ts
@src/lib/generate/artifacts/base.ts
@src/components/job-detail/GeneratePanel.tsx
@src/app/(app)/inbox/[jobId]/docs/page.tsx
@src/app/api/download-pack/[jobId]/route.ts
@src/lib/profile/rescore.ts
@src/app/(app)/pipeline/actions.ts
@src/app/(app)/pipeline/stages.ts

<interfaces>
<!-- Extracted from codebase — executor should use these directly. -->

From src/db/schema.ts (documents table):
```typescript
// documents.kind is text — any string accepted. Use "interview-prep".
// Pattern established by screening-qa: store markdown blob URL in blobUrlDocx.
```

From src/lib/generate/artifacts/base.ts:
```typescript
export interface ArtifactContext {
  jobId: string;
  job: typeof schema.jobs.$inferSelect;
  companyName: string;
  companyDomain: string | null;
  profile: Profile;          // includes achievements, toolStack, stories, constraints, preferences
  profileText: string;       // compact text form already formatted
  dossier: Awaited<ReturnType<typeof getCompanyDossier>>; // productOneLiner, stage, industry, narrative, marketingStack, etc.
}
export async function loadArtifactContext(jobId: string): Promise<ArtifactContext>;
export async function runAntiAiLoop<T>(params: {
  systemPrompt: string; userPrompt: string; schema: z.ZodType<T>;
  maxTokens?: number; narrativeOf: (data: T) => string;
}): Promise<{ data: T; tokens: {...}; costEur: number; attempts: number }>;
```

From src/lib/generate/storage.ts (pattern to mirror — see `storeScreeningQA`):
- Uses `put()` from @vercel/blob, bucket path `screening-qa/${slug}.md`, contentType `text/markdown`.
- Determines nextVersion by querying existing rows with same applicationId + kind.
- Inserts into schema.documents with kind, version, blobUrlDocx=blob.url, blobUrlPdf=null.

From src/app/(app)/pipeline/stages.ts:
```typescript
export const PIPELINE_STAGES = ["new", "saved", "applied", "interview", "offer", "rejected"] as const;
// NOTE: the stage string is "interview" (singular), not "interviewing".
// The user's decision said "interviewing" — use the actual code value "interview".
```

From src/lib/profile/rescore.ts (fire-and-forget pattern):
- Async function, no throw on individual failures, caller uses `void rescoreMatchedJobs()` without await.

From src/components/job-detail/GeneratePanel.tsx (ROWS spec):
```typescript
interface GenRowSpec {
  key: "cover-letter" | "cv" | "artifact" | "screening-qa";  // extend with "interview-prep"
  label: string; endpoint: string; loadingMsg: string;
}
```
- The Review-in-app link maps spec.key → doc kind via a small switch. Extend both.
- `DocSummary.kind` union is `"cover" | "cv" | "artifact" | "screening"` — extend with `"interview-prep"`.
- `docsFor(key)` filter switch — extend.

From src/app/(app)/inbox/[jobId]/docs/page.tsx:
- `docKey(d)` returns `d.kind` for non-artifact docs — interview-prep docs will key as `"interview-prep"`.
- `docLabel(d)` switch — add `if (d.kind === "interview-prep") return "Interview prep";`
- Markdown render path: for `kind !== "cv" && kind !== "artifact"`, it treats content as markdown. interview-prep will naturally flow through this branch — just ensure docLabel handles it.

From src/app/api/download-pack/[jobId]/route.ts:
- `filenameFor(d)` switch — add case `"interview-prep"` returning filename `interview-prep.md`, description `"interview-prep.md — interview preparation (phone screen, HM, case, culture-fit)"`, binary: false.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Build interview-prep generator + storage helper</name>
  <files>
    src/lib/generate/interview-prep.ts (new),
    src/lib/generate/storage.ts (modify)
  </files>
  <behavior>
    - `generateInterviewPrep(jobId: string)` calls `loadArtifactContext` and `runAntiAiLoop` with model=sonnet.
    - Zod schema captures four sections (phoneScreen, hiringManager, caseRound, cultureFit) plus `questionsToAskThem: string[]` (5–7 items).
    - Each section shape: `{ overview: string, likelyQuestions: Array<{ question: string, talkingPoints: string[] }> }`.
    - caseRound section MUST include a `miniCase` field (object `{ scenario: string, suggested30DayPlan: string[] }`) referencing dossier.productOneLiner, dossier.narrative, dossier.marketingStack, dossier.stage — no generic placeholder scenarios.
    - `toMarkdown()` emits exactly four `##` headers matching the four sections in the locked decision, then a `## Questions you should ask them` closing section.
    - `storeInterviewPrep({ applicationId, markdown, tokenCostEur, tier })` mirrors `storeScreeningQA` exactly: bucket path `interview-prep/${slug}.md`, `kind="interview-prep"`, `blobUrlDocx=blob.url`, version increments per applicationId+kind.
    - `deleteInterviewPrep(applicationId)`: deletes the existing blob via `del` from @vercel/blob and deletes the documents row(s) with kind=\"interview-prep\" for that applicationId. Used by regenerate for clean replacement (mirrors the "delete old blob + row first" requirement in decision 8).
  </behavior>
  <action>
    1. Create `src/lib/generate/interview-prep.ts` modeled on `src/lib/generate/screening-qa.ts`.
       - Reuse `loadArtifactContext` + `runAntiAiLoop` from `./artifacts/base`.
       - System prompt: include the same anti-AI rules block (copy verbatim from screening-qa.ts) + interview-prep-specific rules: "FOUR sections; section 3 must include a real mini-case referencing THIS company's actual product/position/recent moves from the dossier; STAR-scaffold answers in section 4 using profile.achievements and profile.stories; never invent company facts or candidate experience."
       - User prompt injects: JD (first ~4000 chars), dossier (productOneLiner, stage, industry, narrative, marketingStack), profileText, constraints, preferences.
       - Zod schema with 4 named sections + miniCase + questionsToAskThem.
       - `narrativeOf()` concatenates all question/talkingPoint/miniCase strings for anti-AI validation.
       - `toMarkdown()` produces exactly: `# Interview prep: {role} @ {company}`, then `## 1. Phone screen / recruiter chat`, `## 2. Hiring manager round`, `## 3. Marketing case / technical round` (with **Mini-case:** subsection), `## 4. Culture-fit / values round`, `## Questions you should ask them`.
       - Export `generateInterviewPrep(jobId)`.
    2. In `src/lib/generate/storage.ts`:
       - Add `import { del } from "@vercel/blob";` alongside existing `put` import.
       - Add `storeInterviewPrep(params)` — copy `storeScreeningQA` verbatim, change kind to `"interview-prep"`, slug prefix to `"interview-prep-"`, bucket path to `interview-prep/${slug}.md`.
       - Add `deleteInterviewPrep(applicationId: string): Promise<void>` — select all rows where applicationId+kind="interview-prep", call `del(row.blobUrlDocx)` for each non-null url (wrapped in try/catch, log+swallow), then delete the rows.
  </action>
  <verify>
    <automated>cd "/Users/avi/Downloads/Claude/Code/AI Job Search" && npx tsc --noEmit</automated>
  </verify>
  <done>
    File `src/lib/generate/interview-prep.ts` exports `generateInterviewPrep`. `storage.ts` exports `storeInterviewPrep` and `deleteInterviewPrep`. `tsc --noEmit` passes.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Generate route + auto-trigger on status change</name>
  <files>
    src/app/api/generate/interview-prep/[jobId]/route.ts (new),
    src/app/(app)/pipeline/actions.ts (modify)
  </files>
  <behavior>
    - `POST /api/generate/interview-prep/:jobId`:
      - Mirrors `src/app/api/generate/screening-qa/[jobId]/route.ts` exactly.
      - runtime=nodejs, maxDuration=300.
      - Looks up job → ensures application row → calls `deleteInterviewPrep(app.id)` FIRST (to satisfy regenerate semantics: delete old blob+row before creating fresh) → calls `generateInterviewPrep(jobId)` → calls `storeInterviewPrep(...)` → returns `{ ok: true, document, markdownPreview, tokens, costEur, attempts }`.
    - `updateApplicationStatus(applicationId, status)`:
      - When the NEW status is `"interview"` (note: singular — per PIPELINE_STAGES in stages.ts), after the successful DB update, check if an `interview-prep` document already exists for this applicationId.
      - If it does NOT exist, fire-and-forget call `generateInterviewPrep(jobId) + storeInterviewPrep(...)` using the same fire-and-forget pattern as `rescore.ts` (no await on the outer promise, individual errors caught+logged, no throw).
      - Must NOT block the status update — user sees pipeline update immediately; generation runs in background.
      - Needs the jobId to call the generator — fetch it from the applications row before or during the update.
  </behavior>
  <action>
    1. Create `src/app/api/generate/interview-prep/[jobId]/route.ts`:
       - Copy `src/app/api/generate/screening-qa/[jobId]/route.ts` structure.
       - Swap `generateScreeningQA` → `generateInterviewPrep`, `storeScreeningQA` → `storeInterviewPrep`.
       - Before `generateInterviewPrep`, call `await deleteInterviewPrep(app.id)` so manual regenerate always starts clean.
       - Response shape: drop `pickedQuestions` field; otherwise match.
    2. Modify `src/app/(app)/pipeline/actions.ts` → `updateApplicationStatus`:
       - Load the application row's `jobId` (select jobId before the update, or return it from the update via `.returning({ jobId: schema.applications.jobId })`).
       - After the update, if `status === "interview"`:
         - Query `schema.documents` for existing rows where applicationId=applicationId AND kind="interview-prep".
         - If none exist, kick off an async IIFE: `void (async () => { try { const gen = await generateInterviewPrep(jobId); await storeInterviewPrep({ applicationId, markdown: gen.markdown, tokenCostEur: gen.costEur, tier: job.tier ?? null }); } catch (err) { console.error("[interview-prep-autogen]", err); } })();`.
         - Do NOT await the IIFE. Function returns immediately after `revalidatePath`.
       - Import `generateInterviewPrep` from `@/lib/generate/interview-prep`, `storeInterviewPrep` from `@/lib/generate/storage`.
       - Note for executor: fetching the job's tier requires an extra select from schema.jobs; acceptable to pass null if you prefer a simpler read — both fine.
  </action>
  <verify>
    <automated>cd "/Users/avi/Downloads/Claude/Code/AI Job Search" && npx tsc --noEmit && npx next lint --file src/app/api/generate/interview-prep/[jobId]/route.ts --file src/app/\(app\)/pipeline/actions.ts 2>&1 | tail -20</automated>
  </verify>
  <done>
    Route file exists at the correct path. `updateApplicationStatus` auto-triggers generation on transition to "interview" when no prep doc exists, without blocking. Typechecks clean.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Wire UI (GeneratePanel + docs viewer + download pack)</name>
  <files>
    src/components/job-detail/GeneratePanel.tsx (modify),
    src/app/(app)/inbox/[jobId]/docs/page.tsx (modify),
    src/app/api/download-pack/[jobId]/route.ts (modify)
  </files>
  <behavior>
    - GeneratePanel shows a fifth row "Interview prep" with Generate/Regenerate button that POSTs to `/api/generate/interview-prep/:jobId`, shows progress, and shows Review-in-app link pointing to `/inbox/:jobId/docs?doc=interview-prep`.
    - Docs viewer page `/inbox/[jobId]/docs?doc=interview-prep` renders the stored markdown inline using the existing `renderMarkdown` path; sidebar tab shows "Interview prep" label.
    - Download pack zip includes `interview-prep.md` with README line when present.
  </behavior>
  <action>
    1. `src/components/job-detail/GeneratePanel.tsx`:
       - Extend `GenRowSpec.key` union: add `"interview-prep"`.
       - Extend `ROWS`: add `{ key: "interview-prep", label: "Interview prep", endpoint: "interview-prep", loadingMsg: "Drafting interview prep…" }`.
       - Extend `DocSummary.kind` union: add `"interview-prep"`.
       - Extend `docsFor(key)`: add branch `if (key === "interview-prep") return docs.filter((d) => d.kind === "interview-prep");`.
       - Extend the Review-in-app href doc-slug mapping: the ternary chain currently maps cover-letter→cover, screening-qa→screening. Add `spec.key === "interview-prep" ? "interview-prep"` (keeps the kind string as-is). Apply in BOTH locations in this file.
       - Also update the caller that builds `docs: DocSummary[]` (grep for `GeneratePanel` usage — likely in `src/app/(app)/inbox/[jobId]/page.tsx` — to include `"interview-prep"` kind in the mapped docs list).
    2. `src/app/(app)/inbox/[jobId]/docs/page.tsx`:
       - `docLabel(d)`: add `if (d.kind === "interview-prep") return "Interview prep";` before the default.
       - The markdown render branch already handles anything that is not "cv" or "artifact" — interview-prep falls through to markdown path. Verify no other switch needs updating.
    3. `src/app/api/download-pack/[jobId]/route.ts`:
       - In `filenameFor(d)`, add case:
         ```ts
         case "interview-prep":
           return { filename: "interview-prep.md", description: "interview-prep.md — interview prep (phone screen, HM, case, culture-fit)", binary: false, url };
         ```
  </action>
  <verify>
    <automated>cd "/Users/avi/Downloads/Claude/Code/AI Job Search" && npx tsc --noEmit && npm run build 2>&1 | tail -30</automated>
  </verify>
  <done>
    Build succeeds. Manually: POST `/api/generate/interview-prep/:jobId` for an existing job returns ok=true with a document. `/inbox/:jobId/docs?doc=interview-prep` renders the markdown inline. `/api/download-pack/:jobId` zip contains `interview-prep.md` with the README line.
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` clean after each task.
- `npm run build` passes.
- Manual smoke:
  1. POST `/api/generate/interview-prep/:jobId` for a real job → inspect returned document + blob markdown has exactly four `## ` section headers + "## Questions you should ask them".
  2. Section 3 markdown references company-specific details (product name / stage / industry from dossier), not generic "a company".
  3. Move an application to `interview` via pipeline UI → within ~60s an interview-prep document appears on that application.
  4. Click "Regenerate" → old blob is deleted, new one created, version increments (or stays v1 if we always delete — confirm behaviour matches decision 8 "delete old blob + row first, then create fresh").
  5. Docs viewer renders inline markdown for `?doc=interview-prep`.
  6. Download pack zip contains `interview-prep.md` with README blurb.
</verification>

<success_criteria>
- User moves an application to `status="interview"` → prep doc is auto-generated without blocking the status update.
- User can manually regenerate from GeneratePanel; old blob+row deleted first.
- Markdown doc has exactly four top-level sections + closing questions section.
- Section 3 (marketing case) references the actual company dossier.
- Doc is viewable inline at `/inbox/:jobId/docs?doc=interview-prep` and included in download pack.
- No new DB tables; reuses `documents` with `kind="interview-prep"`.
- Sonnet via existing BudgetGateway; no changes to LLM routing.
</success_criteria>

<output>
After completion, create `.planning/quick/260417-fiz-phase-12-interview-prep-generation/260417-fiz-SUMMARY.md` documenting:
- Files created/modified.
- Sample generated markdown excerpt (section 3 mini-case is the acceptance-critical one).
- How regenerate semantics were implemented.
- Any deviations from the plan.
</output>
