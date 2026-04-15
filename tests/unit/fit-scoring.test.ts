import { describe, it, expect } from "vitest";
import { blendFitScore } from "@/lib/pipeline/rank";

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
