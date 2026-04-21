import { describe, it, expect } from "vitest";
import { SEARCH_KEYWORDS } from "@/lib/sources/keywords";

describe("SEARCH_KEYWORDS", () => {
  it("contains all required high-value terms", () => {
    const list = [...SEARCH_KEYWORDS];
    expect(list).toContain("marketing automation");
    expect(list).toContain("marketing operations");
    expect(list).toContain("CRM marketing");
    expect(list).toContain("CRM specialist");
    expect(list).toContain("email marketing");
    expect(list).toContain("campaign manager");
    expect(list).toContain("marketing coordinator");
    expect(list).toContain("marketing specialist");
    expect(list).toContain("HubSpot");
    expect(list).toContain("digital marketing");
    expect(list).toContain("growth marketing");
    expect(list).toContain("demand generation");
  });

  it("does not contain removed terms", () => {
    const list = [...SEARCH_KEYWORDS];
    expect(list).not.toContain("paid media");
    expect(list).not.toContain("marketing manager");
    expect(list).not.toContain("email marketing manager");
  });

  it("has exactly 12 keywords", () => {
    expect(SEARCH_KEYWORDS).toHaveLength(12);
  });
});
