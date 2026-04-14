import { describe, it, expect } from "vitest";
import { assignTier } from "@/lib/pipeline/tier";

describe("assignTier", () => {
  it("returns 1 when fitScore >= 85", () => {
    expect(assignTier(85)).toBe(1);
    expect(assignTier(85.01)).toBe(1);
    expect(assignTier(95.3)).toBe(1);
    expect(assignTier(100)).toBe(1);
  });

  it("returns 2 when fitScore in [65, 85)", () => {
    expect(assignTier(65)).toBe(2);
    expect(assignTier(65.01)).toBe(2);
    expect(assignTier(84.9)).toBe(2);
    expect(assignTier(84.99)).toBe(2);
  });

  it("returns 3 when fitScore in [40, 65)", () => {
    expect(assignTier(40)).toBe(3);
    expect(assignTier(40.01)).toBe(3);
    expect(assignTier(64.9)).toBe(3);
    expect(assignTier(64.99)).toBe(3);
  });

  it("returns null when fitScore < 40", () => {
    expect(assignTier(39.9)).toBeNull();
    expect(assignTier(0)).toBeNull();
    expect(assignTier(-5)).toBeNull();
  });

  it("boundary behavior is inclusive on lower bound only", () => {
    // Check the exact transition points
    expect(assignTier(84.999)).toBe(2);
    expect(assignTier(85)).toBe(1);
    expect(assignTier(64.999)).toBe(3);
    expect(assignTier(65)).toBe(2);
    expect(assignTier(39.999)).toBeNull();
    expect(assignTier(40)).toBe(3);
  });

  it("handles NaN by returning null", () => {
    expect(assignTier(NaN)).toBeNull();
  });
});
