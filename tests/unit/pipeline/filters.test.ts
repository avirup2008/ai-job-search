import { describe, it, expect } from "vitest";
import { applyHardFilters } from "@/lib/pipeline/filters";

describe("applyHardFilters — Dutch-required detection", () => {
  it.each([
    "vloeiend Nederlands vereist",
    "minimaal B2 Dutch",
    "Must be fluent in Dutch (C1)",
    "Nederlandse moedertaalspreker",
    "goede beheersing van het Nederlands",
    "Nederlands is essential",
    "Dutch C1 required",
    "Dutch (B2) required",
  ])("blocks: %s", (phrase) => {
    const r = applyHardFilters({ title: "Marketing Manager", jdText: phrase, seniority: null });
    expect(r.filter).toBe("dutch_required");
  });

  it("does not block when Dutch is only mentioned as nice-to-have", () => {
    const r = applyHardFilters({
      title: "Marketing Automation Manager",
      jdText: "Dutch is a plus but not required. English-speaking team.",
      seniority: null,
    });
    expect(r.filter).toBeNull();
  });

  it("does not block English-first role that mentions Netherlands", () => {
    const r = applyHardFilters({
      title: "Growth Marketer",
      jdText: "We are a Netherlands-based scale-up. Our working language is English.",
      seniority: null,
    });
    expect(r.filter).toBeNull();
  });
});

describe("applyHardFilters — seniority mismatch", () => {
  it.each([
    "VP of Marketing",
    "Vice President, Growth",
    "Chief Marketing Officer",
    "CMO",
    "Director of Marketing",
    "Director, Performance Marketing",
    "Head of Marketing (Director level)",
    "Marketing Intern",
    "Junior Marketing Assistant",
    "Entry-level Marketer",
  ])("blocks title: %s", (title) => {
    const r = applyHardFilters({ title, jdText: "", seniority: null });
    expect(r.filter).toBe("seniority_mismatch");
  });

  it("passes mid-senior titles", () => {
    const cases = [
      "Marketing Automation Manager",
      "Senior CRM Marketing Manager",
      "Marketing Specialist",
      "Lead Growth Marketer",
      "Digital Marketing Manager",
    ];
    for (const title of cases) {
      const r = applyHardFilters({ title, jdText: "English-speaking team.", seniority: null });
      expect(r.filter).toBeNull();
    }
  });

  it("does not block when JD body mentions 'director' but title is mid-senior", () => {
    const r = applyHardFilters({
      title: "Marketing Automation Manager",
      jdText: "You report to the Director of Growth. You manage your own projects.",
      seniority: null,
    });
    expect(r.filter).toBeNull();
  });
});

describe("applyHardFilters — Dutch-in-title detection", () => {
  it("blocks when the title itself is Dutch language", () => {
    const r = applyHardFilters({
      title: "Medewerker marketing en communicatie",
      jdText: "In deze rol...",
      seniority: null,
    });
    // Dutch-only title is a strong signal the role is Dutch-speaking
    expect(r.filter).toBe("dutch_required");
  });
});
