# Week 1 — Foundation, Discovery & Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the AI Job Search foundation: Next.js 16 repo on Vercel, Neon Postgres with full schema, Vercel Blob storage, discovery pipeline for 4 free sources (Adzuna, Jooble, Werk.nl, Nationale Vacaturebank), deduplication, embedding-based ranking with Haiku-enriched fit scoring, tier routing, nightly cron, and heartbeat/failure-email infra. By end of Week 1, Avi can run the nightly pipeline and inspect ~30-100 ranked NL marketing jobs per night in the admin view.

**Architecture:** Monorepo Next.js 16 App Router on Vercel Hobby. Drizzle ORM over Neon Postgres (EU region, pgvector 512-dim). Workflow DevKit DurableAgent orchestrates the nightly pipeline (resumable, crash-safe). LLM adapter seam from day one (`AnthropicAPIAdapter` production; `ClaudeMaxCLIAdapter` dev fallback). All LLM calls route through AI Gateway with monthly budget ledger. No UI for the candidate yet — only an admin route for inspecting results.

**Tech Stack:** Next.js 16 App Router · TypeScript (strict) · Drizzle ORM · Neon Postgres + pgvector · Vercel Blob · Vercel Cron · Workflow DevKit DurableAgent · AI SDK v6 · Anthropic SDK · OpenAI SDK (embeddings only) · Resend · shadcn/ui · Tailwind · Vitest (unit) · Playwright (e2e, minimal)

**Reference spec:** `docs/superpowers/specs/2026-04-14-ai-job-search-design.md`

---

## File Structure (Week 1 deliverables)

```
/
├── package.json
├── tsconfig.json
├── next.config.ts
├── vercel.ts                          # Vercel project config
├── drizzle.config.ts
├── .env.example
├── .env.local                         # gitignored
├── vitest.config.ts
├── README.md                          # already exists
├── CLAUDE.md                          # already exists
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # placeholder "coming soon"
│   │   ├── admin/
│   │   │   ├── layout.tsx             # admin auth gate
│   │   │   ├── page.tsx               # admin home (nav)
│   │   │   ├── jobs/page.tsx          # list ranked jobs
│   │   │   ├── runs/page.tsx          # pipeline run log
│   │   │   └── profile/page.tsx       # profile intake form
│   │   └── api/
│   │       ├── cron/
│   │       │   └── nightly/route.ts   # Vercel Cron entrypoint
│   │       ├── admin/
│   │       │   ├── profile/route.ts   # upsert profile
│   │       │   └── trigger-run/route.ts
│   │       └── health/route.ts        # heartbeat
│   ├── db/
│   │   ├── index.ts                   # drizzle client
│   │   ├── schema.ts                  # all tables
│   │   └── migrations/                # drizzle generated
│   ├── lib/
│   │   ├── env.ts                     # validated env vars
│   │   ├── llm/
│   │   │   ├── adapter.ts             # LLMAdapter interface
│   │   │   ├── anthropic-api.ts       # production impl
│   │   │   ├── claude-max-cli.ts      # dev fallback (stub)
│   │   │   ├── gateway.ts             # budget + cap wrapper
│   │   │   ├── budget.ts              # budget ledger logic
│   │   │   └── index.ts               # exports configured adapter
│   │   ├── embeddings/
│   │   │   └── index.ts               # OpenAI text-embedding-3-small @ 512-dim
│   │   ├── sources/
│   │   │   ├── types.ts               # RawJob shape
│   │   │   ├── adzuna.ts
│   │   │   ├── jooble.ts
│   │   │   ├── werknl.ts
│   │   │   ├── nvb.ts                 # Nationale Vacaturebank
│   │   │   └── index.ts               # Source registry
│   │   ├── pipeline/
│   │   │   ├── discover.ts
│   │   │   ├── dedupe.ts
│   │   │   ├── rank.ts
│   │   │   ├── tier.ts
│   │   │   ├── filters.ts             # hard filters (Dutch, visa, seniority)
│   │   │   └── orchestrator.ts        # DurableAgent pipeline
│   │   ├── profile/
│   │   │   ├── types.ts
│   │   │   └── embedder.ts            # profile → embedding
│   │   ├── auth/
│   │   │   └── admin.ts               # simple admin-only gate
│   │   └── notify/
│   │       └── resend.ts              # heartbeat + failure emails
├── tests/
│   ├── unit/
│   │   ├── dedupe.test.ts
│   │   ├── filters.test.ts
│   │   ├── tier.test.ts
│   │   ├── budget.test.ts
│   │   └── sources/
│   │       ├── adzuna.test.ts
│   │       └── jooble.test.ts
│   └── integration/
│       └── pipeline.test.ts
└── docs/superpowers/
    ├── specs/2026-04-14-ai-job-search-design.md   # already exists
    └── plans/2026-04-14-week-1-foundation.md      # this file
```

---

## Task 1: Initialize Next.js 16 repo + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example`, `.gitignore` (extend existing), `.eslintrc.json`, `vitest.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1.1: Verify clean starting state**

Run (from repo root `/Users/avi/Downloads/Claude/Code/AI Job Search`):
```bash
git status
ls -la
```
Expected: clean tree, only existing files (CLAUDE.md, README.md, docs/, .gitignore).

- [ ] **Step 1.2: Initialize package.json**

Create `package.json`:
```json
{
  "name": "ai-job-search",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "next": "16.0.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "drizzle-orm": "^0.35.0",
    "@neondatabase/serverless": "^0.10.0",
    "@vercel/blob": "^0.27.0",
    "@vercel/functions": "^1.5.0",
    "ai": "^6.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "resend": "^4.0.0",
    "zod": "^3.23.0",
    "fast-levenshtein": "^3.0.0",
    "cheerio": "^1.0.0",
    "p-limit": "^6.0.0",
    "date-fns": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.6.0",
    "drizzle-kit": "^0.28.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "16.0.0",
    "vitest": "^2.1.0",
    "@vitest/ui": "^2.1.0",
    "tsx": "^4.19.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Note: all library versions here are targets. Before installing, run `npm view <pkg> version` on each to pick the latest stable for 2026-04-14. Update this file with the actual installed versions.

- [ ] **Step 1.3: Install dependencies**

Run:
```bash
npm install
```
Expected: clean install, no peer-dep errors. If errors, read them and pin versions.

- [ ] **Step 1.4: Create tsconfig.json**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "incremental": true,
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "src/**/*", "tests/**/*", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 1.5: Create next.config.ts**

Create `next.config.ts`:
```ts
import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};
export default config;
```

- [ ] **Step 1.6: Create minimal app shell**

Create `src/app/layout.tsx`:
```tsx
import type { ReactNode } from "react";

export const metadata = { title: "AI Job Search", description: "Private" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/page.tsx`:
```tsx
export default function Home() {
  return <main style={{ padding: 24 }}>AI Job Search — under construction.</main>;
}
```

- [ ] **Step 1.7: Create .env.example**

Create `.env.example`:
```dotenv
# Neon Postgres (EU region)
DATABASE_URL=postgres://user:pass@host/db?sslmode=require

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# Anthropic (via AI Gateway)
ANTHROPIC_API_KEY=
AI_GATEWAY_URL=https://gateway.ai.vercel.com/v1
MONTHLY_LLM_CAP_EUR=20.00

# OpenAI (embeddings only)
OPENAI_API_KEY=

# Source API keys
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
JOOBLE_API_KEY=

# Resend (email)
RESEND_API_KEY=
RESEND_FROM=notifications@yourdomain.com
ADMIN_EMAIL=avi@example.com
CANDIDATE_EMAIL=upashana@example.com

# Admin gate
ADMIN_SECRET=generate-with-openssl-rand-hex-32

# Cron shared secret
CRON_SECRET=generate-with-openssl-rand-hex-32

# Vercel (optional overrides)
TZ=Europe/Amsterdam
```

- [ ] **Step 1.8: Create vitest.config.ts**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: [],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 1.9: Run typecheck + sanity build**

Run:
```bash
npm run typecheck
```
Expected: exits 0.

Run:
```bash
npm run build
```
Expected: Next builds successfully, no type errors.

- [ ] **Step 1.10: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts .env.example src/app/layout.tsx src/app/page.tsx
git commit -m "chore: initialize Next.js 16 + TypeScript + Vitest scaffolding"
```

---

## Task 2: Env validation module

**Files:**
- Create: `src/lib/env.ts`
- Test: `tests/unit/env.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `tests/unit/env.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("env validation", () => {
  it("throws when DATABASE_URL is missing", async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const { loadEnv } = await import("@/lib/env");
    expect(() => loadEnv()).toThrow(/DATABASE_URL/);
    if (prev) process.env.DATABASE_URL = prev;
  });

  it("returns parsed env when all required fields present", async () => {
    process.env.DATABASE_URL = "postgres://x";
    process.env.ANTHROPIC_API_KEY = "sk-x";
    process.env.OPENAI_API_KEY = "sk-x";
    process.env.ADZUNA_APP_ID = "a";
    process.env.ADZUNA_APP_KEY = "b";
    process.env.JOOBLE_API_KEY = "c";
    process.env.RESEND_API_KEY = "re-x";
    process.env.RESEND_FROM = "x@x.com";
    process.env.ADMIN_EMAIL = "admin@x.com";
    process.env.CANDIDATE_EMAIL = "cand@x.com";
    process.env.ADMIN_SECRET = "x".repeat(32);
    process.env.CRON_SECRET = "y".repeat(32);
    process.env.MONTHLY_LLM_CAP_EUR = "20";
    process.env.BLOB_READ_WRITE_TOKEN = "t";
    const { loadEnv } = await import("@/lib/env");
    const env = loadEnv();
    expect(env.DATABASE_URL).toBe("postgres://x");
    expect(env.MONTHLY_LLM_CAP_EUR).toBe(20);
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npm test -- env`
Expected: FAIL ("@/lib/env" not found).

- [ ] **Step 2.3: Implement env.ts**

Create `src/lib/env.ts`:
```ts
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  AI_GATEWAY_URL: z.string().url().optional(),
  MONTHLY_LLM_CAP_EUR: z.coerce.number().positive().default(20),
  OPENAI_API_KEY: z.string().min(1),
  ADZUNA_APP_ID: z.string().min(1),
  ADZUNA_APP_KEY: z.string().min(1),
  JOOBLE_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM: z.string().email(),
  ADMIN_EMAIL: z.string().email(),
  CANDIDATE_EMAIL: z.string().email(),
  ADMIN_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(32),
  TZ: z.string().default("Europe/Amsterdam"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid env: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

// Non-throwing accessor for optional runtime checks
export function tryLoadEnv(): Env | null {
  try { return loadEnv(); } catch { return null; }
}
```

- [ ] **Step 2.4: Run test to verify it passes**

Run: `npm test -- env`
Expected: both tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/env.ts tests/unit/env.test.ts
git commit -m "feat(env): validated env loader with zod"
```

---

## Task 3: Drizzle schema — all Week 1 tables

**Files:**
- Create: `drizzle.config.ts`, `src/db/index.ts`, `src/db/schema.ts`
- Test: `tests/unit/schema.test.ts`

- [ ] **Step 3.1: Create drizzle.config.ts**

Create `drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
```

- [ ] **Step 3.2: Write failing test for schema exports**

Create `tests/unit/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import * as schema from "@/db/schema";

describe("schema", () => {
  it("exports all Week 1 tables", () => {
    const expected = [
      "profile", "companies", "jobs", "applications",
      "documents", "events", "screeningAnswers",
      "researchCache", "runs", "llmBudget",
    ];
    for (const t of expected) {
      expect((schema as Record<string, unknown>)[t]).toBeDefined();
    }
  });
});
```

- [ ] **Step 3.3: Run test to verify it fails**

Run: `npm test -- schema`
Expected: FAIL.

- [ ] **Step 3.4: Create src/db/schema.ts**

Create `src/db/schema.ts`:
```ts
import {
  pgTable, uuid, text, timestamp, jsonb, integer, numeric,
  boolean, smallint, bigint, char, vector,
} from "drizzle-orm/pg-core";

export const profile = pgTable("profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  roles: jsonb("roles").$type<unknown>().notNull().default([]),
  achievements: jsonb("achievements").$type<unknown>().notNull().default([]),
  toolStack: jsonb("tool_stack").$type<unknown>().notNull().default({}),
  industries: jsonb("industries").$type<unknown>().notNull().default([]),
  stories: jsonb("stories").$type<unknown>().notNull().default([]),
  constraints: jsonb("constraints").$type<unknown>().notNull().default({}),
  preferences: jsonb("preferences").$type<unknown>().notNull().default({}),
  portfolioUrl: text("portfolio_url"),
  linkedinUrl: text("linkedin_url"),
  masterCvDocxUrl: text("master_cv_docx_url"),
  masterCvPdfUrl: text("master_cv_pdf_url"),
  profileEmbedding: vector("profile_embedding", { dimensions: 512 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text("updated_by").notNull().default("admin"),
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: text("domain").unique(),
  name: text("name").notNull(),
  researchJson: jsonb("research_json").$type<unknown>(),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  source: text("source").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceExternalId: text("source_external_id"),
  title: text("title").notNull(),
  jdText: text("jd_text").notNull(),
  jdEmbedding: vector("jd_embedding", { dimensions: 512 }),
  location: text("location"),
  dutchRequired: boolean("dutch_required").notNull().default(false),
  seniority: text("seniority"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull(),
  dedupeHash: text("dedupe_hash").notNull(),
  canonicalJobId: uuid("canonical_job_id"),
  fitScore: numeric("fit_score", { precision: 4, scale: 1 }),
  fitBreakdown: jsonb("fit_breakdown").$type<unknown>(),
  gapAnalysis: jsonb("gap_analysis").$type<unknown>(),
  tier: smallint("tier"),
  hardFilterReason: text("hard_filter_reason"),
});

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull().default("new"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }).defaultNow().notNull(),
  notes: text("notes"),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").notNull(), // 'cv' | 'cover' | 'artifact' | 'screening'
  artifactType: text("artifact_type"),
  version: integer("version").notNull().default(1),
  blobUrlDocx: text("blob_url_docx"),
  blobUrlPdf: text("blob_url_pdf"),
  publicSlug: text("public_slug").unique(),
  generatedByTier: smallint("generated_by_tier"),
  tokenCost: numeric("token_cost", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").$type<unknown>(),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
});

export const screeningAnswers = pgTable("screening_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }).notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  confidence: numeric("confidence", { precision: 3, scale: 2 }),
});

export const researchCache = pgTable("research_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  scopeKey: text("scope_key").unique().notNull(),
  content: jsonb("content").$type<unknown>().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  status: text("status").notNull().default("running"),
  stageMetrics: jsonb("stage_metrics").$type<unknown>(),
  errorJson: jsonb("error_json").$type<unknown>(),
});

export const llmBudget = pgTable("llm_budget", {
  period: char("period", { length: 7 }).primaryKey(), // 'YYYY-MM'
  eurSpent: numeric("eur_spent", { precision: 8, scale: 4 }).notNull().default("0"),
  tokensIn: bigint("tokens_in", { mode: "number" }).notNull().default(0),
  tokensOut: bigint("tokens_out", { mode: "number" }).notNull().default(0),
  requests: integer("requests").notNull().default(0),
  capEur: numeric("cap_eur", { precision: 6, scale: 2 }).notNull().default("20"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 3.5: Create db client**

Create `src/db/index.ts`:
```ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { loadEnv } from "@/lib/env";
import * as schema from "./schema";

const env = loadEnv();
const sql = neon(env.DATABASE_URL);
export const db = drizzle(sql, { schema });
export * as schema from "./schema";
```

- [ ] **Step 3.6: Run test to verify it passes**

Run: `npm test -- schema`
Expected: PASS.

- [ ] **Step 3.7: Generate migrations**

Run:
```bash
npm run db:generate
```
Expected: creates `src/db/migrations/0000_*.sql` with all tables.

Inspect the generated SQL — confirm it includes `CREATE EXTENSION IF NOT EXISTS vector;` at the top. If not, add a pre-migration SQL file `src/db/migrations/0000_enable_pgvector.sql`:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
(Drizzle runs migrations in lex order; the `0000_` prefix ensures this runs first.)

- [ ] **Step 3.8: Commit**

```bash
git add drizzle.config.ts src/db/ tests/unit/schema.test.ts
git commit -m "feat(db): Drizzle schema for all Week 1 tables + pgvector"
```

---

## Task 4: Provision Neon + apply migrations

This task involves external provisioning. Avi performs the console steps; Claude provides the exact commands afterwards.

- [ ] **Step 4.1 (Avi): Create Neon project**

Avi creates a Neon project at https://console.neon.tech:
- Region: **EU (Frankfurt)** — GDPR locality requirement
- Postgres 17
- Name: `ai-job-search`
- Copy the pooled connection string into `.env.local` as `DATABASE_URL` (append `?sslmode=require`)

- [ ] **Step 4.2: Verify DB connectivity**

Create `scripts/db-ping.ts` (temporary, deleted in step 4.5):
```ts
import { db } from "@/db";
import { sql } from "drizzle-orm";
(async () => {
  const r = await db.execute(sql`select version()`);
  console.log(r);
})();
```

Run:
```bash
npx tsx scripts/db-ping.ts
```
Expected: logs PostgreSQL version row. If it fails, fix `DATABASE_URL` before proceeding.

- [ ] **Step 4.3: Apply migrations**

Run:
```bash
npm run db:migrate
```
Expected: migrations applied, no errors.

- [ ] **Step 4.4: Verify tables exist**

Run:
```bash
npx tsx -e "import { db } from '@/db'; import { sql } from 'drizzle-orm'; const r = await db.execute(sql\`select tablename from pg_tables where schemaname='public' order by tablename\`); console.log(r);"
```
Expected: lists all 10 tables.

- [ ] **Step 4.5: Remove temporary script**

```bash
rm scripts/db-ping.ts
```

- [ ] **Step 4.6: Commit migration output**

```bash
git add src/db/migrations/
git commit -m "feat(db): apply initial migration to Neon"
```

---

## Task 5: LLM adapter interface + Anthropic implementation

**Files:**
- Create: `src/lib/llm/adapter.ts`, `src/lib/llm/anthropic-api.ts`, `src/lib/llm/index.ts`, `src/lib/llm/claude-max-cli.ts` (stub only)
- Test: `tests/unit/llm-adapter.test.ts`

- [ ] **Step 5.1: Write failing test for adapter contract**

Create `tests/unit/llm-adapter.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import type { LLMAdapter } from "@/lib/llm/adapter";

describe("LLMAdapter contract", () => {
  it("interface exports expected methods", async () => {
    // Type-level assertion: if this file compiles, the interface exists.
    const shape: Pick<LLMAdapter, "complete" | "structured" | "embed"> | null = null;
    expect(shape).toBeNull();
  });
});
```

- [ ] **Step 5.2: Run test to verify failure**

Run: `npm test -- llm-adapter`
Expected: FAIL (missing `@/lib/llm/adapter`).

- [ ] **Step 5.3: Define the interface**

Create `src/lib/llm/adapter.ts`:
```ts
import { z } from "zod";

export type Model = "haiku" | "sonnet";

export interface CompleteRequest {
  model: Model;
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  cacheSystem?: boolean;     // enable Anthropic prompt caching on system
}

export interface CompleteResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  cachedTokensIn: number;    // 0 when no cache
  model: string;
  costEur: number;
}

export interface StructuredRequest<T> {
  model: Model;
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
  cacheSystem?: boolean;
}

export interface StructuredResponse<T> {
  data: T;
  tokensIn: number;
  tokensOut: number;
  cachedTokensIn: number;
  model: string;
  costEur: number;
}

export interface LLMAdapter {
  complete(req: CompleteRequest): Promise<CompleteResponse>;
  structured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>>;
  embed(texts: string[]): Promise<number[][]>;
}
```

- [ ] **Step 5.4: Run test to verify passage**

Run: `npm test -- llm-adapter`
Expected: PASS.

- [ ] **Step 5.5: Write failing test for pricing calculation**

Append to `tests/unit/llm-adapter.test.ts`:
```ts
import { costEur } from "@/lib/llm/anthropic-api";

describe("costEur", () => {
  it("computes Sonnet cost correctly", () => {
    // $3/M in, $15/M out. 1000 in, 500 out => 1000*3/1e6 + 500*15/1e6 = 0.003 + 0.0075 = $0.0105
    // EUR at 1 USD = 0.92 EUR => 0.00966
    const c = costEur("sonnet", { tokensIn: 1000, tokensOut: 500, cachedTokensIn: 0 });
    expect(c).toBeCloseTo(0.00966, 5);
  });

  it("applies 10% cached-input discount factor for cached tokens (Anthropic: 1/10 of input price for cache reads)", () => {
    // Sonnet cache-read is $0.30/M (10% of $3/M). 1000 cached => 1000*0.3/1e6 = $0.0003
    const c = costEur("sonnet", { tokensIn: 0, tokensOut: 0, cachedTokensIn: 1000 });
    expect(c).toBeCloseTo(0.0003 * 0.92, 6);
  });
});
```

- [ ] **Step 5.6: Run test to verify failure**

Run: `npm test -- llm-adapter`
Expected: FAIL (`costEur` undefined).

- [ ] **Step 5.7: Implement AnthropicAPIAdapter**

Create `src/lib/llm/anthropic-api.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { loadEnv } from "@/lib/env";
import type {
  LLMAdapter, CompleteRequest, CompleteResponse,
  StructuredRequest, StructuredResponse, Model,
} from "./adapter";

const MODEL_IDS: Record<Model, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
};

// Pricing per 1M tokens in USD (2026-04-14 published rates). Update from Anthropic pricing page.
const PRICE_USD = {
  haiku: { in: 1.0, out: 5.0, cachedIn: 0.1 },
  sonnet: { in: 3.0, out: 15.0, cachedIn: 0.3 },
} as const;

const USD_TO_EUR = 0.92; // update periodically; approximate

export function costEur(
  model: Model,
  usage: { tokensIn: number; tokensOut: number; cachedTokensIn: number },
): number {
  const p = PRICE_USD[model];
  const usd =
    (usage.tokensIn * p.in) / 1e6 +
    (usage.tokensOut * p.out) / 1e6 +
    (usage.cachedTokensIn * p.cachedIn) / 1e6;
  return usd * USD_TO_EUR;
}

export class AnthropicAPIAdapter implements LLMAdapter {
  private anth: Anthropic;
  private oai: OpenAI;

  constructor() {
    const env = loadEnv();
    this.anth = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      baseURL: env.AI_GATEWAY_URL ?? undefined,
    });
    this.oai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const modelId = MODEL_IDS[req.model];
    const system = req.system
      ? [{
          type: "text" as const,
          text: req.system,
          ...(req.cacheSystem ? { cache_control: { type: "ephemeral" as const } } : {}),
        }]
      : undefined;

    const res = await this.anth.messages.create({
      model: modelId,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.4,
      system,
      messages: [{ role: "user", content: req.prompt }],
    });

    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");

    const tokensIn = res.usage.input_tokens ?? 0;
    const cachedTokensIn = res.usage.cache_read_input_tokens ?? 0;
    const tokensOut = res.usage.output_tokens ?? 0;

    return {
      text,
      tokensIn,
      tokensOut,
      cachedTokensIn,
      model: modelId,
      costEur: costEur(req.model, { tokensIn, tokensOut, cachedTokensIn }),
    };
  }

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>> {
    const sys = `${req.system ?? ""}\n\nReturn ONLY JSON matching this Zod schema (no prose, no markdown fences). Schema description: ${JSON.stringify((req.schema as unknown as { _def: unknown })._def)}`;
    const base = await this.complete({
      model: req.model,
      system: sys,
      prompt: req.prompt,
      maxTokens: req.maxTokens,
      temperature: req.temperature ?? 0.1,
      cacheSystem: req.cacheSystem,
    });
    const cleaned = base.text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`structured: JSON parse failed: ${(e as Error).message}; raw=${cleaned.slice(0, 300)}`);
    }
    const data = req.schema.parse(parsedJson);
    return {
      data,
      tokensIn: base.tokensIn,
      tokensOut: base.tokensOut,
      cachedTokensIn: base.cachedTokensIn,
      model: base.model,
      costEur: base.costEur,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await this.oai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
      dimensions: 512,
    });
    return res.data.map((d) => d.embedding);
  }
}
```

- [ ] **Step 5.8: Stub Claude Max CLI adapter (dev fallback)**

Create `src/lib/llm/claude-max-cli.ts`:
```ts
import type { LLMAdapter } from "./adapter";

export class ClaudeMaxCLIAdapter implements LLMAdapter {
  complete(): never { throw new Error("ClaudeMaxCLIAdapter not implemented — use AnthropicAPIAdapter in prod"); }
  structured(): never { throw new Error("ClaudeMaxCLIAdapter not implemented"); }
  embed(): never { throw new Error("ClaudeMaxCLIAdapter not implemented"); }
}
```

- [ ] **Step 5.9: Create index export**

Create `src/lib/llm/index.ts`:
```ts
import { AnthropicAPIAdapter } from "./anthropic-api";
import type { LLMAdapter } from "./adapter";

export type { LLMAdapter } from "./adapter";

let singleton: LLMAdapter | null = null;
export function getLLM(): LLMAdapter {
  if (!singleton) singleton = new AnthropicAPIAdapter();
  return singleton;
}
```

- [ ] **Step 5.10: Run tests**

Run: `npm test -- llm-adapter`
Expected: PASS. Run `npm run typecheck` too — must pass.

- [ ] **Step 5.11: Commit**

```bash
git add src/lib/llm/ tests/unit/llm-adapter.test.ts
git commit -m "feat(llm): adapter interface + Anthropic API implementation + cost model"
```

---

## Task 6: Budget ledger (monthly LLM cap enforcement)

**Files:**
- Create: `src/lib/llm/budget.ts`, `src/lib/llm/gateway.ts`
- Test: `tests/unit/budget.test.ts`

- [ ] **Step 6.1: Write failing test**

Create `tests/unit/budget.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { LLMAdapter, CompleteRequest, CompleteResponse } from "@/lib/llm/adapter";

const upsertSpy = vi.fn();
const getSpy = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: () => ({ onConflictDoUpdate: upsertSpy }) }),
    select: () => ({ from: () => ({ where: getSpy }) }),
  },
  schema: {},
}));

vi.mock("@/lib/env", () => ({
  loadEnv: () => ({ MONTHLY_LLM_CAP_EUR: 20 }),
  tryLoadEnv: () => ({ MONTHLY_LLM_CAP_EUR: 20 }),
}));

describe("BudgetGateway", () => {
  beforeEach(() => { upsertSpy.mockReset(); getSpy.mockReset(); });

  it("allows when under cap and records spend", async () => {
    getSpy.mockResolvedValue([{ period: "2026-04", eurSpent: "0", capEur: "20" }]);
    upsertSpy.mockResolvedValue(undefined);

    const fake: LLMAdapter = {
      complete: async (r: CompleteRequest): Promise<CompleteResponse> => ({
        text: "hi", tokensIn: 10, tokensOut: 5, cachedTokensIn: 0, model: "sonnet", costEur: 0.01,
      }),
      structured: async () => { throw new Error("nyi"); },
      embed: async () => [[0.1]],
    };
    const { BudgetGateway } = await import("@/lib/llm/gateway");
    const gw = new BudgetGateway(fake);
    const res = await gw.complete({ model: "sonnet", prompt: "hi" });
    expect(res.text).toBe("hi");
    expect(upsertSpy).toHaveBeenCalled();
  });

  it("downgrades Sonnet to Haiku at ≥80% cap", async () => {
    getSpy.mockResolvedValue([{ period: "2026-04", eurSpent: "16.50", capEur: "20" }]);
    upsertSpy.mockResolvedValue(undefined);

    const callLog: string[] = [];
    const fake: LLMAdapter = {
      complete: async (r: CompleteRequest) => {
        callLog.push(r.model);
        return { text: "ok", tokensIn: 1, tokensOut: 1, cachedTokensIn: 0, model: r.model, costEur: 0.001 };
      },
      structured: async () => { throw new Error("nyi"); },
      embed: async () => [[0]],
    };
    const { BudgetGateway } = await import("@/lib/llm/gateway");
    const gw = new BudgetGateway(fake);
    await gw.complete({ model: "sonnet", prompt: "hi" });
    expect(callLog[0]).toBe("haiku"); // downgraded
  });

  it("throws BudgetExceededError at 100% cap", async () => {
    getSpy.mockResolvedValue([{ period: "2026-04", eurSpent: "20.00", capEur: "20" }]);
    const fake: LLMAdapter = {
      complete: async () => ({ text: "", tokensIn: 0, tokensOut: 0, cachedTokensIn: 0, model: "haiku", costEur: 0 }),
      structured: async () => { throw new Error("nyi"); },
      embed: async () => [[0]],
    };
    const { BudgetGateway, BudgetExceededError } = await import("@/lib/llm/gateway");
    const gw = new BudgetGateway(fake);
    await expect(gw.complete({ model: "sonnet", prompt: "hi" })).rejects.toBeInstanceOf(BudgetExceededError);
  });
});
```

- [ ] **Step 6.2: Run to verify failure**

Run: `npm test -- budget`
Expected: FAIL.

- [ ] **Step 6.3: Implement budget ledger helper**

Create `src/lib/llm/budget.ts`:
```ts
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";

export interface BudgetState {
  period: string;          // YYYY-MM
  eurSpent: number;
  capEur: number;
  utilization: number;     // 0..1
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getBudget(capEur: number): Promise<BudgetState> {
  const period = currentPeriod();
  const rows = await db
    .select()
    .from(schema.llmBudget)
    .where(eq(schema.llmBudget.period, period));
  const row = rows[0];
  if (!row) {
    await db
      .insert(schema.llmBudget)
      .values({ period, capEur: String(capEur) })
      .onConflictDoNothing();
    return { period, eurSpent: 0, capEur, utilization: 0 };
  }
  const eurSpent = Number(row.eurSpent);
  const cap = Number(row.capEur);
  return { period, eurSpent, capEur: cap, utilization: cap > 0 ? eurSpent / cap : 1 };
}

export async function recordSpend(params: {
  costEur: number; tokensIn: number; tokensOut: number;
}): Promise<void> {
  const period = currentPeriod();
  await db.insert(schema.llmBudget)
    .values({
      period,
      eurSpent: String(params.costEur),
      tokensIn: params.tokensIn,
      tokensOut: params.tokensOut,
      requests: 1,
      capEur: "20",
    })
    .onConflictDoUpdate({
      target: schema.llmBudget.period,
      set: {
        eurSpent: sql`${schema.llmBudget.eurSpent} + ${String(params.costEur)}::numeric`,
        tokensIn: sql`${schema.llmBudget.tokensIn} + ${params.tokensIn}`,
        tokensOut: sql`${schema.llmBudget.tokensOut} + ${params.tokensOut}`,
        requests: sql`${schema.llmBudget.requests} + 1`,
        updatedAt: sql`now()`,
      },
    });
}
```

- [ ] **Step 6.4: Implement BudgetGateway wrapping adapter**

Create `src/lib/llm/gateway.ts`:
```ts
import { loadEnv } from "@/lib/env";
import type {
  LLMAdapter, CompleteRequest, CompleteResponse,
  StructuredRequest, StructuredResponse, Model,
} from "./adapter";
import { getBudget, recordSpend } from "./budget";

export class BudgetExceededError extends Error {
  constructor(period: string, eurSpent: number, capEur: number) {
    super(`Budget exceeded for ${period}: €${eurSpent.toFixed(2)}/€${capEur.toFixed(2)}`);
    this.name = "BudgetExceededError";
  }
}

type Decision = { action: "allow" | "downgrade" | "block"; reason?: string };

function decide(model: Model, utilization: number): Decision {
  if (utilization >= 1.0) return { action: "block", reason: "cap reached" };
  if (utilization >= 0.95 && model === "sonnet") return { action: "downgrade", reason: ">=95%: Sonnet→Haiku" };
  if (utilization >= 0.80 && model === "sonnet") return { action: "downgrade", reason: ">=80%: Sonnet→Haiku" };
  return { action: "allow" };
}

export class BudgetGateway implements LLMAdapter {
  constructor(private inner: LLMAdapter) {}

  private async gated<T>(model: Model, run: (finalModel: Model) => Promise<T & { costEur: number; tokensIn: number; tokensOut: number }>): Promise<T> {
    const cap = loadEnv().MONTHLY_LLM_CAP_EUR;
    const state = await getBudget(cap);
    const d = decide(model, state.utilization);
    if (d.action === "block") throw new BudgetExceededError(state.period, state.eurSpent, state.capEur);
    const finalModel: Model = d.action === "downgrade" ? "haiku" : model;
    const res = await run(finalModel);
    await recordSpend({ costEur: res.costEur, tokensIn: res.tokensIn, tokensOut: res.tokensOut });
    return res;
  }

  complete(req: CompleteRequest): Promise<CompleteResponse> {
    return this.gated(req.model, (finalModel) => this.inner.complete({ ...req, model: finalModel }));
  }

  structured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>> {
    return this.gated(req.model, (finalModel) => this.inner.structured({ ...req, model: finalModel }));
  }

  embed(texts: string[]): Promise<number[][]> {
    return this.inner.embed(texts);
  }
}
```

- [ ] **Step 6.5: Wire gateway into the factory**

Edit `src/lib/llm/index.ts` — replace contents with:
```ts
import { AnthropicAPIAdapter } from "./anthropic-api";
import { BudgetGateway } from "./gateway";
import type { LLMAdapter } from "./adapter";

export type { LLMAdapter } from "./adapter";
export { BudgetExceededError } from "./gateway";

let singleton: LLMAdapter | null = null;
export function getLLM(): LLMAdapter {
  if (!singleton) singleton = new BudgetGateway(new AnthropicAPIAdapter());
  return singleton;
}
```

- [ ] **Step 6.6: Run tests**

Run: `npm test -- budget`
Expected: all 3 tests PASS.

- [ ] **Step 6.7: Commit**

```bash
git add src/lib/llm/budget.ts src/lib/llm/gateway.ts src/lib/llm/index.ts tests/unit/budget.test.ts
git commit -m "feat(llm): budget ledger + gateway with tiered throttling"
```

---

## Task 7: Embeddings helper

**Files:**
- Create: `src/lib/embeddings/index.ts`
- Test: `tests/unit/embeddings.test.ts`

- [ ] **Step 7.1: Write failing test**

Create `tests/unit/embeddings.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cosine } from "@/lib/embeddings";

describe("cosine", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });
  it("returns 0 for orthogonal", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });
  it("returns -1 for opposite", () => {
    expect(cosine([1, 1], [-1, -1])).toBeCloseTo(-1, 6);
  });
});
```

- [ ] **Step 7.2: Implement**

Create `src/lib/embeddings/index.ts`:
```ts
import { getLLM } from "@/lib/llm";

export async function embedMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return getLLM().embed(texts);
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embedMany([text]);
  return v;
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`cosine: length mismatch ${a.length} vs ${b.length}`);
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  const denom = Math.sqrt(aa) * Math.sqrt(bb);
  if (denom === 0) return 0;
  return dot / denom;
}
```

- [ ] **Step 7.3: Run tests**

Run: `npm test -- embeddings`
Expected: PASS.

- [ ] **Step 7.4: Commit**

```bash
git add src/lib/embeddings/ tests/unit/embeddings.test.ts
git commit -m "feat(embeddings): helper + cosine similarity"
```

---

## Task 8: Source types + Adzuna source

**Files:**
- Create: `src/lib/sources/types.ts`, `src/lib/sources/adzuna.ts`
- Test: `tests/unit/sources/adzuna.test.ts`

- [ ] **Step 8.1: Define RawJob shape + source contract**

Create `src/lib/sources/types.ts`:
```ts
export interface RawJob {
  source: string;                      // 'adzuna' | 'jooble' | 'werknl' | 'nvb'
  sourceExternalId: string;            // stable id within source
  sourceUrl: string;
  title: string;
  jdText: string;
  companyName: string | null;
  companyDomain: string | null;
  location: string | null;
  postedAt: Date | null;
}

export interface JobSource {
  name: string;
  fetch(): Promise<RawJob[]>;
}
```

- [ ] **Step 8.2: Write failing test for Adzuna normalization**

Create `tests/unit/sources/adzuna.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeAdzuna } from "@/lib/sources/adzuna";

describe("normalizeAdzuna", () => {
  it("maps API response to RawJob", () => {
    const api = {
      id: "123",
      redirect_url: "https://www.adzuna.nl/land/ad/123",
      title: "Marketing Automation Manager",
      description: "HubSpot expert needed...",
      company: { display_name: "Picnic" },
      location: { display_name: "Amsterdam, NL" },
      created: "2026-04-12T08:00:00Z",
    };
    const r = normalizeAdzuna(api);
    expect(r.source).toBe("adzuna");
    expect(r.sourceExternalId).toBe("123");
    expect(r.title).toBe("Marketing Automation Manager");
    expect(r.companyName).toBe("Picnic");
    expect(r.location).toBe("Amsterdam, NL");
    expect(r.postedAt?.toISOString()).toBe("2026-04-12T08:00:00.000Z");
  });

  it("handles missing company", () => {
    const api = { id: "x", redirect_url: "u", title: "t", description: "d", created: "2026-04-01T00:00:00Z" };
    const r = normalizeAdzuna(api as never);
    expect(r.companyName).toBeNull();
  });
});
```

- [ ] **Step 8.3: Run to verify failure**

Run: `npm test -- adzuna`
Expected: FAIL.

- [ ] **Step 8.4: Implement Adzuna source**

Create `src/lib/sources/adzuna.ts`:
```ts
import { loadEnv } from "@/lib/env";
import type { JobSource, RawJob } from "./types";

interface AdzunaApiJob {
  id: string;
  redirect_url: string;
  title: string;
  description: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  created: string;
}

export function normalizeAdzuna(j: AdzunaApiJob): RawJob {
  return {
    source: "adzuna",
    sourceExternalId: j.id,
    sourceUrl: j.redirect_url,
    title: j.title,
    jdText: j.description,
    companyName: j.company?.display_name ?? null,
    companyDomain: null,
    location: j.location?.display_name ?? null,
    postedAt: j.created ? new Date(j.created) : null,
  };
}

const KEYWORDS = [
  "marketing automation", "CRM marketing", "email marketing", "digital marketing",
  "HubSpot", "growth marketing", "paid media", "SEO", "marketing manager",
];
const PAGES = 3;
const RESULTS_PER_PAGE = 50;

export class AdzunaSource implements JobSource {
  readonly name = "adzuna";

  async fetch(): Promise<RawJob[]> {
    const env = loadEnv();
    const out: RawJob[] = [];
    for (const kw of KEYWORDS) {
      for (let page = 1; page <= PAGES; page++) {
        const url = new URL(`https://api.adzuna.com/v1/api/jobs/nl/search/${page}`);
        url.searchParams.set("app_id", env.ADZUNA_APP_ID);
        url.searchParams.set("app_key", env.ADZUNA_APP_KEY);
        url.searchParams.set("results_per_page", String(RESULTS_PER_PAGE));
        url.searchParams.set("what", kw);
        url.searchParams.set("content-type", "application/json");
        url.searchParams.set("max_days_old", "14");

        const res = await fetch(url, { headers: { accept: "application/json" } });
        if (!res.ok) {
          console.warn(`adzuna: ${res.status} on ${kw} p${page}: ${await res.text()}`);
          break;
        }
        const body = (await res.json()) as { results?: AdzunaApiJob[] };
        if (!body.results?.length) break;
        for (const j of body.results) out.push(normalizeAdzuna(j));
        if (body.results.length < RESULTS_PER_PAGE) break; // last page
      }
    }
    return out;
  }
}
```

- [ ] **Step 8.5: Run tests**

Run: `npm test -- adzuna`
Expected: PASS.

- [ ] **Step 8.6: Commit**

```bash
git add src/lib/sources/types.ts src/lib/sources/adzuna.ts tests/unit/sources/adzuna.test.ts
git commit -m "feat(sources): Adzuna job source + normalization"
```

---

## Task 9: Jooble source

**Files:**
- Create: `src/lib/sources/jooble.ts`
- Test: `tests/unit/sources/jooble.test.ts`

- [ ] **Step 9.1: Write failing test**

Create `tests/unit/sources/jooble.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeJooble } from "@/lib/sources/jooble";

describe("normalizeJooble", () => {
  it("maps Jooble response to RawJob", () => {
    const api = {
      id: 987,
      link: "https://jooble.org/desc/987",
      title: "CRM Marketing Manager",
      snippet: "HubSpot, segmentation, lifecycle",
      company: "Mollie",
      location: "Amsterdam",
      updated: "2026-04-10T12:00:00",
    };
    const r = normalizeJooble(api);
    expect(r.source).toBe("jooble");
    expect(r.sourceExternalId).toBe("987");
    expect(r.companyName).toBe("Mollie");
    expect(r.jdText).toContain("HubSpot");
  });
});
```

- [ ] **Step 9.2: Run, expect failure**

Run: `npm test -- jooble`
Expected: FAIL.

- [ ] **Step 9.3: Implement Jooble source**

Create `src/lib/sources/jooble.ts`:
```ts
import { loadEnv } from "@/lib/env";
import type { JobSource, RawJob } from "./types";

interface JoobleApiJob {
  id: number | string;
  link: string;
  title: string;
  snippet: string;
  company?: string;
  location?: string;
  updated?: string;
}

export function normalizeJooble(j: JoobleApiJob): RawJob {
  return {
    source: "jooble",
    sourceExternalId: String(j.id),
    sourceUrl: j.link,
    title: j.title,
    jdText: j.snippet,
    companyName: j.company ?? null,
    companyDomain: null,
    location: j.location ?? null,
    postedAt: j.updated ? new Date(j.updated) : null,
  };
}

const KEYWORDS = [
  "marketing automation", "CRM marketing", "email marketing",
  "HubSpot", "growth marketing", "digital marketing",
];

export class JoobleSource implements JobSource {
  readonly name = "jooble";

  async fetch(): Promise<RawJob[]> {
    const env = loadEnv();
    const out: RawJob[] = [];
    for (const kw of KEYWORDS) {
      const res = await fetch(`https://jooble.org/api/${env.JOOBLE_API_KEY}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keywords: kw,
          location: "Netherlands",
          page: 1,
          ResultOnPage: 50,
        }),
      });
      if (!res.ok) {
        console.warn(`jooble: ${res.status}: ${await res.text()}`);
        continue;
      }
      const body = (await res.json()) as { jobs?: JoobleApiJob[] };
      for (const j of body.jobs ?? []) out.push(normalizeJooble(j));
    }
    return out;
  }
}
```

- [ ] **Step 9.4: Run tests and commit**

Run: `npm test -- jooble`
Expected: PASS.

```bash
git add src/lib/sources/jooble.ts tests/unit/sources/jooble.test.ts
git commit -m "feat(sources): Jooble job source"
```

---

## Task 10: Werk.nl + Nationale Vacaturebank (HTML scrape)

**Files:**
- Create: `src/lib/sources/werknl.ts`, `src/lib/sources/nvb.ts`
- Test: `tests/unit/sources/werknl.test.ts`, `tests/unit/sources/nvb.test.ts`

Both work.nl and Nationale Vacaturebank expose public search pages. HTML shape is subject to change; tests use fixtures to verify the parser.

- [ ] **Step 10.1: Capture live HTML fixtures**

Create `tests/fixtures/werknl-search.html` and `tests/fixtures/nvb-search.html`. Manually save a search result page for "marketing" from both sites (one time, committed to repo) to serve as test fixture. Record the URL pattern used in a comment inside each file.

Command to help capture:
```bash
mkdir -p tests/fixtures
curl -s -A "Mozilla/5.0 ai-job-search-bot (personal use)" \
  "https://www.werk.nl/werkzoekenden/vacatures/?vakgebied=Marketing&trefwoord=marketing" \
  -o tests/fixtures/werknl-search.html
curl -s -A "Mozilla/5.0 ai-job-search-bot (personal use)" \
  "https://www.nationalevacaturebank.nl/vacature/zoeken?query=marketing" \
  -o tests/fixtures/nvb-search.html
```

Inspect both files. If either returns a JavaScript shell (client-rendered page with no job data in HTML), pivot that source to a JSON API discovery (look at network tab for their XHR endpoints), or mark the source as deferred. **Document findings in a comment at the top of the source file.**

- [ ] **Step 10.2: Write werknl parser test against fixture**

Create `tests/unit/sources/werknl.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseWerknlSearch } from "@/lib/sources/werknl";

describe("parseWerknlSearch", () => {
  it("extracts jobs from fixture HTML", () => {
    const html = readFileSync("tests/fixtures/werknl-search.html", "utf8");
    const jobs = parseWerknlSearch(html);
    // Adjust these assertions after inspecting the fixture. At minimum:
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) {
      expect(j.source).toBe("werknl");
      expect(j.sourceUrl).toMatch(/^https?:\/\//);
      expect(j.title.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 10.3: Implement werknl source**

Create `src/lib/sources/werknl.ts`:
```ts
// werk.nl public search. Fixture: tests/fixtures/werknl-search.html.
// If werk.nl switches to client-side rendering, this parser will need to
// pivot to their JSON XHR endpoint (inspect the network tab of the
// search page to find it).
import * as cheerio from "cheerio";
import type { JobSource, RawJob } from "./types";

const BASE = "https://www.werk.nl";
const SEARCH = `${BASE}/werkzoekenden/vacatures/?vakgebied=Marketing&trefwoord=`;
const UA = "Mozilla/5.0 (compatible; ai-job-search-bot/1.0; +personal-use)";
const KEYWORDS = ["marketing automation", "CRM", "email marketing", "HubSpot", "digital marketing"];

export function parseWerknlSearch(html: string): RawJob[] {
  const $ = cheerio.load(html);
  const out: RawJob[] = [];
  // Selector based on current werk.nl HTML (verify against fixture).
  // Expected structure: <article class="vacature"> ... </article>
  $("article.vacature, .vacature-list__item, [data-vacature-id]").each((_, el) => {
    const $el = $(el);
    const title = $el.find("h2, .vacature__title").first().text().trim();
    const href = $el.find("a").first().attr("href") ?? "";
    if (!title || !href) return;
    const sourceUrl = href.startsWith("http") ? href : `${BASE}${href}`;
    const companyName = $el.find(".vacature__werkgever, .vacature__company").first().text().trim() || null;
    const location = $el.find(".vacature__plaats, .vacature__location").first().text().trim() || null;
    const snippet = $el.find(".vacature__snippet, .vacature__summary").first().text().trim();
    const id = $el.attr("data-vacature-id") ?? sourceUrl;
    out.push({
      source: "werknl",
      sourceExternalId: id,
      sourceUrl,
      title,
      jdText: snippet,
      companyName,
      companyDomain: null,
      location,
      postedAt: null,
    });
  });
  return out;
}

export class WerknlSource implements JobSource {
  readonly name = "werknl";
  async fetch(): Promise<RawJob[]> {
    const out: RawJob[] = [];
    for (const kw of KEYWORDS) {
      const url = `${SEARCH}${encodeURIComponent(kw)}`;
      const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" } });
      if (!res.ok) { console.warn(`werknl ${res.status} on ${kw}`); continue; }
      const html = await res.text();
      for (const j of parseWerknlSearch(html)) out.push(j);
      await new Promise((r) => setTimeout(r, 1500)); // polite delay
    }
    return out;
  }
}
```

- [ ] **Step 10.4: Run test, iterate parser against real fixture**

Run: `npm test -- werknl`

If the fixture structure differs from the selectors in `parseWerknlSearch`, inspect the fixture by hand:
```bash
head -200 tests/fixtures/werknl-search.html
```
and adjust selectors until the test passes. Update the selector list in the parser with the real selectors you find.

- [ ] **Step 10.5: Repeat for nvb.ts**

Create `src/lib/sources/nvb.ts` and `tests/unit/sources/nvb.test.ts` by analogous pattern (structure identical to werknl — only the base URL, search path, and selectors differ). Base URL: `https://www.nationalevacaturebank.nl`. Search path: `/vacature/zoeken?query=<KEYWORD>`. Source name: `"nvb"`.

Reuse the `UA` constant + delay pattern. Iterate against `tests/fixtures/nvb-search.html` until the test passes.

- [ ] **Step 10.6: Commit both sources**

```bash
git add src/lib/sources/werknl.ts src/lib/sources/nvb.ts tests/unit/sources/ tests/fixtures/
git commit -m "feat(sources): Werk.nl and Nationale Vacaturebank parsers"
```

---

## Task 11: Source registry

**Files:**
- Create: `src/lib/sources/index.ts`

- [ ] **Step 11.1: Implement**

Create `src/lib/sources/index.ts`:
```ts
import type { JobSource, RawJob } from "./types";
import { AdzunaSource } from "./adzuna";
import { JoobleSource } from "./jooble";
import { WerknlSource } from "./werknl";
import { NvbSource } from "./nvb";

export type { JobSource, RawJob };

export function allSources(): JobSource[] {
  return [new AdzunaSource(), new JoobleSource(), new WerknlSource(), new NvbSource()];
}
```

- [ ] **Step 11.2: Commit**

```bash
git add src/lib/sources/index.ts
git commit -m "feat(sources): registry"
```

---

## Task 12: Hard filters (Dutch-required, visa, seniority)

**Files:**
- Create: `src/lib/pipeline/filters.ts`
- Test: `tests/unit/filters.test.ts`

- [ ] **Step 12.1: Write failing test**

Create `tests/unit/filters.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { applyHardFilters } from "@/lib/pipeline/filters";

describe("applyHardFilters", () => {
  it("blocks Dutch-required role", () => {
    const r = applyHardFilters({
      title: "Marketing Manager",
      jdText: "Vereist: vloeiend Nederlands, minimaal C1 niveau",
      seniority: null,
    });
    expect(r.filter).toBe("dutch_required");
  });

  it("blocks role requiring visa sponsorship", () => {
    const r = applyHardFilters({
      title: "CRM Lead",
      jdText: "Visa sponsorship available for qualified candidates",
      seniority: null,
    });
    expect(r.filter).toBe("visa_sponsor_needed_not_match");
    // Note: JD offering sponsorship doesn't block; but JD *requiring* EU work auth does.
    // See matrix.
  });

  it("blocks C-level / director+ seniority", () => {
    const r = applyHardFilters({
      title: "VP of Marketing",
      jdText: "...",
      seniority: null,
    });
    expect(r.filter).toBe("seniority_mismatch");
  });

  it("passes a legitimate mid-senior marketing role", () => {
    const r = applyHardFilters({
      title: "Marketing Automation Manager",
      jdText: "English-speaking team. HubSpot experience required.",
      seniority: null,
    });
    expect(r.filter).toBeNull();
  });
});
```

Observation: the test intentionally illustrates a distinction we'll encode — JDs *offering* sponsorship don't block her (she doesn't need it); JDs *requiring* EU work auth already-held don't block either (she has it); JDs *excluding* non-Dutch candidates or similar do. Simplify: v1 only filters on Dutch-required signals. Adjust test accordingly if the distinction is out of scope for Week 1.

- [ ] **Step 12.2: Simplify test to match v1 scope (Dutch + seniority only)**

Replace the failing test file with:
```ts
import { describe, it, expect } from "vitest";
import { applyHardFilters } from "@/lib/pipeline/filters";

describe("applyHardFilters", () => {
  it.each([
    ["vloeiend Nederlands vereist"],
    ["minimaal B2 Dutch"],
    ["Must be fluent in Dutch (C1)"],
    ["Nederlandse moedertaalspreker"],
  ])("blocks Dutch-required phrasing: %s", (phrase) => {
    const r = applyHardFilters({ title: "Marketing Manager", jdText: phrase, seniority: null });
    expect(r.filter).toBe("dutch_required");
  });

  it.each([
    ["VP of Marketing"],
    ["Chief Marketing Officer"],
    ["Director of Growth"],
    ["Head of Marketing (Director level)"],
    ["Marketing Intern"],
    ["Junior Marketing Assistant"],
  ])("blocks seniority mismatch: %s", (title) => {
    const r = applyHardFilters({ title, jdText: "", seniority: null });
    expect(r.filter).toBe("seniority_mismatch");
  });

  it("passes a mid-senior English-first marketing role", () => {
    const r = applyHardFilters({
      title: "Marketing Automation Manager",
      jdText: "English-speaking team. HubSpot experience required.",
      seniority: null,
    });
    expect(r.filter).toBeNull();
  });
});
```

- [ ] **Step 12.3: Implement filters**

Create `src/lib/pipeline/filters.ts`:
```ts
export type FilterReason = "dutch_required" | "seniority_mismatch" | null;

export interface FilterInput {
  title: string;
  jdText: string;
  seniority: string | null;
}

export interface FilterResult {
  filter: FilterReason;
}

const DUTCH_PATTERNS: RegExp[] = [
  /\b(vloeiend|goede?\s+beheersing|moedertaalspreker)\s+.*?\b(nederlands|dutch)\b/i,
  /\bnederlands\b.*?(vereist|must|required|essential)/i,
  /\b(dutch|nederlands)\s+(is\s+)?(fluent|native|c1|b2)\b/i,
  /\bfluent\s+in\s+dutch\b/i,
  /\bminimaal\s+(b2|c1|c2)\s+(nederlands|dutch)\b/i,
  /\bdutch\s+\(?(b2|c1|c2)\)?\b/i,
  /\bnederlandse?\s+moedertaalspreker\b/i,
];

const SENIORITY_BLOCK: RegExp[] = [
  /\b(vp|vice\s+president)\s+of\b/i,
  /\bchief\s+(marketing|growth|revenue)\s+officer\b/i,
  /\bcmo\b/i,
  /\bdirector\s+of\b/i,
  /\bhead\s+of\b.*\bdirector\b/i,
  /\bintern(ship)?\b/i,
  /\bjunior\b/i,
  /\bentry[-\s]?level\b/i,
];

export function applyHardFilters(input: FilterInput): FilterResult {
  const combined = `${input.title}\n${input.jdText}`;
  if (DUTCH_PATTERNS.some((re) => re.test(combined))) return { filter: "dutch_required" };
  if (SENIORITY_BLOCK.some((re) => re.test(input.title))) return { filter: "seniority_mismatch" };
  return { filter: null };
}
```

- [ ] **Step 12.4: Run tests**

Run: `npm test -- filters`
Expected: all PASS.

- [ ] **Step 12.5: Commit**

```bash
git add src/lib/pipeline/filters.ts tests/unit/filters.test.ts
git commit -m "feat(pipeline): hard filters for Dutch and seniority"
```

---

## Task 13: Dedupe

**Files:**
- Create: `src/lib/pipeline/dedupe.ts`
- Test: `tests/unit/dedupe.test.ts`

- [ ] **Step 13.1: Write failing test**

Create `tests/unit/dedupe.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeDedupeHash, clusterJobs } from "@/lib/pipeline/dedupe";
import type { RawJob } from "@/lib/sources/types";

function mk(partial: Partial<RawJob>): RawJob {
  return {
    source: "adzuna",
    sourceExternalId: "x",
    sourceUrl: "https://x",
    title: "Title",
    jdText: "Body",
    companyName: "Co",
    companyDomain: null,
    location: "Amsterdam, NL",
    postedAt: new Date("2026-04-10"),
    ...partial,
  };
}

describe("computeDedupeHash", () => {
  it("normalizes whitespace, case, and punctuation", () => {
    const a = computeDedupeHash({ companyName: "Picnic", title: "Marketing  Manager", location: "Amsterdam NL", postedAt: new Date("2026-04-10") });
    const b = computeDedupeHash({ companyName: " picnic ", title: "Marketing Manager", location: "Amsterdam, NL", postedAt: new Date("2026-04-12") });
    expect(a).toBe(b);
  });

  it("buckets by ISO week of postedAt", () => {
    const w1 = computeDedupeHash({ companyName: "Co", title: "T", location: "L", postedAt: new Date("2026-04-05") });
    const w2 = computeDedupeHash({ companyName: "Co", title: "T", location: "L", postedAt: new Date("2026-04-15") });
    expect(w1).not.toBe(w2);
  });
});

describe("clusterJobs", () => {
  it("picks one canonical per cluster, preserves cross-refs", () => {
    const jobs = [
      mk({ source: "adzuna", sourceExternalId: "1", title: "Marketing Manager" }),
      mk({ source: "jooble", sourceExternalId: "2", title: "Marketing Manager" }),
      mk({ source: "werknl", sourceExternalId: "3", title: "Marketing Manager", companyName: "Different Co" }),
    ];
    const clusters = clusterJobs(jobs);
    expect(clusters.length).toBe(2); // two distinct companies
    const big = clusters.find((c) => c.members.length === 2);
    expect(big).toBeDefined();
    expect(big!.canonical.source).toBeDefined();
  });
});
```

- [ ] **Step 13.2: Implement dedupe**

Create `src/lib/pipeline/dedupe.ts`:
```ts
import type { RawJob } from "@/lib/sources/types";

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function isoWeek(d: Date): string {
  // Compact ISO year-week. Good enough for +/-7d bucketing.
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function computeDedupeHash(input: {
  companyName: string | null; title: string; location: string | null; postedAt: Date | null;
}): string {
  const co = normalize(input.companyName);
  const ti = normalize(input.title);
  const lo = normalize(input.location);
  const wk = input.postedAt ? isoWeek(input.postedAt) : "noweek";
  return `${co}|${ti}|${lo}|${wk}`;
}

export interface JobCluster {
  hash: string;
  canonical: RawJob;
  members: RawJob[];
}

// Source preference (higher index = higher preference — we prefer richer JD text)
const SOURCE_RANK = new Map([
  ["adzuna", 4],
  ["werknl", 3],
  ["nvb", 2],
  ["jooble", 1],
]);

export function clusterJobs(jobs: RawJob[]): JobCluster[] {
  const buckets = new Map<string, RawJob[]>();
  for (const j of jobs) {
    const h = computeDedupeHash({
      companyName: j.companyName,
      title: j.title,
      location: j.location,
      postedAt: j.postedAt,
    });
    const arr = buckets.get(h) ?? [];
    arr.push(j);
    buckets.set(h, arr);
  }
  const out: JobCluster[] = [];
  for (const [hash, members] of buckets.entries()) {
    members.sort((a, b) => {
      const rDiff = (SOURCE_RANK.get(b.source) ?? 0) - (SOURCE_RANK.get(a.source) ?? 0);
      if (rDiff !== 0) return rDiff;
      return b.jdText.length - a.jdText.length;
    });
    out.push({ hash, canonical: members[0], members });
  }
  return out;
}
```

- [ ] **Step 13.3: Run, expect PASS**

Run: `npm test -- dedupe`

- [ ] **Step 13.4: Commit**

```bash
git add src/lib/pipeline/dedupe.ts tests/unit/dedupe.test.ts
git commit -m "feat(pipeline): dedupe via canonical-cluster hashing"
```

---

## Task 14: Tier routing

**Files:**
- Create: `src/lib/pipeline/tier.ts`
- Test: `tests/unit/tier.test.ts`

- [ ] **Step 14.1: Write failing test**

Create `tests/unit/tier.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { assignTier } from "@/lib/pipeline/tier";

describe("assignTier", () => {
  it("returns 1 when fitScore >= 85", () => {
    expect(assignTier(85)).toBe(1);
    expect(assignTier(95.3)).toBe(1);
  });
  it("returns 2 when fitScore in [65, 85)", () => {
    expect(assignTier(65)).toBe(2);
    expect(assignTier(84.9)).toBe(2);
  });
  it("returns 3 when fitScore in [40, 65)", () => {
    expect(assignTier(40)).toBe(3);
    expect(assignTier(64.9)).toBe(3);
  });
  it("returns null when fitScore < 40", () => {
    expect(assignTier(39.9)).toBeNull();
    expect(assignTier(0)).toBeNull();
  });
});
```

- [ ] **Step 14.2: Implement**

Create `src/lib/pipeline/tier.ts`:
```ts
export type Tier = 1 | 2 | 3 | null;

export function assignTier(fitScore: number): Tier {
  if (fitScore >= 85) return 1;
  if (fitScore >= 65) return 2;
  if (fitScore >= 40) return 3;
  return null;
}
```

- [ ] **Step 14.3: Run + commit**

Run: `npm test -- tier` (PASS)
```bash
git add src/lib/pipeline/tier.ts tests/unit/tier.test.ts
git commit -m "feat(pipeline): tier routing"
```

---

## Task 15: Profile embedder

**Files:**
- Create: `src/lib/profile/types.ts`, `src/lib/profile/embedder.ts`

- [ ] **Step 15.1: Define profile types**

Create `src/lib/profile/types.ts`:
```ts
export interface ProfileStory { title: string; situation: string; task: string; action: string; result: string; tags: string[]; }
export interface ProfileRole { company: string; title: string; dates: string; context: string; achievements: string[]; }
export interface Profile {
  roles: ProfileRole[];
  achievements: Array<{ metric: string; context: string; toolStack: string[]; narrative: string }>;
  toolStack: Record<string, string>;  // tool -> proficiency descriptor
  industries: string[];
  stories: ProfileStory[];
  constraints: {
    location?: string; dutchLevel?: string; sponsorNeeded?: boolean; commuteMaxKm?: number;
  };
  preferences: {
    salaryFloorEur?: number; vetoCompanies?: string[]; roleFamilies?: string[];
  };
  portfolioUrl?: string;
  linkedinUrl?: string;
}
```

- [ ] **Step 15.2: Implement embedder**

Create `src/lib/profile/embedder.ts`:
```ts
import type { Profile } from "./types";
import { embedOne } from "@/lib/embeddings";

export function profileToEmbeddingText(p: Profile): string {
  const parts: string[] = [];
  parts.push(`Tools: ${Object.entries(p.toolStack).map(([t, lvl]) => `${t} (${lvl})`).join(", ")}`);
  parts.push(`Industries: ${p.industries.join(", ")}`);
  for (const r of p.roles) parts.push(`${r.title} @ ${r.company}: ${r.achievements.join("; ")}`);
  for (const s of p.stories) parts.push(`${s.title}: ${s.action} → ${s.result}`);
  for (const a of p.achievements) parts.push(`${a.metric} — ${a.context} — tools: ${a.toolStack.join(", ")}`);
  return parts.join("\n");
}

export async function embedProfile(p: Profile): Promise<number[]> {
  return embedOne(profileToEmbeddingText(p));
}
```

- [ ] **Step 15.3: Commit**

```bash
git add src/lib/profile/
git commit -m "feat(profile): types + embedder"
```

---

## Task 16: Ranking

**Files:**
- Create: `src/lib/pipeline/rank.ts`
- Test: `tests/unit/rank.test.ts`

- [ ] **Step 16.1: Write failing test for fit-score blending**

Create `tests/unit/rank.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { blendFitScore } from "@/lib/pipeline/rank";

describe("blendFitScore", () => {
  it("returns 100 when everything is maxed", () => {
    const s = blendFitScore({
      cosineSim: 1.0,
      toolOverlap: 1.0,
      seniorityFit: 1.0,
      geoFit: 1.0,
      industryFit: 1.0,
    });
    expect(s).toBe(100);
  });
  it("returns 0 when everything is zero", () => {
    expect(blendFitScore({
      cosineSim: 0, toolOverlap: 0, seniorityFit: 0, geoFit: 0, industryFit: 0,
    })).toBe(0);
  });
  it("weights: skills 40, tools 25, seniority 15, geo 10, industry 10", () => {
    const s = blendFitScore({
      cosineSim: 1, toolOverlap: 0, seniorityFit: 0, geoFit: 0, industryFit: 0,
    });
    expect(s).toBe(40);
  });
});
```

- [ ] **Step 16.2: Implement ranker**

Create `src/lib/pipeline/rank.ts`:
```ts
import { z } from "zod";
import { getLLM } from "@/lib/llm";
import { cosine } from "@/lib/embeddings";
import type { Profile } from "@/lib/profile/types";

export interface FitComponents {
  cosineSim: number;        // 0..1
  toolOverlap: number;      // 0..1
  seniorityFit: number;     // 0..1
  geoFit: number;           // 0..1
  industryFit: number;      // 0..1
}

const WEIGHTS: FitComponents = {
  cosineSim: 0.40,
  toolOverlap: 0.25,
  seniorityFit: 0.15,
  geoFit: 0.10,
  industryFit: 0.10,
};

export function blendFitScore(c: FitComponents): number {
  const raw =
    c.cosineSim * WEIGHTS.cosineSim +
    c.toolOverlap * WEIGHTS.toolOverlap +
    c.seniorityFit * WEIGHTS.seniorityFit +
    c.geoFit * WEIGHTS.geoFit +
    c.industryFit * WEIGHTS.industryFit;
  return Math.round(Math.max(0, Math.min(1, raw)) * 1000) / 10; // 0..100 with 1 decimal
}

// Haiku-enriched extraction of the non-semantic fit signals
const EnrichSchema = z.object({
  tools: z.array(z.string()),
  seniority: z.enum(["intern", "junior", "mid", "senior", "lead", "manager", "director", "vp", "c_level", "unknown"]),
  dutchRequired: z.boolean(),
  industries: z.array(z.string()),
  locationText: z.string().nullable(),
});
export type JobEnrichment = z.infer<typeof EnrichSchema>;

export async function enrichJob(jdText: string, title: string): Promise<JobEnrichment> {
  const llm = getLLM();
  const res = await llm.structured({
    model: "haiku",
    system: "You extract structured job signals from a JD. Return JSON only.",
    prompt:
      `Title: ${title}\n\nJD:\n${jdText.slice(0, 6000)}\n\n` +
      `Extract: tools (array of tool/software names), seniority (enum), dutchRequired (bool: true only if Dutch fluency is required), industries (array), locationText (string or null).`,
    schema: EnrichSchema,
    maxTokens: 400,
    temperature: 0,
  });
  return res.data;
}

function toolOverlapScore(jobTools: string[], profile: Profile): number {
  if (jobTools.length === 0) return 0.5; // unknown → neutral
  const profTools = new Set(Object.keys(profile.toolStack).map((t) => t.toLowerCase()));
  const matches = jobTools.filter((t) => profTools.has(t.toLowerCase())).length;
  return matches / jobTools.length;
}

const MID_SENIOR = new Set(["mid", "senior", "lead", "manager"]);
function seniorityFitScore(s: JobEnrichment["seniority"]): number {
  if (MID_SENIOR.has(s)) return 1;
  if (s === "unknown") return 0.6;
  return 0;
}

function geoFitScore(loc: string | null, profile: Profile): number {
  if (!loc) return 0.6;
  const lower = loc.toLowerCase();
  if (/netherlands|nederland|amsterdam|rotterdam|utrecht|den haag|the hague|eindhoven|haarlem|beverwijk/.test(lower)) return 1;
  if (/remote|europe|hybrid/.test(lower)) return 0.7;
  return 0.1;
}

function industryFitScore(jobIndustries: string[], profile: Profile): number {
  if (jobIndustries.length === 0) return 0.5;
  const prof = new Set(profile.industries.map((i) => i.toLowerCase()));
  const matches = jobIndustries.filter((i) => prof.has(i.toLowerCase())).length;
  return matches > 0 ? Math.min(1, matches / Math.max(1, jobIndustries.length)) : 0.3;
}

export async function rankJob(params: {
  jdEmbedding: number[];
  profileEmbedding: number[];
  profile: Profile;
  enrichment: JobEnrichment;
}): Promise<{ fitScore: number; breakdown: FitComponents }> {
  const cosineSim = Math.max(0, Math.min(1, (cosine(params.jdEmbedding, params.profileEmbedding) + 1) / 2));
  const toolOverlap = toolOverlapScore(params.enrichment.tools, params.profile);
  const seniorityFit = seniorityFitScore(params.enrichment.seniority);
  const geoFit = geoFitScore(params.enrichment.locationText, params.profile);
  const industryFit = industryFitScore(params.enrichment.industries, params.profile);
  const breakdown = { cosineSim, toolOverlap, seniorityFit, geoFit, industryFit };
  return { fitScore: blendFitScore(breakdown), breakdown };
}
```

- [ ] **Step 16.3: Run test + commit**

Run: `npm test -- rank`
Expected: PASS.
```bash
git add src/lib/pipeline/rank.ts tests/unit/rank.test.ts
git commit -m "feat(pipeline): blended fit score + Haiku JD enrichment"
```

---

## Task 17: Resend notifier

**Files:**
- Create: `src/lib/notify/resend.ts`

- [ ] **Step 17.1: Implement notifier**

Create `src/lib/notify/resend.ts`:
```ts
import { Resend } from "resend";
import { loadEnv } from "@/lib/env";

function client() { return new Resend(loadEnv().RESEND_API_KEY); }

export async function emailAdmin(subject: string, html: string): Promise<void> {
  const env = loadEnv();
  await client().emails.send({
    from: env.RESEND_FROM,
    to: env.ADMIN_EMAIL,
    subject: `[AIJS] ${subject}`,
    html,
  });
}

export async function emailHeartbeat(runId: string, summary: Record<string, unknown>): Promise<void> {
  await emailAdmin(
    `Run ${runId} OK`,
    `<p>Nightly run succeeded.</p><pre>${JSON.stringify(summary, null, 2)}</pre>`,
  );
}

export async function emailFailure(runId: string, error: unknown): Promise<void> {
  const msg = error instanceof Error ? `${error.message}\n\n${error.stack}` : String(error);
  await emailAdmin(
    `Run ${runId} FAILED`,
    `<p>Nightly run failed.</p><pre>${msg.replace(/</g, "&lt;")}</pre>`,
  );
}
```

- [ ] **Step 17.2: Commit**

```bash
git add src/lib/notify/
git commit -m "feat(notify): Resend heartbeat + failure email"
```

---

## Task 18: Pipeline orchestrator

**Files:**
- Create: `src/lib/pipeline/discover.ts`, `src/lib/pipeline/orchestrator.ts`
- Test: `tests/integration/pipeline.test.ts`

- [ ] **Step 18.1: Discover stage — fan out sources in parallel with limits**

Create `src/lib/pipeline/discover.ts`:
```ts
import pLimit from "p-limit";
import { allSources } from "@/lib/sources";
import type { RawJob } from "@/lib/sources/types";

export async function discover(): Promise<{ jobs: RawJob[]; perSource: Record<string, number>; errors: Record<string, string> }> {
  const limit = pLimit(2);
  const sources = allSources();
  const perSource: Record<string, number> = {};
  const errors: Record<string, string> = {};
  const results = await Promise.all(
    sources.map((s) =>
      limit(async () => {
        try {
          const jobs = await s.fetch();
          perSource[s.name] = jobs.length;
          return jobs;
        } catch (e) {
          errors[s.name] = e instanceof Error ? e.message : String(e);
          perSource[s.name] = 0;
          return [] as RawJob[];
        }
      }),
    ),
  );
  return { jobs: results.flat(), perSource, errors };
}
```

- [ ] **Step 18.2: Orchestrator — discover → dedupe → persist companies → persist jobs → rank → tier**

Create `src/lib/pipeline/orchestrator.ts`:
```ts
import { db, schema } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { discover } from "./discover";
import { clusterJobs, computeDedupeHash } from "./dedupe";
import { applyHardFilters } from "./filters";
import { enrichJob, rankJob } from "./rank";
import { assignTier } from "./tier";
import { embedMany } from "@/lib/embeddings";
import { emailFailure, emailHeartbeat } from "@/lib/notify/resend";
import type { Profile } from "@/lib/profile/types";

export interface RunSummary {
  runId: string;
  counts: {
    discovered: number;
    clusters: number;
    inserted: number;
    filtered: number;
    ranked: number;
    byTier: Record<string, number>;
  };
  perSource: Record<string, number>;
  errors: Record<string, string>;
}

export async function runNightly(): Promise<RunSummary> {
  const [run] = await db.insert(schema.runs).values({ status: "running" }).returning();
  const runId = run.id;
  try {
    // 1) discover
    const { jobs: rawJobs, perSource, errors } = await discover();
    const discovered = rawJobs.length;

    // 2) cluster
    const clusters = clusterJobs(rawJobs);

    // 3) load profile
    const [profileRow] = await db.select().from(schema.profile).limit(1);
    if (!profileRow) throw new Error("No profile row found — seed /admin/profile first");
    const profile = {
      roles: profileRow.roles as Profile["roles"],
      achievements: profileRow.achievements as Profile["achievements"],
      toolStack: profileRow.toolStack as Profile["toolStack"],
      industries: profileRow.industries as Profile["industries"],
      stories: profileRow.stories as Profile["stories"],
      constraints: profileRow.constraints as Profile["constraints"],
      preferences: profileRow.preferences as Profile["preferences"],
    };
    const profileEmbedding = profileRow.profileEmbedding as number[] | null;
    if (!profileEmbedding) throw new Error("Profile embedding missing — re-save profile to trigger embedding");

    // 4) for each cluster canonical — filter → embed → enrich → rank → tier → upsert
    const byTier: Record<string, number> = { "1": 0, "2": 0, "3": 0, "filtered": 0 };
    let inserted = 0, filtered = 0, ranked = 0;

    // Batch embeds for efficiency (up to 100 per call)
    const canonicals = clusters.map((c) => c.canonical);
    const jdEmbeds = await embedMany(canonicals.map((j) => `${j.title}\n\n${j.jdText.slice(0, 4000)}`));

    for (let i = 0; i < canonicals.length; i++) {
      const j = canonicals[i];
      const jdEmbedding = jdEmbeds[i];

      // Ensure company row
      let companyId: string | null = null;
      if (j.companyName) {
        const [existing] = await db
          .select({ id: schema.companies.id })
          .from(schema.companies)
          .where(eq(schema.companies.name, j.companyName))
          .limit(1);
        if (existing) {
          companyId = existing.id;
        } else {
          const [created] = await db
            .insert(schema.companies)
            .values({ name: j.companyName })
            .returning({ id: schema.companies.id });
          companyId = created.id;
        }
      }

      const hardFilter = applyHardFilters({ title: j.title, jdText: j.jdText, seniority: null });

      const dedupeHash = computeDedupeHash({
        companyName: j.companyName,
        title: j.title,
        location: j.location,
        postedAt: j.postedAt,
      });

      // Upsert by (source, sourceExternalId) uniqueness; we use dedupeHash to detect duplicates within run
      const existing = await db
        .select({ id: schema.jobs.id })
        .from(schema.jobs)
        .where(and(eq(schema.jobs.source, j.source), eq(schema.jobs.sourceExternalId, j.sourceExternalId)))
        .limit(1);
      if (existing.length > 0) continue; // already in DB

      if (hardFilter.filter) {
        await db.insert(schema.jobs).values({
          companyId,
          source: j.source,
          sourceUrl: j.sourceUrl,
          sourceExternalId: j.sourceExternalId,
          title: j.title,
          jdText: j.jdText,
          jdEmbedding,
          location: j.location,
          postedAt: j.postedAt ?? null,
          dedupeHash,
          dutchRequired: hardFilter.filter === "dutch_required",
          hardFilterReason: hardFilter.filter,
          tier: null,
        });
        filtered++;
        byTier.filtered++;
        inserted++;
        continue;
      }

      // rank
      const enrichment = await enrichJob(j.jdText, j.title);
      const rank = await rankJob({ jdEmbedding, profileEmbedding, profile, enrichment });
      const tier = assignTier(rank.fitScore);

      await db.insert(schema.jobs).values({
        companyId,
        source: j.source,
        sourceUrl: j.sourceUrl,
        sourceExternalId: j.sourceExternalId,
        title: j.title,
        jdText: j.jdText,
        jdEmbedding,
        location: j.location,
        postedAt: j.postedAt ?? null,
        dedupeHash,
        dutchRequired: enrichment.dutchRequired,
        seniority: enrichment.seniority,
        fitScore: String(rank.fitScore),
        fitBreakdown: rank.breakdown,
        tier,
      });
      ranked++;
      inserted++;
      const key = tier ? String(tier) : "filtered";
      byTier[key] = (byTier[key] ?? 0) + 1;
    }

    const summary: RunSummary = {
      runId,
      counts: { discovered, clusters: clusters.length, inserted, filtered, ranked, byTier },
      perSource,
      errors,
    };
    await db
      .update(schema.runs)
      .set({
        endedAt: sql`now()`,
        status: Object.keys(errors).length ? "partial" : "succeeded",
        stageMetrics: summary,
      })
      .where(eq(schema.runs.id, runId));
    await emailHeartbeat(runId, summary);
    return summary;
  } catch (e) {
    await db
      .update(schema.runs)
      .set({
        endedAt: sql`now()`,
        status: "failed",
        errorJson: { message: e instanceof Error ? e.message : String(e) },
      })
      .where(eq(schema.runs.id, runId));
    await emailFailure(runId, e);
    throw e;
  }
}
```

- [ ] **Step 18.3: Integration smoke test with mocked sources**

Create `tests/integration/pipeline.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

// Mock sources to avoid network
vi.mock("@/lib/sources", async () => {
  const { RawJob } = await import("@/lib/sources/types");
  return {
    allSources: () => [
      {
        name: "fake",
        async fetch() {
          return [
            {
              source: "fake",
              sourceExternalId: "f1",
              sourceUrl: "https://x/f1",
              title: "Marketing Automation Manager",
              jdText: "HubSpot, lifecycle, segmentation, English-speaking team.",
              companyName: "Test Co",
              companyDomain: null,
              location: "Amsterdam, NL",
              postedAt: new Date(),
            } satisfies typeof RawJob,
          ];
        },
      },
    ],
  };
});

vi.mock("@/lib/notify/resend", () => ({
  emailAdmin: vi.fn(), emailHeartbeat: vi.fn(), emailFailure: vi.fn(),
}));

describe("runNightly", () => {
  it("processes one fake job end-to-end (requires DB + LLM env)", async () => {
    if (!process.env.RUN_INTEGRATION) {
      console.log("skipped — set RUN_INTEGRATION=1 to run");
      return;
    }
    const { runNightly } = await import("@/lib/pipeline/orchestrator");
    const s = await runNightly();
    expect(s.counts.discovered).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 18.4: Typecheck + unit tests (integration skipped by default)**

Run: `npm run typecheck && npm test`
Expected: all green. The integration test is skipped unless `RUN_INTEGRATION=1`.

- [ ] **Step 18.5: Commit**

```bash
git add src/lib/pipeline/discover.ts src/lib/pipeline/orchestrator.ts tests/integration/pipeline.test.ts
git commit -m "feat(pipeline): orchestrator + integration smoke"
```

---

## Task 19: Admin auth gate

**Files:**
- Create: `src/lib/auth/admin.ts`
- Create: `src/app/admin/layout.tsx`

- [ ] **Step 19.1: Implement admin gate**

Create `src/lib/auth/admin.ts`:
```ts
import { cookies } from "next/headers";
import { loadEnv } from "@/lib/env";

const COOKIE = "aijs_admin";

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value === loadEnv().ADMIN_SECRET;
}

export async function setAdminCookie(secret: string): Promise<boolean> {
  if (secret !== loadEnv().ADMIN_SECRET) return false;
  const jar = await cookies();
  jar.set(COOKIE, secret, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return true;
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
```

- [ ] **Step 19.2: Create admin layout gate**

Create `src/app/admin/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");
  return <div style={{ padding: 24 }}>{children}</div>;
}
```

Create `src/app/admin/login/page.tsx`:
```tsx
"use client";
import { useState } from "react";

export default function Login() {
  const [secret, setSecret] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      style={{ padding: 24, maxWidth: 360 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await fetch("/api/admin/login", { method: "POST", body: JSON.stringify({ secret }) });
        if (r.ok) window.location.href = "/admin";
        else setErr("Invalid secret");
      }}
    >
      <h1>Admin</h1>
      <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="ADMIN_SECRET" style={{ width: "100%" }} />
      <button type="submit">Login</button>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
    </form>
  );
}
```

Create `src/app/api/admin/login/route.ts`:
```ts
import { NextResponse } from "next/server";
import { setAdminCookie } from "@/lib/auth/admin";

export async function POST(req: Request) {
  const { secret } = (await req.json()) as { secret?: string };
  if (!secret) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await setAdminCookie(secret);
  return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
}
```

- [ ] **Step 19.3: Commit**

```bash
git add src/lib/auth/ src/app/admin/ src/app/api/admin/
git commit -m "feat(auth): admin cookie gate"
```

---

## Task 20: Admin profile intake form

**Files:**
- Create: `src/app/admin/profile/page.tsx`
- Create: `src/app/api/admin/profile/route.ts`

- [ ] **Step 20.1: API route for upsert**

Create `src/app/api/admin/profile/route.ts`:
```ts
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { isAdmin } from "@/lib/auth/admin";
import { embedProfile } from "@/lib/profile/embedder";
import type { Profile } from "@/lib/profile/types";
import { sql } from "drizzle-orm";

export async function GET() {
  if (!(await isAdmin())) return new NextResponse("forbidden", { status: 403 });
  const [row] = await db.select().from(schema.profile).limit(1);
  return NextResponse.json(row ?? null);
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return new NextResponse("forbidden", { status: 403 });
  const body = (await req.json()) as Profile;
  const embedding = await embedProfile(body);
  const existing = await db.select({ id: schema.profile.id }).from(schema.profile).limit(1);
  if (existing.length) {
    await db.update(schema.profile).set({
      roles: body.roles, achievements: body.achievements, toolStack: body.toolStack,
      industries: body.industries, stories: body.stories, constraints: body.constraints,
      preferences: body.preferences, profileEmbedding: embedding, updatedAt: sql`now()`,
    });
  } else {
    await db.insert(schema.profile).values({
      roles: body.roles, achievements: body.achievements, toolStack: body.toolStack,
      industries: body.industries, stories: body.stories, constraints: body.constraints,
      preferences: body.preferences, profileEmbedding: embedding,
    });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 20.2: Intake form**

Create `src/app/admin/profile/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [json, setJson] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/profile").then(async (r) => {
      const data = await r.json();
      setJson(JSON.stringify(data ?? {
        roles: [], achievements: [], toolStack: {}, industries: [], stories: [],
        constraints: {}, preferences: {},
      }, null, 2));
    });
  }, []);

  async function save() {
    try {
      const parsed = JSON.parse(json);
      const r = await fetch("/api/admin/profile", { method: "POST", body: JSON.stringify(parsed) });
      setMsg(r.ok ? "Saved" : `Error ${r.status}`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <main>
      <h1>Profile (JSON editor)</h1>
      <p>Edit the structured profile. Saving re-computes the embedding.</p>
      <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={40} style={{ width: "100%", fontFamily: "monospace" }} />
      <button onClick={save}>Save</button>
      {msg && <p>{msg}</p>}
    </main>
  );
}
```

This is a raw JSON editor — perfect for Avi-filled admin use in Week 1. A richer form can come later.

- [ ] **Step 20.3: Commit**

```bash
git add src/app/admin/profile/ src/app/api/admin/profile/
git commit -m "feat(admin): profile intake (raw JSON editor)"
```

---

## Task 21: Admin — runs & jobs views

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/runs/page.tsx`, `src/app/admin/jobs/page.tsx`

- [ ] **Step 21.1: Admin nav**

Create `src/app/admin/page.tsx`:
```tsx
import Link from "next/link";

export default function AdminHome() {
  return (
    <main>
      <h1>Admin</h1>
      <ul>
        <li><Link href="/admin/profile">Profile</Link></li>
        <li><Link href="/admin/jobs">Jobs (ranked)</Link></li>
        <li><Link href="/admin/runs">Runs</Link></li>
      </ul>
    </main>
  );
}
```

- [ ] **Step 21.2: Jobs view (ranked list, filter by tier)**

Create `src/app/admin/jobs/page.tsx`:
```tsx
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const rows = await db
    .select()
    .from(schema.jobs)
    .orderBy(desc(schema.jobs.fitScore))
    .limit(200);
  return (
    <main>
      <h1>Jobs</h1>
      <table border={1} cellPadding={6}>
        <thead>
          <tr><th>Fit</th><th>Tier</th><th>Title</th><th>Location</th><th>Src</th><th>Filter</th><th>URL</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.fitScore ?? "—"}</td>
              <td>{r.tier ?? "—"}</td>
              <td>{r.title}</td>
              <td>{r.location ?? ""}</td>
              <td>{r.source}</td>
              <td>{r.hardFilterReason ?? ""}</td>
              <td><a href={r.sourceUrl} target="_blank" rel="noreferrer">open</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 21.3: Runs view**

Create `src/app/admin/runs/page.tsx`:
```tsx
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const rows = await db.select().from(schema.runs).orderBy(desc(schema.runs.startedAt)).limit(50);
  return (
    <main>
      <h1>Runs</h1>
      <table border={1} cellPadding={6}>
        <thead><tr><th>Started</th><th>Ended</th><th>Status</th><th>Metrics</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.startedAt?.toISOString()}</td>
              <td>{r.endedAt?.toISOString() ?? "—"}</td>
              <td>{r.status}</td>
              <td><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(r.stageMetrics ?? r.errorJson ?? {}, null, 2)}</pre></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 21.4: Commit**

```bash
git add src/app/admin/page.tsx src/app/admin/runs/ src/app/admin/jobs/
git commit -m "feat(admin): runs + jobs views"
```

---

## Task 22: Cron endpoint + manual trigger

**Files:**
- Create: `src/app/api/cron/nightly/route.ts`, `src/app/api/admin/trigger-run/route.ts`, `src/app/api/health/route.ts`

- [ ] **Step 22.1: Cron nightly**

Create `src/app/api/cron/nightly/route.ts`:
```ts
import { NextResponse } from "next/server";
import { runNightly } from "@/lib/pipeline/orchestrator";
import { loadEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const env = loadEnv();
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const summary = await runNightly();
  return NextResponse.json(summary);
}
```

- [ ] **Step 22.2: Admin manual trigger (calls cron endpoint internally)**

Create `src/app/api/admin/trigger-run/route.ts`:
```ts
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { runNightly } from "@/lib/pipeline/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  if (!(await isAdmin())) return new NextResponse("forbidden", { status: 403 });
  const s = await runNightly();
  return NextResponse.json(s);
}
```

- [ ] **Step 22.3: Health endpoint**

Create `src/app/api/health/route.ts`:
```ts
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 22.4: Vercel config — cron + crons**

Create `vercel.ts`:
```ts
import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "next build",
  framework: "nextjs",
  crons: [
    { path: "/api/cron/nightly", schedule: "0 2 * * *" }, // 02:00 UTC daily (adjust for CET if needed via TZ)
  ],
};
export default config;
```

Note: as of 2026-04-14, confirm the current recommended Vercel project config format by consulting Vercel docs (sitemap at `https://vercel.com/sitemap/docs.xml`). If `vercel.ts` is not the current form, fall back to `vercel.json`:
```json
{
  "crons": [{ "path": "/api/cron/nightly", "schedule": "0 2 * * *" }]
}
```

- [ ] **Step 22.5: Commit**

```bash
git add src/app/api/cron/ src/app/api/admin/trigger-run/ src/app/api/health/ vercel.ts
git commit -m "feat(cron): nightly endpoint + manual trigger + health"
```

---

## Task 23: Deploy to Vercel + set env vars

This is a one-time Avi-performed task. Claude provides exact commands.

- [ ] **Step 23.1: Install Vercel CLI if missing**

```bash
npm i -g vercel@latest
```

- [ ] **Step 23.2: Link repo to Vercel**

```bash
vercel link
```
Follow prompts: create new project named `ai-job-search`, scope under Avi's account, framework Next.js (auto-detected).

- [ ] **Step 23.3: Set production env vars**

For each env var in `.env.example`, run:
```bash
vercel env add DATABASE_URL production
# paste the Neon DSN, repeat for every variable
```

Minimum required for Week 1: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN` (create a store with `vercel blob store add`), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JOOBLE_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_EMAIL`, `CANDIDATE_EMAIL`, `ADMIN_SECRET`, `CRON_SECRET`.

Pull them locally for dev:
```bash
vercel env pull .env.local
```

- [ ] **Step 23.4: Deploy**

```bash
vercel --prod
```
Expected: deploy URL printed. Visit `<url>/api/health` — should return `{ ok: true }`.

- [ ] **Step 23.5: Verify cron registration**

In Vercel dashboard → Settings → Cron Jobs: confirm `/api/cron/nightly` shows as scheduled at `0 2 * * *`.

- [ ] **Step 23.6: Smoke-run the pipeline**

From Vercel CLI:
```bash
vercel logs --prod --follow &
curl -X POST -H "Cookie: aijs_admin=<ADMIN_SECRET>" https://<project>.vercel.app/api/admin/trigger-run
```
(Admin cookie obtained by logging into `/admin/login` first.)

Expected: run logs show discover → cluster → rank → persist; Vercel logs show no errors; `/admin/jobs` shows ranked rows; `/admin/runs` shows a `succeeded` row; Avi receives heartbeat email.

If the run fails, read `runs.error_json` in DB (via `/admin/runs`) and fix.

---

## Task 24: End-of-week acceptance checklist

- [ ] **Step 24.1: Acceptance review**

Manually verify all of:

- `/admin/profile` accepts and saves profile JSON; embedding present (inspect via `SELECT id, profile_embedding IS NOT NULL FROM profile;`)
- `/admin/jobs` shows ≥ 30 ranked jobs from the last nightly run
- At least 3 jobs have `tier = 1` (if fewer, log and iterate ranking weights — not a blocker for the week)
- At least 5 jobs show `hardFilterReason = 'dutch_required'`
- `/admin/runs` shows the last run as `succeeded` or `partial`
- `/api/health` returns ok
- Avi received one heartbeat email from the last run
- Typecheck and test suites pass on CI (if CI wired; otherwise locally)

- [ ] **Step 24.2: Final commit**

```bash
git add -A
git commit -m "chore(week-1): acceptance complete — foundation + discovery + ranking live"
```

---

## Risk flags for Week 1

1. **Werk.nl / NVB client-side rendering** — If either source renders jobs only in JS, the cheerio parser returns zero. **Mitigation:** inspect fixture in Task 10.1; if so, document and defer to Week 2 when we can add a lightweight fetch via their JSON XHR, or drop that source and raise Adzuna keyword volume.
2. **Adzuna/Jooble rate limits** — Free tiers may throttle after heavy keyword fan-out. **Mitigation:** `perSource` error tracking in `discover()` reports clearly; reduce keyword list or pages per source if needed.
3. **Neon free-tier compute exhaustion** — Heavy nightly writes + vector ops can consume compute hours. **Mitigation:** monitor in Neon dashboard after first 3 nights; tune by reducing daily keyword span or batching upserts.
4. **Profile embedding drift** — If the profile is re-saved frequently during iteration, re-embedding on every save is fine but tracked. **Mitigation:** `updated_at` logged; Week 2 can diff-detect.
5. **Pipeline function timeout (300s cap on Hobby)** — Large discovery windows could exceed. **Mitigation:** orchestrator logs per-stage timing; split into two crons (one discover, one rank) in Week 2 if needed.

---

## Self-review notes

- Spec coverage: all Week 1 items from spec §17 "Week 1 — Foundation" are covered by Tasks 1–24 (repo scaffold Task 1, env + config Tasks 2, schema Task 3, Neon provision Task 4, discovery Tasks 8–11, ranking Tasks 12–16, dedupe Task 13, profile intake Tasks 15/20, heartbeat/failure Task 17, orchestrator Task 18, admin Tasks 19–21, cron deploy Tasks 22–23).
- Placeholder scan: no TBD/TODO in actionable steps. Werk.nl/NVB parsers explicitly call out fixture-dependent iteration — concrete guidance, not a placeholder.
- Type consistency: `RawJob` shape used consistently across sources, dedupe, orchestrator. `FitComponents` shape used consistently across rank test, rank impl, orchestrator. `LLMAdapter` interface consistent across adapter/gateway/index.
- Ambiguity: external-task steps (Neon provision, Vercel deploy) are clearly Avi-performed and labelled; all other steps are Claude-executable.
