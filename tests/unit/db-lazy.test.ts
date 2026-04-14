import { describe, it, expect, afterEach } from "vitest";

describe("db lazy init", () => {
  const prev = process.env.DATABASE_URL;
  afterEach(() => { if (prev) process.env.DATABASE_URL = prev; else delete process.env.DATABASE_URL; });

  it("can be imported without DATABASE_URL set", async () => {
    delete process.env.DATABASE_URL;
    // Re-import in a fresh module state
    const mod = await import("@/db");
    expect(mod.db).toBeDefined();
    expect(mod.schema).toBeDefined();
  });

  it("throws a clear error when db is used without DATABASE_URL", async () => {
    delete process.env.DATABASE_URL;
    const mod = await import("@/db");
    // Accessing any method on db should throw
    expect(() => {
      // Accessing any property triggers the proxy's get trap → getDb() → throws
      return (mod.db as unknown as Record<string, unknown>)["$count"];
    }).toThrow(/DATABASE_URL is not set/);
  });
});
