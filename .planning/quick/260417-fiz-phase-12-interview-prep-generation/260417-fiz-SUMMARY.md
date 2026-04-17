---
phase: 260417-fiz-phase-12-interview-prep-generation
plan: "01"
subsystem: generate
tags: [interview-prep, generate, storage, pipeline, ui]
one-liner: "Interview-prep doc generator with 4-section Zod schema + mini-case tied to company dossier, auto-triggered on status=interview"
tech-stack:
  added: []
  patterns: [runAntiAiLoop, storeX/deleteX storage pattern, void-IIFE fire-and-forget]
key-files:
  created:
    - src/lib/generate/interview-prep.ts
    - src/app/api/generate/interview-prep/[jobId]/route.ts
  modified:
    - src/lib/generate/storage.ts
    - src/app/(app)/pipeline/actions.ts
    - src/components/job-detail/GeneratePanel.tsx
    - src/app/(app)/inbox/[jobId]/docs/page.tsx
    - src/app/api/download-pack/[jobId]/route.ts
decisions:
  - "storeInterviewPrep uses kind='interview-prep' (not 'interview') to keep kinds readable and consistent with the documents table"
  - "deleteInterviewPrep catches per-blob errors and swallows them so a missing blob never blocks regenerate"
  - "auto-trigger reads the existing docs table before firing to avoid duplicate generation on repeated status transitions"
  - "miniCase scenario is injected verbatim into the user prompt referencing the actual dossier.productOneLiner so Sonnet cannot fall back to generic content"
metrics:
  completed: "2026-04-17"
  tasks: 3
  files: 7
---

# Phase 260417-fiz Plan 01: Interview Prep Generation Summary

**One-liner:** Interview-prep doc generator with 4-section Zod schema + mini-case tied to company dossier, auto-triggered on status=interview, surfaced in docs viewer and download pack.

## What Was Built

### T1 — Core generator + storage helpers

`src/lib/generate/interview-prep.ts` exports `generateInterviewPrep(jobId)`:
- Calls `loadArtifactContext` + `runAntiAiLoop` (Sonnet via existing BudgetGateway)
- Zod schema: four named sections (`phoneScreen`, `hiringManager`, `caseRound`, `cultureFit`) each with `overview` + `likelyQuestions[{question, talkingPoints[]}]`; `caseRound` extends with `miniCase: { scenario, suggested30DayPlan[] }`; top-level `questionsToAskThem: string[]` (5-7)
- System prompt copies the verbatim anti-AI rules block from `screening-qa.ts`, plus interview-specific rules: section 3 mini-case must reference THIS company's product/stage/narrative — generic scenarios are called out as failures
- User prompt injects dossier fields explicitly: `productOneLiner`, `stage`, `industry`, `narrative`, `marketingStack`
- `toMarkdown()` emits exactly: `# Interview prep: {role} @ {company}`, `## 1. Phone screen / recruiter chat`, `## 2. Hiring manager round`, `## 3. Marketing case / technical round` (with `**Mini-case:**` subsection), `## 4. Culture-fit / values round`, `## Questions you should ask them`

`src/lib/generate/storage.ts` additions:
- `import { del }` added alongside existing `put`
- `storeInterviewPrep()`: mirrors `storeScreeningQA` exactly; bucket path `interview-prep/${slug}.md`; `kind="interview-prep"`; `blobUrlDocx=blob.url`; version increments per applicationId+kind
- `deleteInterviewPrep(applicationId)`: selects all rows for applicationId+kind="interview-prep", calls `del(blobUrlDocx)` per row in a try/catch (log+swallow), then deletes all rows in a single DELETE

### T2 — API route + auto-trigger

`src/app/api/generate/interview-prep/[jobId]/route.ts`:
- `runtime="nodejs"`, `maxDuration=300`
- Looks up job → ensures application row → calls `deleteInterviewPrep(app.id)` first → `generateInterviewPrep(jobId)` → `storeInterviewPrep(...)` → returns `{ ok, document, markdownPreview, tokens, costEur, attempts }`
- No `pickedQuestions` field (single-stage generator, not two-stage like screening-qa)

`src/app/(app)/pipeline/actions.ts` — `updateApplicationStatus` extended:
- Fetches `app.jobId` via a SELECT before the UPDATE (needed for generator call)
- After the update + `revalidatePath`, if `status === "interview"`: queries documents for existing `kind="interview-prep"` row; if none, fires a `void (async () => { ... })()` IIFE — never awaited, errors caught and logged via `[interview-prep-autogen]` prefix
- Also fetches `job.tier` for cost tracking; passes `null` if unavailable (acceptable)

### T3 — UI wiring

`GeneratePanel.tsx`:
- `GenRowSpec.key` union extended with `"interview-prep"`
- `ROWS` gets fifth entry: `{ key: "interview-prep", label: "Interview prep", endpoint: "interview-prep", loadingMsg: "Drafting interview prep…" }`
- `DocSummary.kind` union extended with `"interview-prep"`
- `docsFor()` gets explicit branch for `"interview-prep"`
- Both Review-in-app href ternary chains extended: `spec.key === "interview-prep" ? "interview-prep"` (kind string used as-is, matching `docKey()` output)

`docs/page.tsx`:
- `docLabel()` gets `if (d.kind === "interview-prep") return "Interview prep";` before the artifact branch
- Markdown render path already handles it: the `else` branch (not cv, not artifact) fetches and renders via `renderMarkdown()` — no other changes needed

`download-pack/route.ts`:
- `filenameFor()` switch gets `case "interview-prep"` returning `{ filename: "interview-prep.md", description: "interview-prep.md — interview prep (phone screen, HM, case, culture-fit)", binary: false, url }`

## Regenerate Semantics

Manual regenerate via GeneratePanel POSTs to `/api/generate/interview-prep/:jobId`. The route calls `deleteInterviewPrep(app.id)` unconditionally before generating, so:
- Old blob is deleted from Vercel Blob storage
- Old DB row(s) are deleted
- Fresh generation runs, version resets to v1 (since no prior rows exist at insert time)

This matches the "delete old blob + row first, then create fresh" decision. Version always comes back as 1 after a regenerate (not incrementing), which is correct — there is only ever one authoritative prep doc per application.

Auto-trigger on status transition skips generation if a doc already exists, so it does not delete-and-regenerate on repeated "interview" transitions.

## Deviations from Plan

None — plan executed exactly as written.

The observability suggestion from the Vercel plugin validator (add logging/error tracking to route handlers) is a pre-existing pattern across all generate routes; applying it to only this route would be inconsistent. Deferred to a cross-cutting concern if needed.

## Self-Check

- `src/lib/generate/interview-prep.ts` exists and exports `generateInterviewPrep`
- `src/lib/generate/storage.ts` exports `storeInterviewPrep` and `deleteInterviewPrep`
- `src/app/api/generate/interview-prep/[jobId]/route.ts` exists
- `npx tsc --noEmit` clean
- `npm run build` clean, route appears in build output as `ƒ /api/generate/interview-prep/[jobId]`

## Self-Check: PASSED
