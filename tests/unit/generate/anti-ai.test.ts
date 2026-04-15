import { describe, it, expect } from "vitest";
import { findViolations } from "@/lib/generate/anti-ai";

describe("findViolations", () => {
  it("returns empty for clean text", () => {
    expect(findViolations("I rebuilt the CRM at my last role.")).toEqual([]);
  });
  it("flags em-dashes", () => {
    expect(findViolations("Great role — I want to apply.").length).toBeGreaterThan(0);
  });
  it("flags maps-to variants", () => {
    expect(findViolations("which maps to our priorities").length).toBeGreaterThan(0);
    expect(findViolations("maps closely to the JD").length).toBeGreaterThan(0);
  });
  it("flags negative parallelisms", () => {
    expect(findViolations("not just a role, but a mission").length).toBeGreaterThan(0);
    expect(findViolations("not only strategic, but also tactical").length).toBeGreaterThan(0);
  });
});
