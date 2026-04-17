import { describe, it, expect } from "vitest";
import { shapeGapCoachRow, sortGapCoachRows } from "@/components/gap-coach/GapCoachList";

// Fixture: a raw DB row returned by the Drizzle select (jobs + companies leftJoin)
const baseRow = {
  id: "00000000-0000-0000-0000-000000000001",
  title: "Senior Marketing Manager",
  companyName: "Atlas Heavy",
  fitScore: "78",
  fitBreakdown: { skills: 0.8, tools: 0.6, seniority: 0.9, industry: 0.7 },
  gapAnalysis: {
    strengths: ["a", "b"],
    gaps: ["No Braze experience", "3+ years B2B SaaS not demonstrated"],
    recommendation: "apply_with_caveat",
    recommendationReason: "x",
  },
};

describe("shapeGapCoachRow", () => {
  it("Test 1: returns the expected shape from a raw DB row", () => {
    const result = shapeGapCoachRow(baseRow);
    expect(result).toEqual({
      id: baseRow.id,
      title: "Senior Marketing Manager",
      companyName: "Atlas Heavy",
      fitScore: 78,
      closenessDelta: 7,
      gaps: ["No Braze experience", "3+ years B2B SaaS not demonstrated"],
      breakdown: { skills: 0.8, tools: 0.6, seniority: 0.9, industry: 0.7 },
    });
  });

  it("Test 2: closenessDelta equals 85 - fitScore", () => {
    const r84 = shapeGapCoachRow({ ...baseRow, fitScore: "84" });
    expect(r84.closenessDelta).toBe(1);

    const r65 = shapeGapCoachRow({ ...baseRow, fitScore: "65" });
    expect(r65.closenessDelta).toBe(20);
  });

  it("Test 3: companyName falls back to 'Unknown company' when leftJoin returned null", () => {
    const result = shapeGapCoachRow({ ...baseRow, companyName: null });
    expect(result.companyName).toBe("Unknown company");
  });

  it("Test 4: gaps returns gapAnalysis.gaps array; returns [] when gapAnalysis is null or gaps field is missing", () => {
    const withGaps = shapeGapCoachRow(baseRow);
    expect(withGaps.gaps).toEqual(["No Braze experience", "3+ years B2B SaaS not demonstrated"]);

    const nullGapAnalysis = shapeGapCoachRow({ ...baseRow, gapAnalysis: null });
    expect(nullGapAnalysis.gaps).toEqual([]);

    const missingGaps = shapeGapCoachRow({
      ...baseRow,
      gapAnalysis: { strengths: ["a"], recommendation: "apply", recommendationReason: "r" } as never,
    });
    expect(missingGaps.gaps).toEqual([]);
  });

  it("Test 5: fitScore coerces a numeric string to a number", () => {
    const result = shapeGapCoachRow({ ...baseRow, fitScore: "72.5" });
    expect(result.fitScore).toBe(72.5);
    expect(typeof result.fitScore).toBe("number");
  });
});

describe("sortGapCoachRows", () => {
  it("Test 6: sortGapCoachRows returns rows sorted by fitScore descending (highest first = closest to T1)", () => {
    const rows = [
      shapeGapCoachRow({ ...baseRow, fitScore: "65", id: "a" }),
      shapeGapCoachRow({ ...baseRow, fitScore: "84", id: "b" }),
      shapeGapCoachRow({ ...baseRow, fitScore: "72", id: "c" }),
    ];
    const sorted = sortGapCoachRows(rows);
    expect(sorted.map((r) => r.fitScore)).toEqual([84, 72, 65]);
  });
});
