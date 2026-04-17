import { describe, it, expect } from "vitest";
import { assembleResearchPrompt } from "@/lib/interview/research-prompt";

const dossier = {
  productOneLiner: "B2B marketing automation platform",
  stage: "scale-up" as const,
  industry: "MarTech",
  marketingStack: ["HubSpot", "Segment"],
  narrative: "Atlas Heavy is a 120-person scale-up...",
  hqLocation: "Amsterdam",
  employeeSize: "100-250",
  recentNews: [],
  cultureSignals: [],
  lowSignal: false,
};

const baseParams = {
  role: "Senior Marketing Engineer",
  companyName: "Atlas Heavy",
  jdText: "We are looking for a Senior Marketing Engineer to join our team.",
  dossier,
};

describe("assembleResearchPrompt", () => {
  it("Test 1: result contains the literal role title", () => {
    const result = assembleResearchPrompt(baseParams);
    expect(result).toContain("Senior Marketing Engineer");
  });

  it("Test 2: result contains the literal company name", () => {
    const result = assembleResearchPrompt(baseParams);
    expect(result).toContain("Atlas Heavy");
  });

  it("Test 3: JD text shorter than 3000 chars is present in full", () => {
    const shortJd = "We are looking for a great engineer.";
    const result = assembleResearchPrompt({ ...baseParams, jdText: shortJd });
    expect(result).toContain(shortJd);
  });

  it("Test 4: JD text longer than 3000 chars is truncated to 3000 chars", () => {
    const longJd = "x".repeat(5000);
    const result = assembleResearchPrompt({ ...baseParams, jdText: longJd });
    // The full 5000-char block should NOT be present
    expect(result).not.toContain("x".repeat(3001));
  });

  it("Test 5: when dossier is provided, result contains productOneLiner, stage, and industry values", () => {
    const result = assembleResearchPrompt(baseParams);
    expect(result).toContain(dossier.productOneLiner);
    expect(result).toContain(dossier.stage);
    expect(result).toContain(dossier.industry);
  });

  it("Test 6: when dossier is null, result does NOT contain the substring \"Company context:\"", () => {
    const result = assembleResearchPrompt({ ...baseParams, dossier: null });
    expect(result).not.toContain("Company context:");
  });

  it("Test 7: result contains the literal substring \"Please help me prepare\"", () => {
    const result = assembleResearchPrompt(baseParams);
    expect(result).toContain("Please help me prepare");
  });

  it("Test 8: result is a non-empty string with length >= 200 characters in the happy path", () => {
    const result = assembleResearchPrompt(baseParams);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThanOrEqual(200);
  });
});
