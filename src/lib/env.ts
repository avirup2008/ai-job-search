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

export function tryLoadEnv(): Env | null {
  try { return loadEnv(); } catch { return null; }
}
