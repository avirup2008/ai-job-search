import { describe, it, expect } from "vitest";

describe("NVB live", () => {
  it("fetches NL marketing jobs", async () => {
    if (!process.env.RUN_INTEGRATION) {
      console.log("skipped — set RUN_INTEGRATION=1");
      return;
    }
    const { NvbSource } = await import("@/lib/sources/nvb");
    const src = new NvbSource();
    const jobs = await src.fetch();
    expect(Array.isArray(jobs)).toBe(true);
    console.log(`[nvb] fetched ${jobs.length} jobs`);
    for (const j of jobs.slice(0, 3)) {
      console.log(`  - ${j.title} @ ${j.companyName ?? "?"} (${j.location ?? "?"})`);
    }
  }, 120_000);
});
