import { describe, it, expect } from "vitest";

describe("research live", () => {
  it("generates a dossier for Takeaway.com", async () => {
    if (!process.env.RUN_INTEGRATION) {
      console.log("skipped — set RUN_INTEGRATION=1");
      return;
    }
    const { getCompanyDossier } = await import("@/lib/research");
    const d = await getCompanyDossier({ companyName: "Takeaway.com", domain: "takeaway.com" });
    console.log("Dossier:", { company: d.company, stage: d.stage, lowSignal: d.lowSignal, stack: d.marketingStack.slice(0, 5), narrative: d.narrative.slice(0, 200) });
    expect(d.company).toBeTruthy();
    expect(d.narrative.length).toBeGreaterThan(200);
  }, 60_000);

  it("gracefully handles company with no domain", async () => {
    if (!process.env.RUN_INTEGRATION) return;
    const { getCompanyDossier } = await import("@/lib/research");
    const d = await getCompanyDossier({ companyName: "Totally Made Up Local Startup XYZ" });
    expect(d.lowSignal).toBe(true);
  }, 60_000);
});
