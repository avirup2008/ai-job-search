import { describe, it, expect } from "vitest";
import { applyHardFilters } from "@/lib/pipeline/filters";

// Helper: passing location for tests that don't care about commute
const AMS = "Amsterdam";

describe("applyHardFilters — Dutch-required detection (body)", () => {
  it.each([
    "vloeiend Nederlands vereist",
    "minimaal B2 Dutch",
    "Must be fluent in Dutch (C1)",
    "Nederlandse moedertaalspreker",
    "goede beheersing van het Nederlands",
    "Nederlands is essential",
    "Dutch C1 required",
    "Dutch (B2) required",
  ])("blocks body phrase: %s", (phrase) => {
    const r = applyHardFilters({ title: "Marketing Manager", jdText: phrase, location: AMS, seniority: null });
    expect(r.filter).toBe("dutch_required");
  });

  it("does not block when Dutch is only mentioned as nice-to-have", () => {
    const r = applyHardFilters({
      title: "Marketing Automation Manager",
      jdText: "Dutch is a plus but not required. English-speaking team.",
      location: AMS,
      seniority: null,
    });
    expect(r.filter).toBeNull();
  });

  it("does not block English-first role that mentions Netherlands", () => {
    const r = applyHardFilters({
      title: "Growth Marketer",
      jdText: "We are a Netherlands-based scale-up. Our working language is English.",
      location: AMS,
      seniority: null,
    });
    expect(r.filter).toBeNull();
  });
});

describe("applyHardFilters — Dutch-required detection (title patterns)", () => {
  it("blocks Dutch-Speaking hyphenated in title", () => {
    const r = applyHardFilters({
      title: "Marketing Manager (Dutch-Speaking)",
      jdText: "Great role at a scale-up.",
      location: AMS,
      seniority: null,
    });
    expect(r.filter).toBe("dutch_required");
  });

  it("blocks Nederlandstalig in title", () => {
    const r = applyHardFilters({
      title: "Nederlandstalig CRM Specialist",
      jdText: "Join our team.",
      location: AMS,
      seniority: null,
    });
    expect(r.filter).toBe("dutch_required");
  });

  it("blocks 'marketeer' Dutch-only title word", () => {
    const r = applyHardFilters({
      title: "Digital Marketeer",
      jdText: "English JD body.",
      location: AMS,
      seniority: null,
    });
    expect(r.filter).toBe("dutch_required");
  });

  it("blocks 'bij X' pattern in title", () => {
    const r = applyHardFilters({
      title: "Marketing Manager bij Picnic",
      jdText: "English JD body.",
      location: AMS,
      seniority: null,
    });
    expect(r.filter).toBe("dutch_required");
  });

  it("blocks 'implementatie' Dutch-only title word", () => {
    const r = applyHardFilters({
      title: "Implementatie Specialist",
      jdText: "English JD body.",
      location: AMS,
      seniority: null,
    });
    expect(r.filter).toBe("dutch_required");
  });

  it("blocks 'medewerker' in title", () => {
    const r = applyHardFilters({
      title: "Medewerker marketing en communicatie",
      jdText: "In deze rol...",
      location: AMS,
      seniority: null,
    });
    expect(r.filter).toBe("dutch_required");
  });

  it("blocks 'stagiair' in title", () => {
    const r = applyHardFilters({
      title: "Marketing Stagiaire",
      jdText: "English JD body.",
      location: AMS,
      seniority: null,
    });
    // stagiair matches both DUTCH_TITLE_WORDS and SENIORITY_BLOCK_TITLE — either blocks
    expect(r.filter).not.toBeNull();
  });

  it("blocks 'meewerkstage' in title", () => {
    const r = applyHardFilters({
      title: "Meewerkstage Marketing",
      jdText: "English JD body.",
      location: AMS,
      seniority: null,
    });
    expect(r.filter).not.toBeNull();
  });

  it("blocks 'Stage:' prefix in title", () => {
    const r = applyHardFilters({
      title: "Stage: Marketing Communications",
      jdText: "English JD body.",
      location: AMS,
      seniority: null,
    });
    expect(r.filter).toBe("seniority_mismatch");
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
    const r = applyHardFilters({ title, jdText: "", location: AMS, seniority: null });
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
      const r = applyHardFilters({ title, jdText: "English-speaking team.", location: AMS, seniority: null });
      expect(r.filter).toBeNull();
    }
  });

  it("does not block when JD body mentions 'director' but title is mid-senior", () => {
    const r = applyHardFilters({
      title: "Marketing Automation Manager",
      jdText: "You report to the Director of Growth. You manage your own projects.",
      location: AMS,
      seniority: null,
    });
    expect(r.filter).toBeNull();
  });
});

describe("applyHardFilters — commute hard gate", () => {
  it("rejects onsite Eindhoven (car=115, transit=105, both over onsite limits 30/60)", () => {
    const r = applyHardFilters({
      title: "Marketing Manager",
      jdText: "You will work from our Eindhoven office 5 days a week.",
      location: "Eindhoven",
      seniority: null,
    });
    expect(r.filter).toBe("commute_unreachable");
  });

  it("passes onsite Amsterdam (car=30 <= 30)", () => {
    const r = applyHardFilters({
      title: "Marketing Manager",
      jdText: "Full-time onsite role in our Amsterdam headquarters.",
      location: "Amsterdam",
      seniority: null,
    });
    expect(r.filter).toBeNull();
  });

  it("passes hybrid Rotterdam (transit=80 <= 90 hybrid limit)", () => {
    const r = applyHardFilters({
      title: "CRM Manager",
      jdText: "This is a hybrid role, 2 days in the office per week.",
      location: "Rotterdam",
      seniority: null,
    });
    expect(r.filter).toBeNull();
  });

  it("passes remote Zwolle (remote mode always passes)", () => {
    const r = applyHardFilters({
      title: "Marketing Manager",
      jdText: "This is a fully remote position. Work from anywhere.",
      location: "Zwolle",
      seniority: null,
    });
    expect(r.filter).toBeNull();
  });

  it("rejects unknown location for onsite role", () => {
    const r = applyHardFilters({
      title: "Marketing Manager",
      jdText: "You must work onsite at our office.",
      location: "Timbuktu",
      seniority: null,
    });
    expect(r.filter).toBe("commute_unreachable");
  });

  it("passes remote JD even with far location (fully remote beats location check)", () => {
    const r = applyHardFilters({
      title: "Marketing Manager",
      jdText: "100% remote. Work from anywhere in Europe. No office requirement.",
      location: "Maastricht",
      seniority: null,
    });
    expect(r.filter).toBeNull();
  });

  it("rejects onsite Zwolle (car=100, transit=100, both exceed onsite 30/60)", () => {
    const r = applyHardFilters({
      title: "CRM Specialist",
      jdText: "Based at our Zwolle office, full time.",
      location: "Zwolle",
      seniority: null,
    });
    expect(r.filter).toBe("commute_unreachable");
  });
});
