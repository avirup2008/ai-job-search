# LinkedIn Profile Optimizer — Execution Plan

**Task ID:** 260418-dd27  
**Date:** 2026-04-18  
**Spec:** `docs/superpowers/specs/2026-04-18-linkedin-optimizer-design.md`

---

## Overview

Build the LinkedIn Profile Optimizer as a second tab within `/profile`. PDF upload triggers one Sonnet call (claude-sonnet-4-5) that returns structured rewrites for headline, about, top-3 experience roles, and skills — each with reasoning. Result stored in a new `linkedin_optimizations` table (single row, overwrite on re-upload). UI shows rewrite text + one-click copy + reasoning beneath each section.

**Design system:** Warm parchment `#F7F5F0`, Forest Green `#1D4A35`, warm borders `#E4E0D8`. Use existing CSS variables: `var(--surface)`, `var(--border)`, `var(--accent)`, `var(--text-2)`, `var(--font-display)`. CSS classes go in `profile.css` following the existing `.profile-*` naming pattern.

---

## Task 1 — Install dependency + write migration SQL

**Files:**
- `src/db/migrations/0005_linkedin_optimizations.sql` (create)

**Actions:**

1. From the project root, run:
   ```bash
   npm install pdf-parse
   npm install --save-dev @types/pdf-parse
   ```
   Verify both appear in `package.json`.

2. Create `src/db/migrations/0005_linkedin_optimizations.sql`:
   ```sql
   -- Migration: linkedin_optimizations table for LinkedIn Profile Optimizer
   CREATE TABLE IF NOT EXISTS linkedin_optimizations (
     id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     created_at timestamptz NOT NULL DEFAULT now(),
     raw_text   text NOT NULL,
     rewrites   jsonb NOT NULL,
     token_cost numeric(10,6),
     model      text
   );
   ```

3. Add `pdf-parse` to `serverExternalPackages` in `next.config.ts` NOW (before any testing). This is required unconditionally — without it, Next.js will fail to bundle `pdf-parse`'s native deps at Vercel build time. Read `next.config.ts` first, then add `serverExternalPackages: ["pdf-parse"]` inside the config object.

4. Apply the migration against Neon. The `neon()` client from `@neondatabase/serverless` is a tagged-template function — call it directly as `sql(ddl)` with the raw SQL string. Do NOT use `sql.unsafe()` (that is a Drizzle ORM method, not a Neon client method):
   ```bash
   node --input-type=module << 'EOF'
   import { neon } from '@neondatabase/serverless';
   import { readFileSync } from 'fs';
   import { config } from 'dotenv';
   config({ path: '.env.local' });
   const sql = neon(process.env.DATABASE_URL);
   const ddl = readFileSync('src/db/migrations/0005_linkedin_optimizations.sql', 'utf8');
   await sql(ddl);
   console.log('Migration applied');
   EOF
   ```
   If `.env.local` does not exist, run `vercel env pull .env.local` first.

**Verify:** `psql $DATABASE_URL -c "\d linkedin_optimizations"` shows the table with 6 columns, OR run `SELECT COUNT(*) FROM linkedin_optimizations;` — 0 rows, no error.

---

## Task 2 — Add schema definition to Drizzle

**Files:**
- `src/db/schema.ts` (modify)

**Actions:**

Add `linkedinOptimizations` table to `src/db/schema.ts`. The imports line already has `numeric` and `timestamp` and `jsonb` and `text` and `uuid` — confirm before adding. Append after the `llmBudget` table definition:

```typescript
export const linkedinOptimizations = pgTable("linkedin_optimizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  rawText: text("raw_text").notNull(),
  rewrites: jsonb("rewrites").$type<LinkedinRewrites>().notNull(),
  tokenCost: numeric("token_cost", { precision: 10, scale: 6 }),
  model: text("model"),
});
```

Also add the `LinkedinRewrites` type (before the table, or in a types file — inline is fine since it's only used here):

```typescript
export type LinkedinRewriteSection = { text: string; reasoning: string };
export type LinkedinExperienceSection = {
  company: string;
  role: string;
  bullets: string[];
  reasoning: string;
};
export type LinkedinRewrites = {
  headline: LinkedinRewriteSection;
  about: LinkedinRewriteSection;
  experience: LinkedinExperienceSection[];
  skills: LinkedinRewriteSection;
};
```

**Verify:** `npx tsc --noEmit` passes with no new type errors.

---

## Task 3 — PDF extraction + Sonnet optimization library modules

**Files:**
- `src/lib/linkedin/extract.ts` (create)
- `src/lib/linkedin/optimize.ts` (create)

**Actions:**

**`src/lib/linkedin/extract.ts`** — PDF text extraction:
```typescript
import pdfParse from "pdf-parse";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text.trim();
}
```

Note: `pdf-parse` is added to `serverExternalPackages` in Task 1 (unconditional). This prevents Next.js bundler errors on Vercel.

**`src/lib/linkedin/optimize.ts`** — Sonnet call + structured output. Returns `{ rewrites, tokenCost }` so the API route captures cost from the **single** Sonnet call (no separate probe call):

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { LinkedinRewrites } from "@/db/schema";

const SYSTEM_PROMPT = `You are a LinkedIn profile specialist for the Netherlands digital marketing and marketing automation market.

Your job is to rewrite the candidate's LinkedIn profile sections to maximise recruiter discoverability — not creativity. Optimise for the terms that NL recruiters actually search: HubSpot, CRM, Marketing Automation, email marketing, lifecycle marketing, Salesforce, Pardot, Google Analytics.

Rules:
- Ground every suggestion in the candidate's actual profile. Do not fabricate experience, titles, companies, or metrics.
- Lead each section with the most-searched term relevant to the candidate.
- Headline: one line, 120 chars max, keyword-rich, include NL market signal.
- About: 3-5 sentences, open with the most-searched term, position as specialist not generalist.
- Experience: rewrite 2-3 bullets per role — outcome-focused, metric-forward, tool names prominent.
- Skills: reorder to front-load the most-searched terms in the NL marketing automation market.
- Anti-AI language rules (STRICT): no em-dashes, never use "leverage", never use "dynamic", no negative parallelisms ("not X but Y").
- Output ONLY valid JSON matching the schema below. No preamble, no explanation, no markdown fences.

JSON schema:
{
  "headline": { "text": string, "reasoning": string },
  "about": { "text": string, "reasoning": string },
  "experience": [{ "company": string, "role": string, "bullets": string[], "reasoning": string }],
  "skills": { "text": string, "reasoning": string }
}`;

export type OptimizeResult = {
  rewrites: LinkedinRewrites;
  tokenCost: number;
};

export async function optimizeLinkedinProfile(rawText: string): Promise<OptimizeResult> {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2500,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the candidate's LinkedIn profile PDF text:\n\n${rawText}\n\nRewrite headline, about, top 3 experience sections (bullet points), and skills.\nReturn JSON only. No preamble.`,
      },
    ],
  });

  const raw = message.content[0];
  if (raw.type !== "text") {
    throw new Error("Unexpected response type from Sonnet");
  }

  // Strip markdown fences if model adds them despite instructions
  const jsonString = raw.text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  const parsed = JSON.parse(jsonString) as LinkedinRewrites;

  // Basic shape validation
  if (!parsed.headline?.text || !parsed.about?.text || !Array.isArray(parsed.experience) || !parsed.skills?.text) {
    throw new Error("Sonnet response missing required fields");
  }

  // Capture cost from this single call (claude-sonnet-4-5: $3/M input, $15/M output)
  const inputCost = (message.usage.input_tokens / 1_000_000) * 3;
  const outputCost = (message.usage.output_tokens / 1_000_000) * 15;
  const tokenCost = inputCost + outputCost;

  return { rewrites: parsed, tokenCost };
}
```

**Verify:** `npx tsc --noEmit` passes. No runtime test needed at this stage — covered by API route test in Task 4.

---

## Task 4 — POST API route

**Files:**
- `src/app/api/linkedin/optimize/route.ts` (create)

**Actions:**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { sql } from "drizzle-orm";
import { extractPdfText } from "@/lib/linkedin/extract";
import { optimizeLinkedinProfile } from "@/lib/linkedin/optimize";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("pdf");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "No PDF file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ ok: false, error: "File must be a PDF" }, { status: 400 });
    }

    // Extract text
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawText: string;
    try {
      rawText = await extractPdfText(buffer);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Could not read PDF — try re-exporting from LinkedIn" },
        { status: 422 }
      );
    }

    if (rawText.length < 500) {
      return NextResponse.json(
        { ok: false, error: "PDF appears empty or too short" },
        { status: 422 }
      );
    }

    // Call Sonnet — single call, cost captured from usage in the response
    let rewrites;
    let tokenCost: number;
    try {
      const result = await optimizeLinkedinProfile(rawText);
      rewrites = result.rewrites;
      tokenCost = result.tokenCost;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Generation failed — try again" },
        { status: 500 }
      );
    }

    // Upsert: DELETE existing + INSERT new (single-user app, one optimization stored)
    // Explicit WHERE TRUE avoids Drizzle's "missing where clause" guard on unconditional deletes
    await db.delete(schema.linkedinOptimizations).where(sql`TRUE`);
    const [inserted] = await db
      .insert(schema.linkedinOptimizations)
      .values({
        rawText,
        rewrites,
        tokenCost: String(tokenCost),
        model: "claude-sonnet-4-5",
      })
      .returning();

    return NextResponse.json({ ok: true, id: inserted.id, rewrites });
  } catch (err) {
    console.error("[linkedin/optimize] unexpected error", err);
    return NextResponse.json({ ok: false, error: "Unexpected server error" }, { status: 500 });
  }
}
```

**Verify:** Start dev server (`npm run dev`). From another terminal:
```bash
# Should return 400
curl -X POST http://localhost:3000/api/linkedin/optimize \
  -H "Content-Type: application/json" -d '{}' | jq .
# Expected: { "ok": false, "error": "No PDF file provided" }
```

---

## Task 5 — CopyButton client component

**Files:**
- `src/components/linkedin/CopyButton.tsx` (create)

**Actions:**

```tsx
"use client";

import { useState } from "react";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers / file:// contexts
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`linkedin-copy-btn${copied ? " linkedin-copy-btn--copied" : ""}${className ? ` ${className}` : ""}`}
      aria-label={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
```

Add CSS to `src/components/profile/profile.css`:
```css
/* LinkedIn Optimizer — CopyButton */
.linkedin-copy-btn {
  font-size: 12px;
  font-family: var(--font-sans, inherit);
  padding: 4px 10px;
  border: 1px solid var(--border, #E4E0D8);
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.linkedin-copy-btn:hover {
  background: var(--surface, #F7F5F0);
}
.linkedin-copy-btn--copied {
  background: var(--accent, #1D4A35);
  color: #fff;
  border-color: var(--accent, #1D4A35);
}
```

**Verify:** Component renders without TS errors (`npx tsc --noEmit`).

---

## Task 6 — OptimizerPanel client component

**Files:**
- `src/components/linkedin/OptimizerPanel.tsx` (create)

**Actions:**

This is the main client component. It handles two states: upload state (no data) and loaded state (rewrites exist). It also handles the upload flow with a loading spinner.

```tsx
"use client";

import { useState, useRef } from "react";
import { CopyButton } from "./CopyButton";
import type { LinkedinRewrites } from "@/db/schema";

interface OptimizerPanelProps {
  initial: {
    rewrites: LinkedinRewrites;
    createdAt: string; // ISO string
  } | null;
}

function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

export function OptimizerPanel({ initial }: OptimizerPanelProps) {
  const [rewrites, setRewrites] = useState<LinkedinRewrites | null>(initial?.rewrites ?? null);
  const [createdAt, setCreatedAt] = useState<string | null>(initial?.createdAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const res = await fetch("/api/linkedin/optimize", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setRewrites(data.rewrites);
        setCreatedAt(new Date().toISOString());
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so re-uploading same file triggers onChange
    e.target.value = "";
  }

  // Loaded state
  if (rewrites && !loading) {
    return (
      <div className="linkedin-panel">
        <div className="linkedin-panel-meta">
          <span className="linkedin-last-optimised">
            Last optimised {createdAt ? timeAgo(createdAt) : "—"}
          </span>
          <button
            type="button"
            className="btn btn-ghost linkedin-reupload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Re-upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>

        {error && <p className="linkedin-error">{error}</p>}

        {/* Headline */}
        <section className="linkedin-section">
          <div className="linkedin-section-header">
            <h3 className="linkedin-section-title">Headline</h3>
          </div>
          <div className="linkedin-rewrite-row">
            <p className="linkedin-rewrite-text">{rewrites.headline.text}</p>
            <CopyButton text={rewrites.headline.text} />
          </div>
          <p className="linkedin-reasoning">{rewrites.headline.reasoning}</p>
        </section>

        {/* About */}
        <section className="linkedin-section">
          <div className="linkedin-section-header">
            <h3 className="linkedin-section-title">About</h3>
          </div>
          <div className="linkedin-rewrite-row linkedin-rewrite-row--block">
            <p className="linkedin-rewrite-text">{rewrites.about.text}</p>
            <CopyButton text={rewrites.about.text} />
          </div>
          <p className="linkedin-reasoning">{rewrites.about.reasoning}</p>
        </section>

        {/* Experience */}
        {rewrites.experience.map((exp, i) => (
          <section key={i} className="linkedin-section">
            <div className="linkedin-section-header">
              <h3 className="linkedin-section-title">
                Experience — {exp.company}
              </h3>
              <span className="linkedin-role-label">{exp.role}</span>
            </div>
            <ul className="linkedin-bullets">
              {exp.bullets.map((bullet, j) => (
                <li key={j} className="linkedin-bullet-row">
                  <span className="linkedin-bullet-text">{bullet}</span>
                  <CopyButton text={bullet} />
                </li>
              ))}
            </ul>
            <p className="linkedin-reasoning">{exp.reasoning}</p>
          </section>
        ))}

        {/* Skills */}
        <section className="linkedin-section">
          <div className="linkedin-section-header">
            <h3 className="linkedin-section-title">Skills</h3>
          </div>
          <div className="linkedin-rewrite-row linkedin-rewrite-row--block">
            <p className="linkedin-rewrite-text">{rewrites.skills.text}</p>
            <CopyButton text={rewrites.skills.text} />
          </div>
          <p className="linkedin-reasoning">{rewrites.skills.reasoning}</p>
        </section>
      </div>
    );
  }

  // Upload state (no rewrites, or loading)
  return (
    <div className="linkedin-panel linkedin-panel--upload">
      {loading ? (
        <div className="linkedin-loading">
          <div className="linkedin-spinner" aria-hidden="true" />
          <p className="linkedin-loading-text">Disha is reading your profile…</p>
          <p className="linkedin-loading-sub">Usually takes 15–25 seconds.</p>
        </div>
      ) : (
        <>
          <p className="linkedin-upload-prompt">
            Upload your LinkedIn PDF export to get Disha's suggestions.
          </p>
          <label className="linkedin-upload-label">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="linkedin-upload-input"
              disabled={loading}
            />
            <span className="linkedin-upload-btn">Upload PDF</span>
          </label>
          <p className="linkedin-upload-hint">
            Disha will rewrite your headline, about section, top 3 roles,
            and skills list for recruiter discoverability in the NL market.
          </p>
          {error && <p className="linkedin-error">{error}</p>}
        </>
      )}
    </div>
  );
}
```

Add CSS to `src/components/profile/profile.css` (append at end):
```css
/* LinkedIn Optimizer — OptimizerPanel */
.linkedin-panel {
  max-width: 680px;
}

.linkedin-panel--upload {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s-4, 16px);
  padding: var(--s-8, 32px) 0;
}

.linkedin-panel-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: var(--s-6, 24px);
}

.linkedin-last-optimised {
  font-size: 13px;
  color: var(--text-2);
}

.linkedin-reupload-btn {
  font-size: 13px;
}

.linkedin-section {
  border-top: 1px solid var(--border, #E4E0D8);
  padding: var(--s-6, 24px) 0;
}

.linkedin-section-header {
  margin-bottom: 12px;
}

.linkedin-section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-2);
  margin: 0 0 2px;
}

.linkedin-role-label {
  font-size: 13px;
  color: var(--text-2);
}

.linkedin-rewrite-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.linkedin-rewrite-row--block {
  align-items: flex-start;
}

.linkedin-rewrite-text {
  font-size: 15px;
  line-height: 1.55;
  margin: 0;
  flex: 1;
}

.linkedin-reasoning {
  font-size: 12px;
  color: var(--text-2);
  font-style: italic;
  margin: 0;
  padding-left: 12px;
  border-left: 2px solid var(--border, #E4E0D8);
}

.linkedin-bullets {
  list-style: none;
  padding: 0;
  margin: 0 0 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.linkedin-bullet-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.linkedin-bullet-text {
  flex: 1;
  font-size: 14px;
  line-height: 1.5;
}

.linkedin-bullet-text::before {
  content: "• ";
  color: var(--accent, #1D4A35);
}

.linkedin-error {
  font-size: 13px;
  color: #c0392b;
  margin: 0;
}

/* Upload state */
.linkedin-upload-prompt {
  font-size: 15px;
  color: var(--text-1, inherit);
  margin: 0;
}

.linkedin-upload-label {
  display: inline-block;
  cursor: pointer;
}

.linkedin-upload-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.linkedin-upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: var(--accent, #1D4A35);
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: opacity 0.15s;
}

.linkedin-upload-btn:hover {
  opacity: 0.88;
}

.linkedin-upload-hint {
  font-size: 13px;
  color: var(--text-2);
  margin: 0;
  max-width: 44ch;
  line-height: 1.6;
}

/* Loading state */
.linkedin-loading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: var(--s-8, 32px) 0;
}

.linkedin-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border, #E4E0D8);
  border-top-color: var(--accent, #1D4A35);
  border-radius: 50%;
  animation: linkedin-spin 0.8s linear infinite;
}

@keyframes linkedin-spin {
  to { transform: rotate(360deg); }
}

.linkedin-loading-text {
  font-size: 15px;
  margin: 0;
}

.linkedin-loading-sub {
  font-size: 13px;
  color: var(--text-2);
  margin: 0;
}
```

**Verify:** `npx tsc --noEmit` passes.

---

## Task 7 — LinkedIn tab server component (page)

**Files:**
- `src/app/(app)/profile/linkedin/page.tsx` (create)

**Actions:**

This is a server component that reads the latest optimization from DB and passes it to `OptimizerPanel`.

```tsx
import { db, schema } from "@/db";
import { OptimizerPanel } from "@/components/linkedin/OptimizerPanel";
import type { LinkedinRewrites } from "@/db/schema";

export const dynamic = "force-dynamic";

async function loadOptimization() {
  const [row] = await db
    .select()
    .from(schema.linkedinOptimizations)
    .limit(1);
  return row ?? null;
}

export default async function LinkedinPage() {
  const row = await loadOptimization();

  const initial = row
    ? {
        rewrites: row.rewrites as LinkedinRewrites,
        createdAt: row.createdAt.toISOString(),
      }
    : null;

  return (
    <OptimizerPanel initial={initial} />
  );
}
```

**Verify:** `npx tsc --noEmit` passes. Page renders at `/profile?tab=linkedin` after Task 8.

---

## Task 8 — Add tab navigation to profile page + next.config update

**Files:**
- `src/app/(app)/profile/page.tsx` (modify)
- `next.config.ts` (modify — add `pdf-parse` to `serverExternalPackages`)

**Actions:**

**8a. `next.config.ts` — add serverExternalPackages:**

Read the existing `next.config.ts` first. Add `pdf-parse` to `serverExternalPackages` (or create the array if absent). This prevents Next.js bundler from trying to bundle the pdf-parse native module:

```typescript
// In next.config.ts, inside the config object:
serverExternalPackages: ["pdf-parse"],
```

**8b. `src/app/(app)/profile/page.tsx` — add tab navigation:**

The page component signature changes to accept `searchParams`. Update the file as follows:

1. Change the function signature to accept `searchParams`:
```typescript
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
```

2. At the top of the function body, resolve searchParams (Next.js 15 async API):
```typescript
const params = await searchParams;
const activeTab = params.tab === "linkedin" ? "linkedin" : "profile";
```

3. Replace the existing `<header>` block with a header that includes tab navigation:
```tsx
<header className="profile-header">
  <h1>Your profile</h1>
  <nav className="profile-tabs" aria-label="Profile sections">
    <a
      href="/profile"
      className={`profile-tab${activeTab === "profile" ? " profile-tab--active" : ""}`}
    >
      Your profile
    </a>
    <a
      href="/profile?tab=linkedin"
      className={`profile-tab${activeTab === "linkedin" ? " profile-tab--active" : ""}`}
    >
      LinkedIn
    </a>
  </nav>
</header>
```

4. Wrap the existing profile content (everything below the header) in a conditional:
```tsx
{activeTab === "profile" ? (
  <>
    {/* existing profile identity + layout divs */}
  </>
) : (
  <LinkedinPageContent />
)}
```

Where `LinkedinPageContent` is imported as a dynamic import OR simply inline the server component render. The cleaner approach: import and render the LinkedIn page component directly (server components can be rendered inline):

Add import at the top:
```typescript
import LinkedinPage from "./linkedin/page";
```

Then in the JSX:
```tsx
{activeTab === "linkedin" && <LinkedinPage />}
```

**CRITICAL:** The existing profile page has an early return when no profile row is found. This must be updated so the LinkedIn tab works even when no profile row exists. After reading the existing `profile/page.tsx`, locate the early return that checks for a missing profile row. Update the logic so `activeTab` is resolved BEFORE the early return, and the LinkedIn tab bypasses the profile-row check entirely:

```typescript
// At top of function body — resolve BEFORE any early return
const params = await searchParams;
const activeTab = params.tab === "linkedin" ? "linkedin" : "profile";

// If LinkedIn tab, skip profile-row requirement entirely
if (activeTab === "linkedin") {
  return (
    <div className="profile-page">
      <header className="profile-header">
        <h1>Your profile</h1>
        <nav className="profile-tabs" aria-label="Profile sections">
          <a href="/profile" className="profile-tab">Your profile</a>
          <a href="/profile?tab=linkedin" className="profile-tab profile-tab--active">LinkedIn</a>
        </nav>
      </header>
      <LinkedinPage />
    </div>
  );
}

// Original early return (no profile row) — only reached when activeTab === "profile"
if (!row) {
  return ( /* existing no-profile UI */ );
}
```

The tab nav must appear in all branches (both the LinkedIn early-return and the normal profile render).

5. Add tab CSS to `src/components/profile/profile.css`:
```css
/* Profile tabs */
.profile-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border, #E4E0D8);
  margin-top: var(--s-4, 16px);
  margin-bottom: var(--s-8, 32px);
}

.profile-tab {
  font-size: 14px;
  font-weight: 500;
  padding: 8px 20px;
  color: var(--text-2);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.profile-tab:hover {
  color: var(--text-1, inherit);
}

.profile-tab--active {
  color: var(--accent, #1D4A35);
  border-bottom-color: var(--accent, #1D4A35);
}
```

**Verify:**
- `npx tsc --noEmit` passes
- `npm run build` succeeds (no bundler errors for pdf-parse)
- Visit `http://localhost:3000/profile` — "Your profile" tab shows existing content
- Visit `http://localhost:3000/profile?tab=linkedin` — "LinkedIn" tab shows upload panel (empty state)

---

## Task 9 — Commit and push

**Actions:**

Stage and commit all new and modified files:

```bash
cd "/Users/avi/Downloads/Claude/Code/AI Job Search"

git add \
  src/db/migrations/0005_linkedin_optimizations.sql \
  src/db/schema.ts \
  src/lib/linkedin/extract.ts \
  src/lib/linkedin/optimize.ts \
  src/app/api/linkedin/optimize/route.ts \
  src/components/linkedin/CopyButton.tsx \
  src/components/linkedin/OptimizerPanel.tsx \
  src/app/\(app\)/profile/linkedin/page.tsx \
  src/app/\(app\)/profile/page.tsx \
  src/components/profile/profile.css \
  package.json \
  package-lock.json \
  next.config.ts

git commit -m "feat: LinkedIn Profile Optimizer — PDF upload → Sonnet rewrites with copy buttons"

git push origin main
```

**Verify:** Push succeeds. Vercel deployment triggered. Check Vercel dashboard for successful build.

---

## End-to-end verification

After deployment completes:

1. Visit `https://[your-vercel-url]/profile` — two tabs visible: "Your profile" | "LinkedIn"
2. Click "LinkedIn" tab — upload panel shown with "Upload PDF" button
3. Export LinkedIn profile as PDF from LinkedIn.com (Me → View Profile → More → Save to PDF)
4. Upload the PDF — spinner shows "Disha is reading your profile…"
5. After 15–25 seconds, rewrites appear: Headline, About, 3 Experience sections, Skills
6. Click "Copy" on Headline — paste into a text editor to confirm correct text copied
7. Click "Copy" on a bullet — confirms per-bullet copy works
8. "Copy" button briefly shows "Copied!" then reverts
9. Re-upload same PDF — new optimization overwrites the old one; "Last optimised" shows "today"

---

## Notes for executor

- `pdf-parse` imports may trigger a Next.js warning about reading test files in non-test environments. Safe to ignore. The `serverExternalPackages` config in Task 8 prevents bundler issues.
- The token cost in the route is a rough estimate using a probe call. If this adds latency, remove the probe call and set `tokenCost: null` — it's non-blocking but adds ~1-2s.
- `LinkedinRewrites` type must be exported from `src/db/schema.ts` (not a separate types file) so both the schema definition and `OptimizerPanel` props can import from the same path.
- The migration must be applied before the API route can write rows. Verify with `SELECT COUNT(*) FROM linkedin_optimizations` before any upload testing.
- `drizzle-kit migrate` will NOT pick up manually written SQL migrations (it uses its own generated file names). Apply 0005 via the node script in Task 1. The schema.ts Drizzle definition is what matters for type-safe queries.
