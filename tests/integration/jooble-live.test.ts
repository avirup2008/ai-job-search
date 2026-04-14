import { describe, it, expect } from "vitest";

describe("Jooble live", () => {
  it("fetches NL marketing jobs with real key", async () => {
    if (!process.env.RUN_INTEGRATION) {
      console.log("skipped — set RUN_INTEGRATION=1");
      return;
    }
    const { JoobleSource } = await import("@/lib/sources/jooble");
    const src = new JoobleSource();
    const jobs = await src.fetch();
    expect(jobs.length).toBeGreaterThan(0);
    console.log(`[jooble] fetched ${jobs.length} jobs`);
    for (const j of jobs.slice(0, 3)) {
      console.log(`  - ${j.title} @ ${j.companyName ?? "?"} (${j.location ?? "?"})`);
    }
  }, 120_000);
});
