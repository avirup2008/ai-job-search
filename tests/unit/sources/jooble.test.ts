import { describe, it, expect } from "vitest";
import { normalizeJooble } from "@/lib/sources/jooble";

describe("normalizeJooble", () => {
  it("maps Jooble API response to RawJob", () => {
    const api = {
      id: 987654,
      link: "https://jooble.org/desc/987654",
      title: "CRM Marketing Manager",
      snippet: "HubSpot, lifecycle, segmentation. Amsterdam scale-up.",
      company: "Mollie",
      location: "Amsterdam",
      updated: "2026-04-10 12:00:00",
    };
    const r = normalizeJooble(api);
    expect(r.source).toBe("jooble");
    expect(r.sourceExternalId).toBe("987654");
    expect(r.sourceUrl).toBe("https://jooble.org/desc/987654");
    expect(r.title).toBe("CRM Marketing Manager");
    expect(r.jdText).toContain("HubSpot");
    expect(r.companyName).toBe("Mollie");
    expect(r.companyDomain).toBeNull();
    expect(r.location).toBe("Amsterdam");
    expect(r.postedAt).toBeInstanceOf(Date);
  });

  it("handles missing company", () => {
    const api = { id: "x", link: "u", title: "t", snippet: "d" };
    const r = normalizeJooble(api as never);
    expect(r.companyName).toBeNull();
    expect(r.location).toBeNull();
    expect(r.postedAt).toBeNull();
  });

  it("coerces numeric id to string", () => {
    const api = { id: 123, link: "u", title: "t", snippet: "d" };
    const r = normalizeJooble(api as never);
    expect(r.sourceExternalId).toBe("123");
  });
});
