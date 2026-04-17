import { describe, it, expect } from "vitest";
import { normalizeLocation, aggregateByNormalizedLocation } from "@/lib/location/normalize";

describe("normalizeLocation", () => {
  it("collapses country-only variants to 'Netherlands'", () => {
    expect(normalizeLocation("Netherlands")).toBe("Netherlands");
    expect(normalizeLocation("netherlands")).toBe("Netherlands");
    expect(normalizeLocation("Nederland")).toBe("Netherlands");
    expect(normalizeLocation("nederland")).toBe("Netherlands");
    expect(normalizeLocation("The Netherlands")).toBe("Netherlands");
    expect(normalizeLocation("NL")).toBe("Netherlands");
    expect(normalizeLocation("  nl  ")).toBe("Netherlands");
  });

  it("strips NL country suffix from 'City, CountrySuffix'", () => {
    expect(normalizeLocation("Amsterdam, NL")).toBe("Amsterdam");
    expect(normalizeLocation("Amsterdam, Nederland")).toBe("Amsterdam");
    expect(normalizeLocation("Rotterdam, Netherlands")).toBe("Rotterdam");
    expect(normalizeLocation("Utrecht, the netherlands")).toBe("Utrecht");
  });

  it("does not strip non-NL suffixes", () => {
    expect(normalizeLocation("Paris, France")).toBe("Paris, France");
    expect(normalizeLocation("Berlin, DE")).toBe("Berlin, DE");
  });

  it("only strips the trailing segment — preserves region, city order", () => {
    expect(normalizeLocation("Noord-Holland, Amsterdam")).toBe("Noord-Holland, Amsterdam");
  });

  it("returns null for empty/whitespace/nullish input", () => {
    expect(normalizeLocation(null)).toBeNull();
    expect(normalizeLocation(undefined)).toBeNull();
    expect(normalizeLocation("")).toBeNull();
    expect(normalizeLocation("   ")).toBeNull();
  });

  it("preserves casing for non-canonical values", () => {
    expect(normalizeLocation("Amsterdam")).toBe("Amsterdam");
    expect(normalizeLocation("rotterdam")).toBe("rotterdam"); // we don't title-case
  });
});

describe("aggregateByNormalizedLocation", () => {
  it("merges Nederland + Netherlands into one bucket", () => {
    const rows = [
      { location: "Netherlands", count: 10 },
      { location: "Nederland", count: 5 },
      { location: "Amsterdam", count: 3 },
    ];
    const result = aggregateByNormalizedLocation(rows);
    expect(result).toEqual([
      { location: "Netherlands", count: 15 },
      { location: "Amsterdam", count: 3 },
    ]);
  });

  it("merges 'Amsterdam, NL' into 'Amsterdam'", () => {
    const rows = [
      { location: "Amsterdam", count: 4 },
      { location: "Amsterdam, NL", count: 6 },
      { location: "Amsterdam, Netherlands", count: 2 },
    ];
    const result = aggregateByNormalizedLocation(rows);
    expect(result).toEqual([{ location: "Amsterdam", count: 12 }]);
  });

  it("skips null locations", () => {
    const rows = [
      { location: "Amsterdam", count: 5 },
      { location: null, count: 99 },
    ];
    const result = aggregateByNormalizedLocation(rows);
    expect(result).toEqual([{ location: "Amsterdam", count: 5 }]);
  });

  it("sorts by count descending", () => {
    const rows = [
      { location: "Rotterdam", count: 2 },
      { location: "Amsterdam", count: 10 },
      { location: "Utrecht", count: 5 },
    ];
    const result = aggregateByNormalizedLocation(rows);
    expect(result.map((r) => r.location)).toEqual(["Amsterdam", "Utrecht", "Rotterdam"]);
  });
});
