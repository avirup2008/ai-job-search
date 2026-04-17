import { describe, it, expect } from "vitest";
import { blendFitScore } from "@/lib/pipeline/rank";
import { blendFitScoreWithMultipliers, type ScoringMultipliers } from "@/lib/scoring/multipliers";

describe("blendFitScore", () => {
  it("returns 100 when all components are 1", () => {
    expect(blendFitScore({ skills: 1, tools: 1, seniority: 1, industry: 1 })).toBe(100);
  });
  it("returns 0 when all components are 0", () => {
    expect(blendFitScore({ skills: 0, tools: 0, seniority: 0, industry: 0 })).toBe(0);
  });
  it("uses weights 40/30/15/15", () => {
    expect(blendFitScore({ skills: 1, tools: 0, seniority: 0, industry: 0 })).toBe(40);
    expect(blendFitScore({ skills: 0, tools: 1, seniority: 0, industry: 0 })).toBe(30);
    expect(blendFitScore({ skills: 0, tools: 0, seniority: 1, industry: 0 })).toBe(15);
    expect(blendFitScore({ skills: 0, tools: 0, seniority: 0, industry: 1 })).toBe(15);
  });
  it("clamps inputs to [0,1]", () => {
    // Out-of-range inputs get clamped before weighting
    expect(blendFitScore({ skills: 2, tools: -1, seniority: 0, industry: 0 })).toBe(40);
  });
  it("rounds to 1 decimal place (0..100)", () => {
    const s = blendFitScore({ skills: 0.77, tools: 0.5, seniority: 0.33, industry: 0.25 });
    // 0.77*0.40 + 0.5*0.30 + 0.33*0.15 + 0.25*0.15
    // = 0.308 + 0.150 + 0.0495 + 0.0375 = 0.545
    // × 100 = 54.5 → round to 1dp = 54.5
    expect(s).toBe(54.5);
  });
});

describe("blendFitScoreWithMultipliers", () => {
  const components = { skills: 0.8, tools: 0.7, seniority: 0.9, industry: 0.6 };
  const EMPTY: ScoringMultipliers = { byIndustrySeniority: {} };

  it("equals blendFitScore when no matching bucket (identity)", () => {
    const base = blendFitScore(components);
    const result = blendFitScoreWithMultipliers(components, EMPTY, { industries: ["SaaS"], seniority: "senior" });
    expect(result).toBe(base);
  });

  it("produces a higher score than base when multiplier is 1.2", () => {
    const base = blendFitScore(components);
    const m: ScoringMultipliers = { byIndustrySeniority: { "saas|senior": 1.2 } };
    const result = blendFitScoreWithMultipliers(components, m, { industries: ["SaaS"], seniority: "senior" });
    expect(result).toBeGreaterThan(base);
  });

  it("produces a lower score than base when multiplier is 0.8", () => {
    const base = blendFitScore(components);
    const m: ScoringMultipliers = { byIndustrySeniority: { "saas|senior": 0.8 } };
    const result = blendFitScoreWithMultipliers(components, m, { industries: ["SaaS"], seniority: "senior" });
    expect(result).toBeLessThan(base);
  });
});
