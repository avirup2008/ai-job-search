import { z } from "zod";

// Per-feature schemas. Each loader only asserts what its feature needs.
// Importing the function does NOT validate; calling it does.

const dbSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (set via Vercel + Neon Marketplace integration)"),
});

const llmSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required for LLM calls"),
  AI_GATEWAY_URL: z.string().url().optional(),
  MONTHLY_LLM_CAP_EUR: z.coerce.number().positive().default(20),
});

const sourcesSchema = z.object({
  ADZUNA_APP_ID: z.string().min(1, "ADZUNA_APP_ID is required for Adzuna source"),
  ADZUNA_APP_KEY: z.string().min(1, "ADZUNA_APP_KEY is required for Adzuna source"),
  JOOBLE_API_KEY: z.string().min(1, "JOOBLE_API_KEY is required for Jooble source"),
});

const notifySchema = z.object({
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required for email notifications"),
  RESEND_FROM: z.string().email("RESEND_FROM must be a valid email address"),
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email address"),
  CANDIDATE_EMAIL: z.string().email("CANDIDATE_EMAIL must be a valid email address"),
});

const adminSchema = z.object({
  ADMIN_SECRET: z.string().min(32, "ADMIN_SECRET must be at least 32 characters"),
});

const cronSchema = z.object({
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 characters"),
});

const blobSchema = z.object({
  BLOB_READ_WRITE_TOKEN: z.string().min(1, "BLOB_READ_WRITE_TOKEN is required for Vercel Blob"),
});

const retentionSchema = z.object({
  // Default "true" → first deploy is observe-only. Flip to "false" in env to enable real deletion.
  RETENTION_DRY_RUN: z.enum(["true", "false"]).default("true"),
});

const generalSchema = z.object({
  TZ: z.string().default("Europe/Amsterdam"),
});

// Type exports — feature consumers import these
export type DbEnv = z.infer<typeof dbSchema>;
export type LlmEnv = z.infer<typeof llmSchema>;
export type SourcesEnv = z.infer<typeof sourcesSchema>;
export type NotifyEnv = z.infer<typeof notifySchema>;
export type AdminEnv = z.infer<typeof adminSchema>;
export type CronEnv = z.infer<typeof cronSchema>;
export type BlobEnv = z.infer<typeof blobSchema>;
export type GeneralEnv = z.infer<typeof generalSchema>;
export type RetentionEnv = z.infer<typeof retentionSchema>;

function load<T>(schema: z.ZodType<T>, label: string): T {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid env for ${label}:\n${issues}`);
  }
  return parsed.data;
}

// Caches keep loaders cheap on repeat calls.
// Typed as unknown and cast on read to avoid Zod default() output type conflicts.
let dbCache: unknown = null;
let llmCache: unknown = null;
let sourcesCache: unknown = null;
let notifyCache: unknown = null;
let adminCache: unknown = null;
let cronCache: unknown = null;
let blobCache: unknown = null;
let generalCache: unknown = null;
let retentionCache: unknown = null;

export function loadDbEnv(): DbEnv { return (dbCache as DbEnv) ?? (dbCache = load(dbSchema, "database")) as DbEnv; }
export function loadLlmEnv(): LlmEnv { return (llmCache as LlmEnv) ?? (llmCache = load(llmSchema, "llm")) as LlmEnv; }
export function loadSourcesEnv(): SourcesEnv { return (sourcesCache as SourcesEnv) ?? (sourcesCache = load(sourcesSchema, "sources")) as SourcesEnv; }
export function loadNotifyEnv(): NotifyEnv { return (notifyCache as NotifyEnv) ?? (notifyCache = load(notifySchema, "notify")) as NotifyEnv; }
export function loadAdminEnv(): AdminEnv { return (adminCache as AdminEnv) ?? (adminCache = load(adminSchema, "admin")) as AdminEnv; }
export function loadCronEnv(): CronEnv { return (cronCache as CronEnv) ?? (cronCache = load(cronSchema, "cron")) as CronEnv; }
export function loadBlobEnv(): BlobEnv { return (blobCache as BlobEnv) ?? (blobCache = load(blobSchema, "blob")) as BlobEnv; }
export function loadGeneralEnv(): GeneralEnv { return (generalCache as GeneralEnv) ?? (generalCache = load(generalSchema, "general")) as GeneralEnv; }
export function loadRetentionEnv(): RetentionEnv { return (retentionCache as RetentionEnv) ?? (retentionCache = load(retentionSchema, "retention")) as RetentionEnv; }

// Test-only: clear all caches (used by vitest setup if needed)
export function _clearEnvCache(): void {
  dbCache = null; llmCache = null; sourcesCache = null; notifyCache = null;
  adminCache = null; cronCache = null; blobCache = null; generalCache = null;
  retentionCache = null;
}
