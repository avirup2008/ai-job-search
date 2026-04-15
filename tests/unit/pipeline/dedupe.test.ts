import { describe, it, expect } from "vitest";
import { computeDedupeHash, clusterJobs } from "@/lib/pipeline/dedupe";
import type { RawJob } from "@/lib/sources/types";

function mk(partial: Partial<RawJob>): RawJob {
  return {
    source: "adzuna",
    sourceExternalId: "x",
    sourceUrl: "https://x",
    title: "Marketing Manager",
    jdText: "Body",
    companyName: "Picnic",
    companyDomain: null,
    location: "Amsterdam, NL",
    postedAt: new Date("2026-04-10"),
    ...partial,
  };
}

describe("computeDedupeHash", () => {
  it("normalizes whitespace, case, and punctuation", () => {
    const a = computeDedupeHash({
      companyName: "Picnic", title: "Marketing  Manager", location: "Amsterdam NL",
      postedAt: new Date("2026-04-10"),
    });
    const b = computeDedupeHash({
      companyName: " picnic ", title: "Marketing Manager", location: "Amsterdam, NL",
      postedAt: new Date("2026-04-12"),  // same ISO week
    });
    expect(a).toBe(b);
  });

  it("treats null fields as empty", () => {
    const h = computeDedupeHash({
      companyName: null, title: "T", location: null, postedAt: null,
    });
    expect(h).toMatch(/\|t\|/);
  });

  it("buckets by ISO week of postedAt — different weeks don't collide", () => {
    const w1 = computeDedupeHash({
      companyName: "Co", title: "T", location: "L", postedAt: new Date("2026-04-05"),
    });
    const w2 = computeDedupeHash({
      companyName: "Co", title: "T", location: "L", postedAt: new Date("2026-04-15"),
    });
    expect(w1).not.toBe(w2);
  });

  it("same company + same title + different locations → same hash (location-agnostic)", () => {
    const h1 = computeDedupeHash({
      companyName: "Picnic", title: "Marketing Manager", location: "Amsterdam",
      postedAt: new Date("2026-04-10"),
    });
    const h2 = computeDedupeHash({
      companyName: "Picnic", title: "Marketing Manager", location: "Rotterdam",
      postedAt: new Date("2026-04-10"),
    });
    expect(h1).toBe(h2);
  });

  it("strips (m/f) parenthetical from title before hashing", () => {
    const h1 = computeDedupeHash({
      companyName: "Acme", title: "Marketing Manager (m/f)", location: "Amsterdam",
      postedAt: new Date("2026-04-10"),
    });
    const h2 = computeDedupeHash({
      companyName: "Acme", title: "Marketing Manager", location: "Amsterdam",
      postedAt: new Date("2026-04-10"),
    });
    expect(h1).toBe(h2);
  });

  it("strips 'bij <Company>' suffix from title before hashing", () => {
    const h1 = computeDedupeHash({
      companyName: "Picnic", title: "Marketing Manager bij Picnic", location: "Amsterdam",
      postedAt: new Date("2026-04-10"),
    });
    const h2 = computeDedupeHash({
      companyName: "Picnic", title: "Marketing Manager", location: "Amsterdam",
      postedAt: new Date("2026-04-10"),
    });
    expect(h1).toBe(h2);
  });

  it("strips Senior/Junior level prefix from title before hashing", () => {
    const h1 = computeDedupeHash({
      companyName: "Acme", title: "Senior Marketing Manager", location: "Amsterdam",
      postedAt: new Date("2026-04-10"),
    });
    const h2 = computeDedupeHash({
      companyName: "Acme", title: "Marketing Manager", location: "Amsterdam",
      postedAt: new Date("2026-04-10"),
    });
    expect(h1).toBe(h2);
  });
});

describe("clusterJobs", () => {
  it("groups duplicates across sources into one cluster", () => {
    const jobs = [
      mk({ source: "adzuna", sourceExternalId: "1", jdText: "Short JD" }),
      mk({ source: "jooble", sourceExternalId: "2", jdText: "Medium length JD" }),
      mk({ source: "nvb", sourceExternalId: "3", jdText: "Longest and most detailed JD with all the info" }),
    ];
    const clusters = clusterJobs(jobs);
    expect(clusters.length).toBe(1);
    expect(clusters[0].members).toHaveLength(3);
  });

  it("keeps distinct companies in separate clusters", () => {
    const jobs = [
      mk({ source: "adzuna", sourceExternalId: "1", companyName: "Picnic" }),
      mk({ source: "jooble", sourceExternalId: "2", companyName: "Mollie" }),
    ];
    const clusters = clusterJobs(jobs);
    expect(clusters.length).toBe(2);
  });

  it("picks canonical preferring higher source rank", () => {
    // Source preference: adzuna > nvb > magnetme > jooble
    const jobs = [
      mk({ source: "jooble", sourceExternalId: "j1", jdText: "x".repeat(500) }),
      mk({ source: "adzuna", sourceExternalId: "a1", jdText: "Shorter" }),
    ];
    const clusters = clusterJobs(jobs);
    expect(clusters[0].canonical.source).toBe("adzuna");
  });

  it("tiebreaks same-source-rank on longer jdText", () => {
    const jobs = [
      mk({ source: "adzuna", sourceExternalId: "a1", jdText: "Short" }),
      mk({ source: "adzuna", sourceExternalId: "a2", jdText: "x".repeat(500) }),
    ];
    const clusters = clusterJobs(jobs);
    expect(clusters[0].canonical.sourceExternalId).toBe("a2");
  });

  it("returns one cluster per distinct hash, each with member count >= 1", () => {
    const jobs = [
      mk({ source: "adzuna", sourceExternalId: "1", companyName: "A" }),
      mk({ source: "jooble", sourceExternalId: "2", companyName: "A" }),  // dup
      mk({ source: "nvb", sourceExternalId: "3", companyName: "B" }),
      mk({ source: "magnetme", sourceExternalId: "4", companyName: "C" }),
    ];
    const clusters = clusterJobs(jobs);
    expect(clusters.length).toBe(3);
    const memberCounts = clusters.map((c) => c.members.length).sort();
    expect(memberCounts).toEqual([1, 1, 2]);
  });

  it("same company + same title + different locations → 1 cluster", () => {
    const jobs = [
      mk({ source: "adzuna", sourceExternalId: "1", location: "Amsterdam" }),
      mk({ source: "jooble", sourceExternalId: "2", location: "Rotterdam" }),
    ];
    const clusters = clusterJobs(jobs);
    expect(clusters.length).toBe(1);
  });

  it("same company + (m/f) variant titles → 1 cluster", () => {
    const jobs = [
      mk({ source: "adzuna", sourceExternalId: "1", title: "Marketing Manager (m/f)" }),
      mk({ source: "jooble", sourceExternalId: "2", title: "Marketing Manager" }),
    ];
    const clusters = clusterJobs(jobs);
    expect(clusters.length).toBe(1);
  });

  it("same company + 'bij X' suffix variant → 1 cluster", () => {
    const jobs = [
      mk({ source: "adzuna", sourceExternalId: "1", title: "Marketing Manager bij Picnic" }),
      mk({ source: "jooble", sourceExternalId: "2", title: "Marketing Manager" }),
    ];
    const clusters = clusterJobs(jobs);
    expect(clusters.length).toBe(1);
  });

  it("different companies → separate clusters", () => {
    const jobs = [
      mk({ source: "adzuna", sourceExternalId: "1", companyName: "Picnic", title: "Marketing Manager" }),
      mk({ source: "jooble", sourceExternalId: "2", companyName: "Mollie", title: "Marketing Manager" }),
    ];
    const clusters = clusterJobs(jobs);
    expect(clusters.length).toBe(2);
  });
});
