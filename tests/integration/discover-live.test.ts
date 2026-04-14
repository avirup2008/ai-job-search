import { describe, it, expect } from "vitest";

describe("discover() live", () => {
  it("fans out all real sources and returns totals", async () => {
    if (!process.env.RUN_INTEGRATION) {
      console.log("skipped — set RUN_INTEGRATION=1");
      return;
    }
    const { discover } = await import("@/lib/pipeline/discover");
    const r = await discover();
    console.log(`[discover] ${r.jobs.length} jobs across ${Object.keys(r.perSource).length} sources in ${r.elapsedMs}ms`);
    console.log(`  perSource:`, r.perSource);
    if (Object.keys(r.errors).length > 0) console.log(`  errors:`, r.errors);
    expect(r.jobs.length).toBeGreaterThan(0);
    expect(Object.keys(r.perSource).sort()).toEqual(["adzuna", "jooble", "magnetme", "nvb"]);
  }, 180_000);
});
