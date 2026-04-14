import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseNvbSearch } from "@/lib/sources/nvb";

describe("parseNvbSearch", () => {
  it("extracts jobs from fixture JSON", () => {
    const json = readFileSync("tests/fixtures/nvb-search.json", "utf8");
    const jobs = parseNvbSearch(json);
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) {
      expect(j.source).toBe("nvb");
      expect(j.sourceUrl).toMatch(/^https?:\/\//);
      expect(j.title.length).toBeGreaterThan(0);
    }
  });

  it("includes company names when available", () => {
    const json = readFileSync("tests/fixtures/nvb-search.json", "utf8");
    const jobs = parseNvbSearch(json);
    const withCompany = jobs.filter((j) => j.companyName !== null);
    expect(withCompany.length).toBeGreaterThan(0);
  });

  it("includes location when available", () => {
    const json = readFileSync("tests/fixtures/nvb-search.json", "utf8");
    const jobs = parseNvbSearch(json);
    const withLocation = jobs.filter((j) => j.location !== null);
    expect(withLocation.length).toBeGreaterThan(0);
  });

  it("returns empty array for empty/invalid input", () => {
    expect(parseNvbSearch("")).toEqual([]);
    expect(parseNvbSearch("not json")).toEqual([]);
    expect(parseNvbSearch("{}")).toEqual([]);
    expect(parseNvbSearch('{"_embedded":{"jobs":[]}}')).toEqual([]);
  });

  it("all sourceExternalIds are unique non-empty strings", () => {
    const json = readFileSync("tests/fixtures/nvb-search.json", "utf8");
    const jobs = parseNvbSearch(json);
    const ids = jobs.map((j) => j.sourceExternalId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    for (const id of ids) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it("companyDomain is always null (enriched later)", () => {
    const json = readFileSync("tests/fixtures/nvb-search.json", "utf8");
    const jobs = parseNvbSearch(json);
    for (const j of jobs) {
      expect(j.companyDomain).toBeNull();
    }
  });
});
