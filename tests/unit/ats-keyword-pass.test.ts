import { describe, it, expect } from "vitest";
import { atsKeywordPass, ATS_MAX_INJECT, ATS_MIN_JD_FREQUENCY, ATS_MAX_JD_CHARS } from "@/lib/ats/keyword-pass";
import type { CvStruct } from "@/lib/generate/cv-types";

/** Minimal valid CvStruct fixture for testing. */
function makeCv(skillsGrouped: CvStruct["skillsGrouped"]): CvStruct {
  return {
    name: "Test Candidate",
    headline: "Marketing Manager",
    location: "Amsterdam, NL",
    contact: { email: "test@example.com" },
    summary: "Experienced marketing professional with 8 years in B2B SaaS.",
    skillsGrouped,
    experience: [
      {
        company: "Acme Corp",
        title: "Marketing Manager",
        dates: "2020–2024",
        highlights: ["Led demand gen campaigns", "Managed €500K budget"],
      },
      {
        company: "Beta Ltd",
        title: "Marketing Analyst",
        dates: "2018–2020",
        highlights: ["Built attribution models", "Ran A/B experiments"],
      },
    ],
    education: [{ degree: "BSc Marketing", school: "University of Amsterdam", year: "2018" }],
    certifications: [],
    languages: ["Dutch", "English"],
  };
}

describe("atsKeywordPass", () => {
  it("injects keywords present ≥ ATS_MIN_JD_FREQUENCY times that are missing from skillsGrouped", () => {
    const cv = makeCv([{ group: "Core Skills", items: ["CRM", "Email marketing"] }]);
    // HubSpot 3×, Marketo 2× — both missing
    const jd = "HubSpot is required. We use HubSpot daily. HubSpot integrates with Marketo. Marketo is key.";
    const result = atsKeywordPass(cv, jd);
    expect(result.injected).toContain("HubSpot");
    expect(result.injected).toContain("Marketo");
    // CV body (experience / summary) must be untouched
    expect(result.cv.experience).toEqual(cv.experience);
    expect(result.cv.summary).toEqual(cv.summary);
  });

  it("does NOT inject a keyword already present in skillsGrouped (case-insensitive)", () => {
    const cv = makeCv([{ group: "Technical Skills", items: ["hubspot", "CRM"] }]);
    const jd = "HubSpot is used 3 times. HubSpot integration. HubSpot campaigns.";
    const result = atsKeywordPass(cv, jd);
    expect(result.injected).not.toContain("HubSpot");
  });

  it("does NOT inject keywords that appear only once in the JD (below ATS_MIN_JD_FREQUENCY)", () => {
    expect(ATS_MIN_JD_FREQUENCY).toBe(2);
    const cv = makeCv([{ group: "Skills", items: ["Python"] }]);
    // "Tableau" appears only once
    const jd = "We need someone who knows Tableau for reporting.";
    const result = atsKeywordPass(cv, jd);
    expect(result.injected).not.toContain("Tableau");
  });

  it("does NOT inject stop-words even if they appear many times", () => {
    const cv = makeCv([{ group: "Skills", items: ["Python"] }]);
    // "experience" is in STOP_WORDS — appears 5×
    const jd = "experience experience experience experience experience SQL SQL";
    const result = atsKeywordPass(cv, jd);
    expect(result.injected).not.toContain("experience");
    // SQL appears twice and is not a stop-word — should be injected
    expect(result.injected).toContain("SQL");
  });

  it("caps injections at ATS_MAX_INJECT even when more keywords qualify", () => {
    expect(ATS_MAX_INJECT).toBe(5);
    const cv = makeCv([{ group: "Skills", items: ["Python"] }]);
    // 20 unique qualifying keywords, each repeated 3×
    const tokens = [
      "Salesforce", "Marketo", "HubSpot", "Tableau", "Looker",
      "Pardot", "Braze", "Klaviyo", "Iterable", "Segment",
      "Amplitude", "Mixpanel", "Intercom", "Drift", "Outreach",
      "Gong", "Highspot", "Seismic", "Chorus", "Clari",
    ];
    const jd = tokens.flatMap((t) => [t, t, t]).join(" ");
    const result = atsKeywordPass(cv, jd);
    expect(result.injected.length).toBe(ATS_MAX_INJECT);
  });

  it("returns injected=[] when every qualifying keyword is already in skillsGrouped", () => {
    const cv = makeCv([
      { group: "Technical Skills", items: ["HubSpot", "Marketo", "Salesforce"] },
    ]);
    const jd = "HubSpot HubSpot HubSpot Marketo Marketo Salesforce Salesforce";
    const result = atsKeywordPass(cv, jd);
    expect(result.injected).toEqual([]);
    expect(result.cv).toBe(cv); // same object reference — no mutation
  });

  it("only processes the first ATS_MAX_JD_CHARS characters of jdText", () => {
    expect(ATS_MAX_JD_CHARS).toBe(10000);
    const cv = makeCv([{ group: "Skills", items: ["Python"] }]);
    // "Tableau" appears 3× but only AFTER the 10000-char boundary — must NOT be injected
    const padding = "word ".repeat(2001); // ~10005 chars of padding
    const jd = padding + "Tableau Tableau Tableau";
    // Verify the keyword is beyond char 10000
    expect(jd.indexOf("Tableau")).toBeGreaterThan(ATS_MAX_JD_CHARS);
    const result = atsKeywordPass(cv, jd);
    expect(result.injected).not.toContain("Tableau");
    expect(result.injected).not.toContain("tableau");
  });

  it("routes injected keywords into a 'skill/tool' group when one exists", () => {
    const cv = makeCv([{ group: "Technical Skills", items: ["Python"] }]);
    const jd = "HubSpot HubSpot HubSpot Marketo Marketo";
    const result = atsKeywordPass(cv, jd);
    const techGroup = result.cv.skillsGrouped.find((g) => g.group === "Technical Skills");
    expect(techGroup).toBeDefined();
    expect(techGroup!.items).toContain("HubSpot");
    expect(techGroup!.items).toContain("Marketo");
    // No extra group should have been created
    expect(result.cv.skillsGrouped.length).toBe(1);
  });

  it("creates 'Additional Skills' group when no skill/tool group exists and groups < 5", () => {
    const cv = makeCv([{ group: "Languages", items: ["Dutch", "English"] }]);
    const jd = "HubSpot HubSpot HubSpot Marketo Marketo";
    const result = atsKeywordPass(cv, jd);
    const addGroup = result.cv.skillsGrouped.find((g) => g.group === "Additional Skills");
    expect(addGroup).toBeDefined();
    expect(addGroup!.items).toContain("HubSpot");
    expect(addGroup!.items).toContain("Marketo");
  });

  it("appends to the last group when no skill/tool group exists and groups === 5", () => {
    // NOTE: group names deliberately avoid "skill"/"tool" so targetIdx stays -1
    const cv = makeCv([
      { group: "Languages", items: ["Dutch"] },
      { group: "Interpersonal", items: ["Leadership"] },
      { group: "Domain", items: ["B2B"] },
      { group: "Industry", items: ["SaaS"] },
      { group: "Other", items: ["Project management"] },
    ]);
    const jd = "HubSpot HubSpot HubSpot Marketo Marketo";
    const result = atsKeywordPass(cv, jd);
    // Must stay at 5 groups (not grow to 6)
    expect(result.cv.skillsGrouped.length).toBe(5);
    const lastGroup = result.cv.skillsGrouped[4];
    expect(lastGroup.group).toBe("Other");
    expect(lastGroup.items).toContain("HubSpot");
    expect(lastGroup.items).toContain("Marketo");
  });
});
