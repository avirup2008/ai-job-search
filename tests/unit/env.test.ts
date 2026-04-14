import { describe, it, expect, beforeEach } from "vitest";

describe("env per-feature loaders", () => {
  beforeEach(async () => {
    const mod = await import("@/lib/env");
    mod._clearEnvCache();
  });

  it("loadDbEnv throws when DATABASE_URL missing", async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const { loadDbEnv } = await import("@/lib/env");
    expect(() => loadDbEnv()).toThrow(/DATABASE_URL/);
    if (prev) process.env.DATABASE_URL = prev;
  });

  it("loadDbEnv returns DATABASE_URL when set", async () => {
    process.env.DATABASE_URL = "postgres://x";
    const { loadDbEnv } = await import("@/lib/env");
    expect(loadDbEnv().DATABASE_URL).toBe("postgres://x");
  });

  it("loadSourcesEnv requires Adzuna + Jooble keys", async () => {
    delete process.env.ADZUNA_APP_ID;
    const { loadSourcesEnv } = await import("@/lib/env");
    expect(() => loadSourcesEnv()).toThrow(/ADZUNA_APP_ID/);
  });

  it("loadLlmEnv defaults MONTHLY_LLM_CAP_EUR to 20", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-x";
    delete process.env.MONTHLY_LLM_CAP_EUR;
    const { loadLlmEnv } = await import("@/lib/env");
    expect(loadLlmEnv().MONTHLY_LLM_CAP_EUR).toBe(20);
  });

  it("loadAdminEnv enforces 32-char minimum", async () => {
    process.env.ADMIN_SECRET = "tooshort";
    const { loadAdminEnv } = await import("@/lib/env");
    expect(() => loadAdminEnv()).toThrow(/at least 32 characters/);
  });

  it("loaders cache results — second call does not re-validate", async () => {
    process.env.DATABASE_URL = "postgres://first";
    const { loadDbEnv } = await import("@/lib/env");
    expect(loadDbEnv().DATABASE_URL).toBe("postgres://first");
    process.env.DATABASE_URL = "postgres://second";
    expect(loadDbEnv().DATABASE_URL).toBe("postgres://first"); // cached
  });
});
