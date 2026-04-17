import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseIndeedNlSearch } from "@/lib/sources/indeed-nl";

describe("parseIndeedNlSearch", () => {
  it("extracts jobs from fixture HTML", () => {
    const html = readFileSync("tests/fixtures/indeed-nl-search.html", "utf8");
    const jobs = parseIndeedNlSearch(html);
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThanOrEqual(3);
    for (const j of jobs) {
      expect(j.source).toBe("indeed-nl");
      expect(j.sourceUrl).toMatch(/^https:\/\/nl\.indeed\.com/);
      expect(j.title.length).toBeGreaterThan(0);
    }
  });

  it("includes company names when available", () => {
    const html = readFileSync("tests/fixtures/indeed-nl-search.html", "utf8");
    const jobs = parseIndeedNlSearch(html);
    const withCompany = jobs.filter((j) => j.companyName !== null);
    expect(withCompany.length).toBeGreaterThan(0);
  });

  it("includes location when available", () => {
    const html = readFileSync("tests/fixtures/indeed-nl-search.html", "utf8");
    const jobs = parseIndeedNlSearch(html);
    const withLocation = jobs.filter((j) => j.location !== null);
    expect(withLocation.length).toBeGreaterThan(0);
  });

  it("returns empty array for empty/invalid input", () => {
    expect(parseIndeedNlSearch("")).toEqual([]);
    expect(parseIndeedNlSearch("not html")).toEqual([]);
    expect(parseIndeedNlSearch("<html>no mosaic</html>")).toEqual([]);
    expect(
      parseIndeedNlSearch(
        'window.mosaic.providerData["mosaic-provider-jobcards"]=not json;'
      )
    ).toEqual([]);
  });

  it("all sourceExternalIds are unique non-empty strings", () => {
    const html = readFileSync("tests/fixtures/indeed-nl-search.html", "utf8");
    const jobs = parseIndeedNlSearch(html);
    const ids = jobs.map((j) => j.sourceExternalId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    for (const id of ids) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it("companyDomain is always null", () => {
    const html = readFileSync("tests/fixtures/indeed-nl-search.html", "utf8");
    const jobs = parseIndeedNlSearch(html);
    for (const j of jobs) {
      expect(j.companyDomain).toBeNull();
    }
  });

  it("strips HTML from snippet into jdText", () => {
    const html = readFileSync("tests/fixtures/indeed-nl-search.html", "utf8");
    const jobs = parseIndeedNlSearch(html);
    for (const j of jobs) {
      expect(j.jdText).not.toContain("<");
      expect(j.jdText).not.toContain(">");
    }
  });
});
