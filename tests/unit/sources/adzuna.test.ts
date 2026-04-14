import { describe, it, expect } from "vitest";
import { normalizeAdzuna } from "@/lib/sources/adzuna";

describe("normalizeAdzuna", () => {
  it("maps Adzuna API response to RawJob", () => {
    const api = {
      id: "123456789",
      redirect_url: "https://www.adzuna.nl/land/ad/123456789",
      title: "Marketing Automation Manager",
      description: "HubSpot expert needed. English-speaking team in Amsterdam.",
      company: { display_name: "Picnic" },
      location: { display_name: "Amsterdam, North Holland" },
      created: "2026-04-12T08:30:00Z",
    };
    const r = normalizeAdzuna(api);
    expect(r.source).toBe("adzuna");
    expect(r.sourceExternalId).toBe("123456789");
    expect(r.sourceUrl).toBe("https://www.adzuna.nl/land/ad/123456789");
    expect(r.title).toBe("Marketing Automation Manager");
    expect(r.jdText).toContain("HubSpot");
    expect(r.companyName).toBe("Picnic");
    expect(r.companyDomain).toBeNull();
    expect(r.location).toBe("Amsterdam, North Holland");
    expect(r.postedAt?.toISOString()).toBe("2026-04-12T08:30:00.000Z");
  });

  it("handles missing company field gracefully", () => {
    const api = {
      id: "x",
      redirect_url: "u",
      title: "t",
      description: "d",
      created: "2026-04-01T00:00:00Z",
    };
    const r = normalizeAdzuna(api as never);
    expect(r.companyName).toBeNull();
    expect(r.location).toBeNull();
  });

  it("handles missing created field (returns null postedAt)", () => {
    const api = {
      id: "x",
      redirect_url: "u",
      title: "t",
      description: "d",
    };
    const r = normalizeAdzuna(api as never);
    expect(r.postedAt).toBeNull();
  });
});
