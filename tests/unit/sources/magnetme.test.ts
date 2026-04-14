import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseMagnetmeSearch } from "@/lib/sources/magnetme";

describe("parseMagnetmeSearch", () => {
  it("extracts jobs from fixture HTML", () => {
    const html = readFileSync("tests/fixtures/magnetme-search.html", "utf8");
    const jobs = parseMagnetmeSearch(html);
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) {
      expect(j.source).toBe("magnetme");
      expect(j.sourceUrl).toMatch(/^https?:\/\//);
      expect(j.title.length).toBeGreaterThan(0);
    }
  });

  it("includes company names when available", () => {
    const html = readFileSync("tests/fixtures/magnetme-search.html", "utf8");
    const jobs = parseMagnetmeSearch(html);
    const withCompany = jobs.filter((j) => j.companyName !== null);
    expect(withCompany.length).toBeGreaterThan(0);
  });

  it("returns empty array for empty/invalid HTML", () => {
    expect(parseMagnetmeSearch("")).toEqual([]);
    expect(parseMagnetmeSearch("<html><body></body></html>")).toEqual([]);
  });

  it("all sourceExternalIds are unique strings", () => {
    const html = readFileSync("tests/fixtures/magnetme-search.html", "utf8");
    const jobs = parseMagnetmeSearch(html);
    const ids = jobs.map((j) => j.sourceExternalId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    for (const id of ids) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });
});
