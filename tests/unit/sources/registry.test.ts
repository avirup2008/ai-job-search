import { describe, it, expect } from "vitest";
import { allSources } from "@/lib/sources";

describe("allSources", () => {
  it("returns the 5 live sources (indeed-nl via Apify)", () => {
    const sources = allSources();
    const names = sources.map((s) => s.name).sort();
    expect(names).toEqual(["adzuna", "indeed-nl", "jooble", "magnetme", "nvb"]);
  });

  it("each source implements the JobSource contract", () => {
    for (const s of allSources()) {
      expect(typeof s.name).toBe("string");
      expect(typeof s.fetch).toBe("function");
    }
  });
});
