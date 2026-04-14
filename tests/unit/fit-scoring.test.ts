import { describe, it, expect } from "vitest";
import { blendFitScore } from "@/lib/pipeline/rank";

describe("blendFitScore", () => {
  it("returns 100 when all components are 1", () => {
    expect(blendFitScore({ skills: 1, tools: 1, seniority: 1, geo: 1, industry: 1 })).toBe(100);
  });
  it("returns 0 when all components are 0", () => {
    expect(blendFitScore({ skills: 0, tools: 0, seniority: 0, geo: 0, industry: 0 })).toBe(0);
  });
  it("uses weights 40/25/15/10/10", () => {
    expect(blendFitScore({ skills: 1, tools: 0, seniority: 0, geo: 0, industry: 0 })).toBe(40);
    expect(blendFitScore({ skills: 0, tools: 1, seniority: 0, geo: 0, industry: 0 })).toBe(25);
    expect(blendFitScore({ skills: 0, tools: 0, seniority: 1, geo: 0, industry: 0 })).toBe(15);
    expect(blendFitScore({ skills: 0, tools: 0, seniority: 0, geo: 1, industry: 0 })).toBe(10);
    expect(blendFitScore({ skills: 0, tools: 0, seniority: 0, geo: 0, industry: 1 })).toBe(10);
  });
  it("clamps inputs to [0,1]", () => {
    // Out-of-range inputs get clamped before weighting
    expect(blendFitScore({ skills: 2, tools: -1, seniority: 0, geo: 0, industry: 0 })).toBe(40);
  });
  it("rounds to 1 decimal place (0..100)", () => {
    const s = blendFitScore({ skills: 0.77, tools: 0.5, seniority: 0.33, geo: 0.5, industry: 0.25 });
    // 0.77*0.4 + 0.5*0.25 + 0.33*0.15 + 0.5*0.1 + 0.25*0.1 = 0.308 + 0.125 + 0.0495 + 0.05 + 0.025 = 0.5575
    // × 100 = 55.75 → round to 1dp = 55.8
    expect(s).toBe(55.8);
  });
});
