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
