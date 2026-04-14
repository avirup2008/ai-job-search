import { describe, it, expect } from "vitest";

describe("Magnet.me live", () => {
  it("fetches NL marketing jobs", async () => {
    if (!process.env.RUN_INTEGRATION) {
      console.log("skipped — set RUN_INTEGRATION=1");
      return;
    }
    const { MagnetmeSource } = await import("@/lib/sources/magnetme");
    const src = new MagnetmeSource();
    const jobs = await src.fetch();
    expect(Array.isArray(jobs)).toBe(true);
    console.log(`[magnetme] fetched ${jobs.length} jobs`);
    for (const j of jobs.slice(0, 3)) {
      console.log(`  - ${j.title} @ ${j.companyName ?? "?"} (${j.location ?? "?"})`);
    }
  }, 120_000);
});
