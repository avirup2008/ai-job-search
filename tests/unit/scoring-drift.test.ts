import { describe, it, expect } from "vitest";
import { detectDrift } from "@/lib/scoring/drift";

describe("detectDrift", () => {
  it("oldTier=null → drifted:false (no prior tier means no drift)", () => {
    const result = detectDrift(null, 1);
    expect(result.drifted).toBe(false);
    expect(result.oldTier).toBeNull();
    expect(result.newTier).toBe(1);
    expect(result.delta).toBe(0);
  });

  it("same tier → drifted:false", () => {
    const result = detectDrift(2, 2);
    expect(result.drifted).toBe(false);
    expect(result.delta).toBe(0);
  });

  it("tier moved down (2 → 1) → drifted:true, delta:-1", () => {
    const result = detectDrift(2, 1);
    expect(result.drifted).toBe(true);
    expect(result.oldTier).toBe(2);
    expect(result.newTier).toBe(1);
    expect(result.delta).toBe(-1);
  });

  it("tier moved up (1 → 2) → drifted:true, delta:+1", () => {
    const result = detectDrift(1, 2);
    expect(result.drifted).toBe(true);
    expect(result.oldTier).toBe(1);
    expect(result.newTier).toBe(2);
    expect(result.delta).toBe(1);
  });

  it("newTier=null → drifted:false (new score failed; treat as no-drift to avoid noise)", () => {
    const result = detectDrift(1, null);
    expect(result.drifted).toBe(false);
    expect(result.oldTier).toBe(1);
    expect(result.newTier).toBeNull();
    expect(result.delta).toBe(0);
  });

  it("both null → drifted:false", () => {
    const result = detectDrift(null, null);
    expect(result.drifted).toBe(false);
    expect(result.delta).toBe(0);
  });

  it("tier moved from 1 to 3 → drifted:true, delta:+2", () => {
    const result = detectDrift(1, 3);
    expect(result.drifted).toBe(true);
    expect(result.delta).toBe(2);
  });
});
