import { describe, it, expect } from "vitest";
import { computeMarketPulse } from "@/lib/analytics/market-pulse";

describe("computeMarketPulse", () => {
  it("returns neutral/no-data state for all-zero input", () => {
    const result = computeMarketPulse({
      avgDays: null,
      t1ThisWeek: 0,
      t1FourWeekAvg: 0,
      sourceResponseRows: [],
    });
    expect(result.avgDaysToResponse).toBeNull();
    expect(result.t1TrendLabel).toBe("No data yet");
    expect(result.t1TrendDirection).toBe("neutral");
    expect(result.sourceResponseRate).toEqual([]);
  });

  it("computes up trend with +33% vs 4-week avg", () => {
    const result = computeMarketPulse({
      avgDays: 5.2,
      t1ThisWeek: 8,
      t1FourWeekAvg: 6,
      sourceResponseRows: [{ source: "adzuna", applied: 4, responded: 2 }],
    });
    expect(result.avgDaysToResponse).toBe(5.2);
    expect(result.t1TrendDirection).toBe("up");
    expect(result.t1TrendLabel).toBe("+33% vs 4-week avg");
    expect(result.sourceResponseRate).toHaveLength(1);
    expect(result.sourceResponseRate[0]).toMatchObject({
      source: "adzuna",
      label: "Adzuna",
      rate: 50.0,
    });
  });

  it("returns t1TrendDirection 'down' when this week is below avg", () => {
    const result = computeMarketPulse({
      avgDays: 3.0,
      t1ThisWeek: 3,
      t1FourWeekAvg: 6,
      sourceResponseRows: [],
    });
    expect(result.t1TrendDirection).toBe("down");
  });

  it("returns t1TrendDirection 'neutral' when equal to avg", () => {
    const result = computeMarketPulse({
      avgDays: 3.0,
      t1ThisWeek: 6,
      t1FourWeekAvg: 6,
      sourceResponseRows: [],
    });
    expect(result.t1TrendDirection).toBe("neutral");
  });

  it("sourceResponseRate: 0 applied → rate 0.0 (no division-by-zero)", () => {
    const result = computeMarketPulse({
      avgDays: null,
      t1ThisWeek: 0,
      t1FourWeekAvg: 0,
      sourceResponseRows: [{ source: "jooble", applied: 0, responded: 0 }],
    });
    expect(result.sourceResponseRate[0].rate).toBe(0.0);
  });

  it("uses raw source name as label when not in SOURCE_LABELS", () => {
    const result = computeMarketPulse({
      avgDays: null,
      t1ThisWeek: 0,
      t1FourWeekAvg: 0,
      sourceResponseRows: [{ source: "unknown-src", applied: 10, responded: 5 }],
    });
    expect(result.sourceResponseRate[0].label).toBe("unknown-src");
  });

  it("computes sourceResponseRate with correct rounding", () => {
    // 1 of 3 → 33.3%
    const result = computeMarketPulse({
      avgDays: null,
      t1ThisWeek: 0,
      t1FourWeekAvg: 0,
      sourceResponseRows: [{ source: "magnetme", applied: 3, responded: 1 }],
    });
    expect(result.sourceResponseRate[0].rate).toBe(33.3);
  });
});
