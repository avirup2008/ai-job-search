import { describe, it, expect } from "vitest";
import { cvNarrativeText } from "@/lib/generate/cv-types";

describe("cvNarrativeText", () => {
  it("flattens all narrative content", () => {
    const text = cvNarrativeText({
      name: "X", headline: "Headline here", location: "L", contact: {},
      summary: "Summary body.",
      skillsGrouped: [{ group: "CRM", items: ["HubSpot"] }],
      experience: [{ company: "A", title: "T", dates: "D", highlights: ["built X"] }],
      education: [], certifications: [], languages: [],
    });
    expect(text).toContain("Headline here");
    expect(text).toContain("Summary body");
    expect(text).toContain("HubSpot");
    expect(text).toContain("built X");
  });
});
