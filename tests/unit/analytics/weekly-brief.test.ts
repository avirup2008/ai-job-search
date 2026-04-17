import { describe, it, expect } from "vitest";
import { computeCallout, TARGET_APPLICATIONS_PER_WEEK } from "@/lib/analytics/weekly-brief";

describe("computeCallout", () => {
  // Rule 1: Behind pace (applicationsSentThisWeek < targetPace * 0.6)
  it("Rule 1: returns behind-pace message when apps < 60% of target", () => {
    const result = computeCallout({
      applicationsSentThisWeek: 2,
      targetPacePerWeek: 5,
      t1Available: 0,
      t1Applied: 0,
      topSourceThisWeek: "—",
    });
    // 2 < 5*0.6=3 → Rule 1
    expect(result).toBe("Behind pace — only 2 of 5 applications sent this week");
  });

  // Rule 2: Pace on track (applicationsSentThisWeek >= targetPace, no T1 priority)
  it("Rule 2: returns on-track message when apps >= target and no T1 available", () => {
    const result = computeCallout({
      applicationsSentThisWeek: 6,
      targetPacePerWeek: 5,
      t1Available: 0,
      t1Applied: 0,
      topSourceThisWeek: "—",
    });
    expect(result).toBe("Pace on track — 6 applications sent this week");
  });

  // Rule 3: T1 available but none applied (takes priority over Rule 2)
  it("Rule 3: returns T1-discovered message when t1Available > 0 and t1Applied === 0 (priority over Rule 2)", () => {
    const result = computeCallout({
      applicationsSentThisWeek: 5,
      targetPacePerWeek: 5,
      t1Available: 4,
      t1Applied: 0,
      topSourceThisWeek: "Adzuna",
    });
    // Rule 3 takes priority over Rule 2: t1Available>0 && t1Applied===0
    expect(result).toBe("4 T1 jobs discovered — none applied yet");
  });

  // Rule 3: singular form when t1Available === 1
  it("Rule 3: uses singular 'job' when t1Available is 1", () => {
    const result = computeCallout({
      applicationsSentThisWeek: 5,
      targetPacePerWeek: 5,
      t1Available: 1,
      t1Applied: 0,
      topSourceThisWeek: "Adzuna",
    });
    expect(result).toBe("1 T1 job discovered — none applied yet");
  });

  // Rule 4: low T1 application rate (t1Applied/t1Available < 0.5 AND t1Available >= 3)
  it("Rule 4: returns T1-remaining message when ratio < 0.5 and t1Available >= 3", () => {
    const result = computeCallout({
      applicationsSentThisWeek: 5,
      targetPacePerWeek: 5,
      t1Available: 6,
      t1Applied: 2,
      topSourceThisWeek: "Adzuna",
    });
    // 2/6 < 0.5 && 6 >= 3 → Rule 4
    expect(result).toBe("Only 2 of 6 T1 jobs applied — 4 remain");
  });

  // Rule 5: default (top source)
  it("Rule 5: returns top-source message as default", () => {
    const result = computeCallout({
      applicationsSentThisWeek: 5,
      targetPacePerWeek: 5,
      t1Available: 6,
      t1Applied: 4,
      topSourceThisWeek: "Adzuna",
    });
    // 4/6 >= 0.5 → Rule 4 doesn't apply; 5 >= 5 → Rule 2, but t1Available > 0 && t1Applied !== 0
    // So goes to Rule 5 (default)
    expect(result).toBe("Top source: Adzuna with 6 T1 jobs this week");
  });

  // Edge: exactly at 60% threshold — Rule 1 does NOT fire at exactly 0.6*target
  it("does not fire Rule 1 when apps exactly equals 60% of target (exclusive)", () => {
    // 5 * 0.6 = 3; apps = 3 → NOT < 3 → Rule 1 does NOT apply
    const result = computeCallout({
      applicationsSentThisWeek: 3,
      targetPacePerWeek: 5,
      t1Available: 0,
      t1Applied: 0,
      topSourceThisWeek: "—",
    });
    // 3 is not < 3, so Rule 1 doesn't apply. t1Available=0 → Rule 3 doesn't apply.
    // t1Available=0 (< 3) → Rule 4 doesn't apply. 3 < 5 → Rule 2 doesn't apply.
    // Falls through to Rule 5 (default)
    expect(result).toBe("Top source: — with 0 T1 jobs this week");
  });

  // Verify TARGET_APPLICATIONS_PER_WEEK constant
  it("TARGET_APPLICATIONS_PER_WEEK is 5", () => {
    expect(TARGET_APPLICATIONS_PER_WEEK).toBe(5);
  });
});
