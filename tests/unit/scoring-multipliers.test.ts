import { describe, it, expect } from "vitest";
import {
  applyOutcome,
  blendFitScoreWithMultipliers,
  readMultipliersFromProfile,
  writeMultipliersToProfile,
  MULTIPLIER_MIN,
  MULTIPLIER_MAX,
  type ScoringMultipliers,
} from "@/lib/scoring/multipliers";
import { blendFitScore } from "@/lib/pipeline/rank";

const EMPTY: ScoringMultipliers = { byIndustrySeniority: {} };

// --------------------------------------------------------------------------
// applyOutcome
// --------------------------------------------------------------------------

describe("applyOutcome", () => {
  it("rejected decrements bucket by 0.05 from default 1.0 → 0.95", () => {
    const result = applyOutcome(EMPTY, "rejected", ["SaaS"], "senior");
    expect(result.byIndustrySeniority["saas|senior"]).toBeCloseTo(0.95);
  });

  it("interview increments bucket by 0.05 → 1.05", () => {
    const result = applyOutcome(EMPTY, "interview", ["SaaS"], "senior");
    expect(result.byIndustrySeniority["saas|senior"]).toBeCloseTo(1.05);
  });

  it("offer increments bucket by 0.10 → 1.10", () => {
    const result = applyOutcome(EMPTY, "offer", ["SaaS"], "senior");
    expect(result.byIndustrySeniority["saas|senior"]).toBeCloseTo(1.10);
  });

  it("repeated rejections clamp at MULTIPLIER_MIN (never below 0.7)", () => {
    let m = EMPTY;
    for (let i = 0; i < 20; i++) {
      m = applyOutcome(m, "rejected", ["SaaS"], "senior");
    }
    expect(m.byIndustrySeniority["saas|senior"]).toBeCloseTo(MULTIPLIER_MIN);
  });

  it("repeated offers clamp at MULTIPLIER_MAX (never above 1.3)", () => {
    let m = EMPTY;
    for (let i = 0; i < 20; i++) {
      m = applyOutcome(m, "offer", ["SaaS"], "senior");
    }
    expect(m.byIndustrySeniority["saas|senior"]).toBeCloseTo(MULTIPLIER_MAX);
  });

  it("applies to each industry in jobIndustries array", () => {
    const result = applyOutcome(EMPTY, "rejected", ["SaaS", "Fintech"], "mid");
    expect(result.byIndustrySeniority["saas|mid"]).toBeCloseTo(0.95);
    expect(result.byIndustrySeniority["fintech|mid"]).toBeCloseTo(0.95);
  });

  it("does not mutate the original multipliers object", () => {
    const original: ScoringMultipliers = { byIndustrySeniority: { "saas|senior": 1.0 } };
    applyOutcome(original, "rejected", ["SaaS"], "senior");
    expect(original.byIndustrySeniority["saas|senior"]).toBe(1.0);
  });

  it("uses seniority-only fallback bucket when industries is empty", () => {
    const result = applyOutcome(EMPTY, "interview", [], "senior");
    expect(result.byIndustrySeniority["|senior"]).toBeCloseTo(1.05);
  });

  it("keys are lowercased", () => {
    const result = applyOutcome(EMPTY, "rejected", ["CRM"], "Senior");
    expect(result.byIndustrySeniority["crm|senior"]).toBeCloseTo(0.95);
  });
});

// --------------------------------------------------------------------------
// blendFitScoreWithMultipliers
// --------------------------------------------------------------------------

describe("blendFitScoreWithMultipliers", () => {
  const components = { skills: 0.8, tools: 0.7, seniority: 0.9, industry: 0.6 };

  it("returns same score as blendFitScore when no matching bucket (identity)", () => {
    const base = blendFitScore(components);
    const result = blendFitScoreWithMultipliers(components, EMPTY, { industries: ["SaaS"], seniority: "senior" });
    expect(result).toBe(base);
  });

  it("produces a HIGHER score than base when multiplier is 1.2", () => {
    const base = blendFitScore(components);
    const m: ScoringMultipliers = { byIndustrySeniority: { "saas|senior": 1.2 } };
    const result = blendFitScoreWithMultipliers(components, m, { industries: ["SaaS"], seniority: "senior" });
    expect(result).toBeGreaterThan(base);
  });

  it("produces a LOWER score than base when multiplier is 0.8", () => {
    const base = blendFitScore(components);
    const m: ScoringMultipliers = { byIndustrySeniority: { "saas|senior": 0.8 } };
    const result = blendFitScoreWithMultipliers(components, m, { industries: ["SaaS"], seniority: "senior" });
    expect(result).toBeLessThan(base);
  });

  it("uses the furthest-from-1.0 multiplier when multiple industries match", () => {
    const base = blendFitScore(components);
    // 0.8 is further from 1 than 1.1, so 0.8 should win
    const m: ScoringMultipliers = {
      byIndustrySeniority: {
        "saas|senior": 1.1,
        "fintech|senior": 0.8,
      },
    };
    const resultMulti = blendFitScoreWithMultipliers(components, m, {
      industries: ["SaaS", "Fintech"],
      seniority: "senior",
    });
    const resultSingle08 = blendFitScoreWithMultipliers(components, { byIndustrySeniority: { "fintech|senior": 0.8 } }, {
      industries: ["Fintech"],
      seniority: "senior",
    });
    expect(resultMulti).toBe(resultSingle08);
    expect(resultMulti).toBeLessThan(base);
  });

  it("result is clamped to 0..100", () => {
    const highComponents = { skills: 1, tools: 1, seniority: 1, industry: 1 };
    const m: ScoringMultipliers = { byIndustrySeniority: { "saas|senior": 1.3 } };
    const result = blendFitScoreWithMultipliers(highComponents, m, { industries: ["SaaS"], seniority: "senior" });
    expect(result).toBeLessThanOrEqual(100);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("falls back to seniority-only bucket when industries is empty", () => {
    const base = blendFitScore(components);
    const m: ScoringMultipliers = { byIndustrySeniority: { "|senior": 1.2 } };
    const result = blendFitScoreWithMultipliers(components, m, { industries: [], seniority: "senior" });
    expect(result).toBeGreaterThan(base);
  });

  it("handles null seniority gracefully", () => {
    const base = blendFitScore(components);
    const result = blendFitScoreWithMultipliers(components, EMPTY, { industries: [], seniority: null });
    expect(result).toBe(base);
  });
});

// --------------------------------------------------------------------------
// readMultipliersFromProfile
// --------------------------------------------------------------------------

describe("readMultipliersFromProfile", () => {
  it("extracts byIndustrySeniority from well-formed preferences", () => {
    const pref = { feedbackWeights: { byIndustrySeniority: { "saas|senior": 0.9 } } };
    const result = readMultipliersFromProfile(pref);
    expect(result.byIndustrySeniority["saas|senior"]).toBe(0.9);
  });

  it("returns empty map when preferences is empty object {}", () => {
    const result = readMultipliersFromProfile({});
    expect(result).toEqual({ byIndustrySeniority: {} });
  });

  it("returns empty map when preferences is null", () => {
    const result = readMultipliersFromProfile(null);
    expect(result).toEqual({ byIndustrySeniority: {} });
  });

  it("returns empty map when feedbackWeights is missing", () => {
    const result = readMultipliersFromProfile({ other: "data" });
    expect(result).toEqual({ byIndustrySeniority: {} });
  });

  it("returns empty map when byIndustrySeniority contains non-number values", () => {
    const pref = { feedbackWeights: { byIndustrySeniority: { "saas|senior": "bad" } } };
    const result = readMultipliersFromProfile(pref);
    expect(result).toEqual({ byIndustrySeniority: {} });
  });
});

// --------------------------------------------------------------------------
// writeMultipliersToProfile
// --------------------------------------------------------------------------

describe("writeMultipliersToProfile", () => {
  it("preserves other preference keys when writing multipliers", () => {
    const pref = { theme: "dark", notifications: true };
    const m: ScoringMultipliers = { byIndustrySeniority: { "saas|senior": 0.9 } };
    const result = writeMultipliersToProfile(pref, m);
    expect(result["theme"]).toBe("dark");
    expect(result["notifications"]).toBe(true);
    expect((result["feedbackWeights"] as Record<string, unknown>)["byIndustrySeniority"]).toEqual({ "saas|senior": 0.9 });
  });

  it("creates feedbackWeights key when it did not exist", () => {
    const result = writeMultipliersToProfile({}, { byIndustrySeniority: { "crm|mid": 1.1 } });
    expect((result["feedbackWeights"] as Record<string, unknown>)["byIndustrySeniority"]).toEqual({ "crm|mid": 1.1 });
  });

  it("preserves existing feedbackWeights sub-keys not in byIndustrySeniority", () => {
    const pref = { feedbackWeights: { someOtherWeight: 42 } };
    const m: ScoringMultipliers = { byIndustrySeniority: { "saas|senior": 0.9 } };
    const result = writeMultipliersToProfile(pref, m);
    const fw = result["feedbackWeights"] as Record<string, unknown>;
    expect(fw["someOtherWeight"]).toBe(42);
    expect(fw["byIndustrySeniority"]).toEqual({ "saas|senior": 0.9 });
  });

  it("handles null preferences gracefully", () => {
    const result = writeMultipliersToProfile(null, { byIndustrySeniority: {} });
    expect(result["feedbackWeights"]).toBeDefined();
  });
});
