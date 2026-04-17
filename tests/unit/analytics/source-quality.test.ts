import { describe, it, expect } from "vitest";
import { computeSourceQuality, SOURCE_LABELS } from "@/lib/analytics/source-quality";

describe("computeSourceQuality", () => {
  it("returns [] for empty input", () => {
    expect(computeSourceQuality([])).toEqual([]);
  });

  it("computes conversionRate and label for a known source", () => {
    const result = computeSourceQuality([{ source: "adzuna", total: 10, t1Count: 3 }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      source: "adzuna",
      total: 10,
      t1Count: 3,
      conversionRate: 30.0,
      label: "Adzuna",
    });
  });

  it("returns conversionRate 0.0 when total is 0 — no division-by-zero", () => {
    const result = computeSourceQuality([{ source: "magnetme", total: 0, t1Count: 0 }]);
    expect(result[0].conversionRate).toBe(0.0);
  });

  it("uses raw source name as label when source not in SOURCE_LABELS", () => {
    const result = computeSourceQuality([{ source: "unknown-src", total: 5, t1Count: 1 }]);
    expect(result[0].label).toBe("unknown-src");
  });

  it("sorts results by t1Count descending", () => {
    const rows = [
      { source: "adzuna", total: 10, t1Count: 2 },
      { source: "jooble", total: 8, t1Count: 5 },
      { source: "magnetme", total: 6, t1Count: 1 },
    ];
    const result = computeSourceQuality(rows);
    expect(result.map((r) => r.source)).toEqual(["jooble", "adzuna", "magnetme"]);
  });

  it("SOURCE_LABELS covers all 5 known sources", () => {
    const knownSources = ["adzuna", "jooble", "magnetme", "nvb", "indeed-nl"];
    for (const src of knownSources) {
      expect(SOURCE_LABELS[src]).toBeTruthy();
    }
  });

  it("computes conversionRate correctly with rounding (1 decimal place)", () => {
    // t1Count=1, total=3 → 33.33...% → rounds to 33.3
    const result = computeSourceQuality([{ source: "jooble", total: 3, t1Count: 1 }]);
    expect(result[0].conversionRate).toBe(33.3);
  });
});
