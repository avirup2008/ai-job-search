# Phase 15: Candidate Intelligence UI - Research

**Researched:** 2026-04-17
**Domain:** Next.js App Router UI, server-side PDF generation, zero-cost prompt assembly
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R-85 | Profile Gap Coach: page or panel listing T2 jobs ranked by closeness to T1, with specific keywords and profile fields holding each back | `jobs.fitScore`, `jobs.fitBreakdown`, `jobs.gapAnalysis` already store all needed data. T2 = fitScore 65–85. "Closeness to T1" = (85 - fitScore). `gapAnalysis.gaps` lists the specific blocking signals per job. No schema change needed. |
| R-86 | Interview research prompt: when application is in "interview" status, show a structured prompt (company name + role + JD + dossier) with one-click copy; zero API cost | All constituent data is already loaded on the job detail page: `job.title`, `job.jdText`, `company.name`, `company.researchJson` (dossier). Prompt is assembled client-side or server-side as a string. No LLM call. |
| R-89 | Pre-interview brief PDF: download combining existing interview-prep document and company dossier for any job in "interview" status; formatting only, no new generation | Interview-prep markdown is stored in Vercel Blob via `documents` table (`kind="interview-prep"`, URL in `blobUrlDocx`). Company dossier is in `companies.researchJson`. New API route fetches both, formats to PDF using `pdf-lib` (already resolvable as a dependency). |
</phase_requirements>

---

## Summary

Phase 15 adds three candidate-facing intelligence features. All three are purely presentational — no new LLM calls, no new data generation, no schema changes required.

**R-85 (Gap Coach):** T2 jobs (fitScore 65–85) are already fully scored with `fitBreakdown` and `gapAnalysis` in the database. The `gapAnalysis.gaps` array (up to 4 strings) already describes the specific blocking signals per job. The planner needs to decide whether Gap Coach is a standalone route (`/gap-coach`) or a filter tab on the existing `/inbox` page. Research favors a dedicated route to avoid cluttering the inbox tab bar.

**R-86 (Interview Research Prompt):** The job detail page (`/inbox/[jobId]`) already loads all needed data: job title, JD text, company name, and company dossier (`researchJson`). The only new work is (a) detecting `application.status === "interview"` on the detail page and (b) rendering a text block with a copy button. This is a client component with `navigator.clipboard.writeText`. Zero API cost confirmed.

**R-89 (Pre-interview PDF):** The existing `download-pack` route (`/api/download-pack/[jobId]`) creates a ZIP with JSZip. The pre-interview PDF is a different shape: a single formatted PDF combining the interview-prep markdown and the dossier narrative. No PDF library is currently in `package.json`. `pdf-lib` (v1.17.1, confirmed on npm registry) is the correct choice — pure JavaScript, no headless Chrome, runs in Vercel's Node.js runtime. `@react-pdf/renderer` (v4.5.1) is an alternative but adds significant bundle weight and is overkill for markdown-to-PDF.

**Primary recommendation:** Three plans. Plan 1: Gap Coach route and data query. Plan 2: Interview research prompt panel on job detail page. Plan 3: Pre-interview brief PDF API route + download button.

---

## Data Availability Audit

### What's already in the DB for each feature

#### R-85 Gap Coach

```typescript
// Source: src/db/schema.ts + src/lib/pipeline/tier.ts
// T2 jobs: fitScore >= 65 AND fitScore < 85 (tier = 2)
// gapAnalysis JSONB shape (stored by orchestrator.ts and rescore.ts):
type GapAnalysis = {
  strengths: string[];        // up to 4 — what matched
  gaps: string[];             // up to 4 — what blocked T1
  recommendation: string;     // "apply_with_caveat" | "stretch" etc.
  recommendationReason: string;
};

// fitBreakdown JSONB shape (FitComponents from rank.ts):
type FitBreakdown = {
  skills: number;    // 0..1 — 40% weight
  tools: number;     // 0..1 — 30% weight
  seniority: number; // 0..1 — 15% weight
  industry: number;  // 0..1 — 15% weight
};
```

**"Closeness to T1" metric:** `85 - fitScore`. A T2 job with fitScore 84 is 1 point from T1; one with fitScore 65 is 20 points away. Sort ascending by `(85 - fitScore)`.

**What gapAnalysis.gaps contains:** Natural-language strings such as "No Braze experience in profile" or "3+ years B2B SaaS experience not demonstrated". These are produced by Haiku and stored verbatim. They directly answer "what's holding this job back."

**Limitation:** `gapAnalysis` does NOT store a structured list of missing keywords separate from the ATS pass. The ATS keyword pass (R-84) operates on the generated CV, not on scoring. The gap analysis strings are descriptive, not keyword-tagged. This is sufficient for R-85 as written — the requirement says "specific keywords and profile fields", and the `gaps` strings do name specific tools/skills. [VERIFIED: codebase grep]

#### R-86 Interview Research Prompt

```typescript
// Source: src/app/(app)/inbox/[jobId]/page.tsx loadDetail()
// All of the following are loaded on the job detail page:
const detail = {
  job: {
    title: string,
    jdText: string,    // up to 6000 chars used in prompts
    location: string,
  },
  company: {
    name: string,
    researchJson: DossierData,  // see Dossier type below
  },
  application: {
    status: string,    // "new"|"saved"|"applied"|"interview"|"offer"|"rejected"
  },
};

// Dossier shape (src/lib/research/types.ts):
type Dossier = {
  productOneLiner: string;
  stage: "startup"|"scale-up"|"mid-market"|"enterprise"|"unknown";
  marketingStack: string[];
  industry: string;
  narrative: string;         // 500-800 word narrative
  hqLocation: string | null;
  employeeSize: string | null;
  recentNews: string[];
  cultureSignals: string[];
  lowSignal: boolean;
};
```

**Key finding:** `application.status` is NOT currently loaded on the job detail page. The `loadDetail()` function fetches the application row (to get documents) but does not return the status field. The detail page would need to surface `application?.status` to conditionally render the interview prompt panel. This is a one-line addition to the `loadDetail()` return. [VERIFIED: codebase read]

#### R-89 Pre-interview PDF

```typescript
// Interview-prep document (src/lib/generate/storage.ts storeInterviewPrep):
// - Stored as markdown in Vercel Blob
// - DB row: documents.kind = "interview-prep", documents.blobUrlDocx = <blob URL>
// - Fetched the same way as other docs in loadDetail()

// Company dossier:
// - companies.researchJson — already a JSON object
// - Contains: productOneLiner, stage, narrative, marketingStack, recentNews, cultureSignals
```

**No PDF library exists in the project.** JSZip is present (as a transitive dep, used in download-pack route) but only produces ZIPs. `pdf-lib` must be added. [VERIFIED: package.json + node_modules check]

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Relevant to Phase |
|---------|---------|---------|-------------------|
| Next.js 16 App Router | 16.2.3 | Routing, server components, server actions | Gap Coach route, detail page extension |
| Drizzle ORM | 0.45.2 | DB queries | Gap Coach data query |
| `@vercel/blob` | 2.3.3 | Blob storage read | Fetch interview-prep markdown for PDF |
| React 19 | 19.2.5 | Client components | Copy button, interview prompt panel |
| Vitest | 2.x | Unit tests | Prompt assembly, PDF route tests |

### New Dependency Required

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `pdf-lib` | 1.17.1 | PDF creation from scratch in Node.js | Combine interview-prep markdown + dossier into a single downloadable PDF; pure JS, no headless Chrome, works in Vercel Node.js runtime; small bundle |

**Installation:**
```bash
npm install pdf-lib
```

**Version verification:** `npm view pdf-lib version` returns `1.17.1` as of research date. [VERIFIED: npm registry]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pdf-lib` | `@react-pdf/renderer` | react-pdf is React-component-based, much larger, requires JSX render pipeline; overkill for simple text layout |
| `pdf-lib` | Puppeteer/Playwright headless Chrome | Requires chrome binary, not viable on Vercel serverless functions without paying for extra compute |
| `pdf-lib` | `pdfkit` | pdfkit is Node-only and streams-based; works but `pdf-lib` has cleaner API for static layout |

---

## Architecture Patterns

### Recommended Project Structure for Phase 15

```
src/
├── app/(app)/
│   ├── gap-coach/
│   │   └── page.tsx               # R-85: standalone Gap Coach page
│   └── inbox/[jobId]/
│       └── page.tsx               # R-86: extend with InterviewPromptPanel
├── app/api/
│   └── interview-brief/[jobId]/
│       └── route.ts               # R-89: PDF download endpoint
├── components/
│   ├── job-detail/
│   │   └── InterviewPromptPanel.tsx  # R-86: copy-prompt client component
│   └── gap-coach/
│       ├── GapCoachList.tsx          # R-85: ranked T2 job list
│       └── gap-coach.css
```

### Pattern 1: Gap Coach Data Query (R-85)

**What:** Server component page that queries T2 jobs sorted by closeness-to-T1.

```typescript
// Source: inferred from existing inbox/page.tsx query pattern
// [ASSUMED: exact SQL — not yet written]
const t2Jobs = await db
  .select({
    id: schema.jobs.id,
    title: schema.jobs.title,
    companyName: schema.companies.name,
    fitScore: schema.jobs.fitScore,
    fitBreakdown: schema.jobs.fitBreakdown,
    gapAnalysis: schema.jobs.gapAnalysis,
  })
  .from(schema.jobs)
  .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
  .where(
    and(
      eq(schema.jobs.tier, 2),       // T2 only
      // fitScore 65-85 is implicit from tier=2
    ),
  )
  .orderBy(desc(schema.jobs.fitScore))  // highest fitScore first = closest to T1
  .limit(50);
```

**Note on tier vs fitScore:** Tier is stored as `smallint` directly. Querying `tier = 2` is more reliable than filtering on `fitScore` range, since the tier boundary in `tier.ts` is `fitScore >= 85` for T1, so any `tier=2` job is definitionally below T1. Sort by `fitScore DESC` to show closest-to-T1 first.

### Pattern 2: Interview Research Prompt Assembly (R-86)

**What:** Client component that displays a pre-assembled prompt string with clipboard copy. No API call.

```typescript
// Source: assembled from job detail page data + R-86 requirement
// [ASSUMED: exact prompt text — needs planner to finalize wording]
function assembleResearchPrompt(params: {
  companyName: string;
  role: string;
  jdText: string;
  dossier: DossierData;
}): string {
  return [
    `I have an interview for a ${params.role} role at ${params.companyName}.`,
    `Here is the job description:\n\n${params.jdText.slice(0, 3000)}`,
    ``,
    `Company context:`,
    `- What they do: ${params.dossier?.productOneLiner ?? "unknown"}`,
    `- Stage: ${params.dossier?.stage ?? "unknown"}`,
    `- Industry: ${params.dossier?.industry ?? "unknown"}`,
    params.dossier?.narrative ? `- Background: ${params.dossier.narrative.slice(0, 500)}` : "",
    ``,
    `Please help me prepare for this interview by:`,
    `1. Identifying the top 5 questions I'm likely to be asked`,
    `2. Suggesting what to research about ${params.companyName} before the interview`,
    `3. Flagging any red flags or opportunities in the JD I should address`,
  ].filter(Boolean).join("\n");
}
```

**Clipboard copy pattern:**
```typescript
// "use client" component using navigator.clipboard.writeText
async function handleCopy() {
  await navigator.clipboard.writeText(prompt);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}
```

### Pattern 3: Pre-interview PDF Generation (R-89)

**What:** GET endpoint fetches interview-prep markdown from Vercel Blob + dossier from DB, formats both into a single PDF with `pdf-lib`, returns as `application/pdf`.

```typescript
// Source: download-pack route pattern + pdf-lib API
// [ASSUMED: exact pdf-lib API calls — planner should verify against pdf-lib docs]
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  // 1. Load job, company, application, documents from DB
  // 2. Find interview-prep doc (kind="interview-prep"), fetch markdown from blobUrlDocx
  // 3. Load company.researchJson as dossier
  // 4. Create PDF, write formatted sections
  // 5. Return as application/pdf attachment
}
```

**Key pdf-lib facts:**
- Create doc: `PDFDocument.create()`
- Add page: `doc.addPage([595.28, 841.89])` (A4)
- Embed font: `await doc.embedFont(StandardFonts.Helvetica)`
- Draw text: `page.drawText(text, { x, y, size, font, color })`
- Serialize: `const pdfBytes = await doc.save()`
- [CITED: https://pdf-lib.js.org/#create-document]

**Markdown → PDF strategy:** Interview-prep markdown is structured (headers, bullets, paragraphs). For Phase 15, a simple line-by-line renderer is sufficient — detect `##` headers, `- ` bullets, blank lines. No need for a full markdown parser. This matches the "formatting only, no new generation" constraint.

### Anti-Patterns to Avoid

- **Don't load the full 6000-char JD into the prompt assembly client-side:** Pass the first 3000 chars to keep the assembled prompt usable when pasted into Claude.ai. The full JD is available server-side if needed.
- **Don't gate the Gap Coach behind application status:** Gap Coach is for discovery jobs (T2 from the `jobs` table), not necessarily jobs with applications. Many T2 jobs won't have an application row yet.
- **Don't add a new DB column for "interview status":** Status is already tracked in `applications.status`. The field is already populated by `updateApplicationStatus()` in `pipeline/actions.ts`.
- **Don't use Puppeteer for PDF:** Not viable on Vercel serverless functions. `pdf-lib` is the correct choice.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard copy | Custom focus-trap + execCommand | `navigator.clipboard.writeText()` | Browser standard, handles permissions |
| PDF layout | Custom byte-level PDF assembly | `pdf-lib` | Handles page sizing, text wrapping, encoding |
| T2 job ranking | Custom scoring re-calculation | Use stored `fitScore` from DB | Already calculated and stored; re-computing would require LLM call |

---

## Common Pitfalls

### Pitfall 1: application.status not available on job detail page
**What goes wrong:** The `loadDetail()` function in `inbox/[jobId]/page.tsx` loads the application row but only uses it to get documents. The `status` field is not returned/exposed.
**Why it happens:** The detail page was built before interview-status features were needed.
**How to avoid:** Add `status: application?.status ?? null` to the return object of `loadDetail()`. Pass it as a prop to `GeneratePanel` and the new `InterviewPromptPanel`.
**Warning signs:** `application.status` will be `undefined` if not explicitly returned.

### Pitfall 2: Dossier may be null for jobs without company research
**What goes wrong:** If `job.companyId` is null or `company.researchJson` is null, the interview prompt and PDF will fail to include dossier data.
**Why it happens:** Company research runs asynchronously; new jobs may not have a dossier yet.
**How to avoid:** All dossier usage must null-check. For the PDF: include a "Company research not available" placeholder section. For the prompt: omit the dossier section gracefully.

### Pitfall 3: Interview-prep document may not exist yet when user clicks "Download brief"
**What goes wrong:** If no `kind="interview-prep"` document exists for the application, the PDF download endpoint returns 404.
**Why it happens:** Interview prep auto-generates when status transitions to "interview" (via `updateApplicationStatus`), but there's a race condition between status update and document storage. Also, older jobs may have been manually set to "interview" without triggering the auto-gen.
**How to avoid:** The PDF endpoint should return a graceful error (or a partial PDF with just the dossier) when the interview-prep doc is missing. The UI should show a "Generate interview prep first" message rather than a broken download link.

### Pitfall 4: pdf-lib text wrapping is manual
**What goes wrong:** pdf-lib does not auto-wrap long lines. Text drawn past the page width is clipped.
**Why it happens:** pdf-lib is a low-level library — it draws text at coordinates.
**How to avoid:** Implement a simple word-wrap function that splits text at ~80 chars per line, advancing the Y cursor for each line. The page is 595pt wide; at ~12pt font and 1:0.6 char aspect ratio, ~70-80 chars fit per line at 6pt left/right margin.

### Pitfall 5: Gap Coach shows stale data if fitScore was never calculated
**What goes wrong:** Jobs without a `fitScore` (newly discovered, not yet scored) have `tier = null` and would be excluded from the Gap Coach.
**Why it happens:** The nightly cron scores all discovered jobs, but jobs pasted via the paste-JD flow may not have been scored yet.
**How to avoid:** Filter on `tier = 2` (not just `fitScore BETWEEN 65 AND 85`) so unscored jobs don't appear. Add a null-guard on the display.

---

## Code Examples

### Gap Coach DB query
```typescript
// Verified pattern: follows existing inbox/page.tsx query structure
// [VERIFIED: codebase read — inbox/page.tsx uses same join/where/orderBy pattern]
const t2Jobs = await db
  .select({
    id: schema.jobs.id,
    title: schema.jobs.title,
    location: schema.jobs.location,
    source: schema.jobs.source,
    fitScore: schema.jobs.fitScore,
    fitBreakdown: schema.jobs.fitBreakdown,
    gapAnalysis: schema.jobs.gapAnalysis,
    companyName: schema.companies.name,
  })
  .from(schema.jobs)
  .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
  .where(eq(schema.jobs.tier, 2))
  .orderBy(desc(schema.jobs.fitScore))
  .limit(50);
```

### InterviewPromptPanel — copy button pattern
```typescript
// "use client"
// [VERIFIED: navigator.clipboard is standard Web API available in Chrome/Safari/Firefox]
const [copied, setCopied] = useState(false);

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // Fallback: select a textarea
  }
}
```

### PDF route structure
```typescript
// [ASSUMED: pdf-lib API — planner must verify against https://pdf-lib.js.org]
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const pdfDoc = await PDFDocument.create();
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

const page = pdfDoc.addPage([595.28, 841.89]); // A4
const { height } = page.getSize();
let y = height - 50; // top margin

// Draw title
page.drawText(`Interview Brief: ${job.title} @ ${companyName}`, {
  x: 50, y, size: 16, font: boldFont, color: rgb(0, 0, 0),
});
y -= 30;

// ... iterate sections, wrap lines, add new pages as needed

const pdfBytes = await pdfDoc.save();
return new NextResponse(pdfBytes, {
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="interview-brief.pdf"`,
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Headless Chrome for PDF | `pdf-lib` pure JS | Viable on Vercel serverless; no binary required |
| `navigator.clipboard` requires HTTPS | Yes, but Vercel deploys are always HTTPS | No issue in production; may need fallback for localhost dev |

---

## Application Status Flow (Key Finding)

The application status state machine is:
```
new → saved → applied → interview → offer | rejected
```

Status transitions happen via `updateApplicationStatus()` in `src/app/(app)/pipeline/actions.ts`. When status moves to `"interview"`, the action auto-generates interview-prep if not already present.

**Where the status transition happens:** The `PipelineCard` component (`src/components/pipeline/PipelineCard.tsx`) renders a `<select>` dropdown for each application in the pipeline. Status can also be changed from the pipeline page focus card.

**Key implication for R-86:** The interview research prompt should appear on the job detail page (`/inbox/[jobId]`) conditional on `application.status === "interview"`. This means the job must already have an application row and that row must be in "interview" status. The detail page currently loads the application row but does not expose its `status` — one-line fix needed.

**Key implication for R-89:** The PDF download button should similarly be gated on `application.status === "interview"`. The API route itself should validate status server-side.

---

## Open Questions (RESOLVED)

1. **Gap Coach UI placement: standalone page vs inbox tab**
   - RESOLVED: Standalone `/gap-coach` page with nav link in app shell. Keeps inbox clean; existing `/inbox/[jobId]` route serves job detail navigation from gap-coach rows.

2. **Navigation shell: where to add the Gap Coach link**
   - RESOLVED: Nav items are an array in `src/components/app-shell/TopBar.tsx`. New nav entry added after analytics link: `{ href: "/gap-coach", label: "Gap Coach" }`.

3. **Interview-prep document format: is it always markdown?**
   - RESOLVED: Always markdown. `storeInterviewPrep` stores markdown via `blobUrlDocx` (column repurposed, consistent with cover letter pattern). Fetch blob URL, `res.text()` to get markdown, parse into sections for PDF layout.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `pdf-lib` | R-89 PDF download | Not yet installed | 1.17.1 (npm) | None — must be added |
| `navigator.clipboard` | R-86 copy button | Browser API | Standard | Textarea select fallback |
| Vercel Blob read | R-89 fetch interview-prep markdown | Already used | `@vercel/blob` 2.3.3 | None needed |
| Neon DB (jobs, companies, applications, documents tables) | All features | Production and local dev | Drizzle 0.45.2 | None needed |

**Missing dependencies with no fallback:**
- `pdf-lib` must be added via `npm install pdf-lib` before the PDF route can be built.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/unit/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R-85 | Gap Coach query returns T2 jobs sorted by fitScore desc | unit | `npx vitest run tests/unit/gap-coach.test.ts` | No — Wave 0 |
| R-86 | `assembleResearchPrompt()` includes all required fields | unit | `npx vitest run tests/unit/research-prompt.test.ts` | No — Wave 0 |
| R-86 | Prompt omits dossier gracefully when null | unit | same file | No — Wave 0 |
| R-89 | PDF route returns 404 when no interview-prep doc exists | smoke/manual | manual test via curl | No |
| R-89 | PDF route returns `application/pdf` with non-zero body | smoke/manual | manual test via curl | No |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/gap-coach.test.ts` — covers R-85 data shape and sort order
- [ ] `tests/unit/research-prompt.test.ts` — covers R-86 prompt assembly, null-dossier case

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `isAdmin()` guard already on all server actions; PDF route must also guard |
| V4 Access Control | yes | PDF download must verify the job's application status server-side — don't trust client-side status |
| V5 Input Validation | yes | `jobId` is a UUID from URL params; validate with `eq(schema.jobs.id, jobId)` — Drizzle parameterizes |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on PDF download | Elevation of privilege | Single-user app; `isAdmin()` check is sufficient; validate jobId resolves to a real job |
| Prompt injection via JD text in research prompt | Tampering | Not applicable — prompt is pasted by user into Claude.ai manually; not sent to any API |
| Large blob fetch blocking the PDF route | DoS | Set `maxDuration = 30` on the route; interview-prep markdown is typically 2-4KB |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gap Coach route should be `/gap-coach` (standalone), not an inbox tab | Architecture Patterns | If planner or user prefers a tab, route path changes; component structure is the same |
| A2 | `pdf-lib` 1.17.1 API includes `PDFDocument.create()`, `embedFont()`, `drawText()` with the shown signatures | Code Examples | If API differs, planner must adjust task instructions; risk is low — pdf-lib API is stable |
| A3 | The interview research prompt should truncate JD at ~3000 chars for usability in Claude.ai | Code Examples | If user wants full JD in prompt, remove truncation; no technical impact |
| A4 | Nav shell add-link is straightforward (not a complex navigation framework) | Open Questions | If app-shell nav is more complex, the planner needs to read app-shell component before writing task |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/db/schema.ts` — verified jobs, applications, documents, companies table shapes
- Codebase: `src/lib/pipeline/tier.ts` — verified T1 boundary is `fitScore >= 85`, T2 is `65 <= fitScore < 85`
- Codebase: `src/lib/pipeline/orchestrator.ts` + `src/lib/profile/rescore.ts` — verified `gapAnalysis` stored fields: `strengths`, `gaps`, `recommendation`, `recommendationReason`
- Codebase: `src/app/(app)/inbox/[jobId]/page.tsx` — verified detail page loads company dossier, application row; confirmed `status` is NOT currently returned from `loadDetail()`
- Codebase: `src/app/(app)/pipeline/actions.ts` — verified `updateApplicationStatus()` auto-generates interview prep when status = "interview"
- Codebase: `src/lib/generate/storage.ts` — verified interview-prep markdown stored in `blobUrlDocx` column with `kind="interview-prep"`
- Codebase: `src/lib/research/types.ts` — verified `Dossier` type shape
- Codebase: `package.json` + `node_modules/` — confirmed no PDF library currently installed; `pdf-lib` available on npm at v1.17.1

### Secondary (MEDIUM confidence)
- [npm registry: pdf-lib] — `npm view pdf-lib version` returns `1.17.1` [VERIFIED: npm registry]
- [npm registry: @react-pdf/renderer] — v4.5.1 available but heavier than needed [VERIFIED: npm registry]

### Tertiary (LOW confidence)
- [pdf-lib docs: https://pdf-lib.js.org] — API signatures for `PDFDocument.create()`, `drawText()` assumed from training knowledge; planner should verify exact method signatures against official docs before writing task actions

---

## Metadata

**Confidence breakdown:**
- Gap Coach data layer: HIGH — all data verified in DB schema and scoring code
- Interview prompt assembly: HIGH — all source data verified on existing detail page
- PDF generation approach: MEDIUM — `pdf-lib` library choice is sound; exact API needs verification against current docs before implementation
- Application status flow: HIGH — verified in pipeline/actions.ts and PipelineCard.tsx

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (stable stack; no fast-moving dependencies except pdf-lib API details)
