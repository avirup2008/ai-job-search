import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseIndeedNlRss } from "@/lib/sources/indeed-nl";

describe("parseIndeedNlRss", () => {
  it("extracts jobs from fixture RSS XML", () => {
    const xml = readFileSync("tests/fixtures/indeed-nl-rss.xml", "utf8");
    const jobs = parseIndeedNlRss(xml);
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThanOrEqual(3);
    for (const j of jobs) {
      expect(j.source).toBe("indeed-nl");
      expect(j.sourceUrl).toMatch(/^https:\/\/nl\.indeed\.com/);
      expect(j.title.length).toBeGreaterThan(0);
    }
  });

  it("includes company names when title contains ' - Company' format", () => {
    const xml = readFileSync("tests/fixtures/indeed-nl-rss.xml", "utf8");
    const jobs = parseIndeedNlRss(xml);
    const withCompany = jobs.filter((j) => j.companyName !== null);
    expect(withCompany.length).toBeGreaterThan(0);
    // First job should be "Marketing Automation Specialist" at "Atlas Group"
    const first = jobs[0];
    expect(first.title).toBe("Marketing Automation Specialist");
    expect(first.companyName).toBe("Atlas Group");
  });

  it("returns empty array for empty/invalid input", () => {
    expect(parseIndeedNlRss("")).toEqual([]);
    expect(parseIndeedNlRss("not xml")).toEqual([]);
    expect(parseIndeedNlRss("<rss><channel></channel></rss>")).toEqual([]);
  });

  it("skips items with no jobkey in URL", () => {
    const xml = `<rss><channel>
      <item>
        <title>Some Job - Some Company</title>
        <link>https://nl.indeed.com/viewjob?nokey=here</link>
        <description>desc</description>
      </item>
    </channel></rss>`;
    expect(parseIndeedNlRss(xml)).toEqual([]);
  });

  it("all sourceExternalIds are unique non-empty strings", () => {
    const xml = readFileSync("tests/fixtures/indeed-nl-rss.xml", "utf8");
    const jobs = parseIndeedNlRss(xml);
    const ids = jobs.map((j) => j.sourceExternalId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    for (const id of ids) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it("companyDomain and location are always null", () => {
    const xml = readFileSync("tests/fixtures/indeed-nl-rss.xml", "utf8");
    const jobs = parseIndeedNlRss(xml);
    for (const j of jobs) {
      expect(j.companyDomain).toBeNull();
      expect(j.location).toBeNull();
    }
  });

  it("strips HTML tags from description into jdText", () => {
    const xml = readFileSync("tests/fixtures/indeed-nl-rss.xml", "utf8");
    const jobs = parseIndeedNlRss(xml);
    for (const j of jobs) {
      expect(j.jdText).not.toContain("<");
      expect(j.jdText).not.toContain(">");
    }
  });

  it("handles plain (non-CDATA) title and description", () => {
    const xml = readFileSync("tests/fixtures/indeed-nl-rss.xml", "utf8");
    const jobs = parseIndeedNlRss(xml);
    // 4th item uses plain (non-CDATA) title and description
    const digital = jobs.find((j) => j.sourceExternalId === "ddd111eee222");
    expect(digital).toBeDefined();
    expect(digital!.title).toBe("Digital Marketing Strategist");
    expect(digital!.companyName).toBe("Orbis Media");
    expect(digital!.jdText.length).toBeGreaterThan(0);
  });

  it("sourceUrl uses the link field", () => {
    const xml = readFileSync("tests/fixtures/indeed-nl-rss.xml", "utf8");
    const jobs = parseIndeedNlRss(xml);
    for (const j of jobs) {
      expect(j.sourceUrl).toMatch(/^https:\/\/nl\.indeed\.com\/viewjob\?jk=/);
    }
  });
});
