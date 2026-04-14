import { describe, it, expect } from "vitest";

describe("Adzuna live", () => {
  it("fetches NL marketing jobs with real keys", async () => {
    if (!process.env.RUN_INTEGRATION) {
      console.log("skipped — set RUN_INTEGRATION=1");
      return;
    }
    const { AdzunaSource } = await import("@/lib/sources/adzuna");
    const src = new AdzunaSource();
    const jobs = await src.fetch();
    expect(jobs.length).toBeGreaterThan(0);
    console.log(`[adzuna] fetched ${jobs.length} jobs`);
    for (const j of jobs.slice(0, 3)) {
      console.log(`  - ${j.title} @ ${j.companyName ?? "?"} (${j.location ?? "?"})`);
    }
  }, 120_000);
});
