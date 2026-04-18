import { describe, it, expect } from "vitest";
import { mapApifyItem } from "@/lib/sources/apify-indeed";

const SAMPLE = {
  id: "e7afea99e816e9b9",
  positionName: "Marketing Automation Specialist",
  company: "Acme BV",
  location: "Amsterdam",
  url: "https://nl.indeed.com/viewjob?jk=e7afea99e816e9b9",
  description: "We are looking for a MarTech specialist.",
  postingDateParsed: "2026-04-17T14:57:50.993Z",
};

describe("mapApifyItem", () => {
  it("maps source to indeed-nl", () => {
    expect(mapApifyItem(SAMPLE).source).toBe("indeed-nl");
  });

  it("uses id as sourceExternalId", () => {
    expect(mapApifyItem(SAMPLE).sourceExternalId).toBe("e7afea99e816e9b9");
  });

  it("uses url as sourceUrl", () => {
    expect(mapApifyItem(SAMPLE).sourceUrl).toContain("jk=e7afea99e816e9b9");
  });

  it("falls back sourceUrl to viewjob when url is missing", () => {
    const result = mapApifyItem({ ...SAMPLE, url: "" });
    expect(result.sourceUrl).toBe("https://nl.indeed.com/viewjob?jk=e7afea99e816e9b9");
  });

  it("maps positionName to title", () => {
    expect(mapApifyItem(SAMPLE).title).toBe("Marketing Automation Specialist");
  });

  it("maps description to jdText", () => {
    expect(mapApifyItem(SAMPLE).jdText).toContain("MarTech");
  });

  it("maps null description to empty string", () => {
    expect(mapApifyItem({ ...SAMPLE, description: null }).jdText).toBe("");
  });

  it("maps company to companyName", () => {
    expect(mapApifyItem(SAMPLE).companyName).toBe("Acme BV");
  });

  it("maps null company to null", () => {
    expect(mapApifyItem({ ...SAMPLE, company: null }).companyName).toBeNull();
  });

  it("parses postingDateParsed into a Date", () => {
    const result = mapApifyItem(SAMPLE);
    expect(result.postedAt).toBeInstanceOf(Date);
    expect(result.postedAt?.getFullYear()).toBe(2026);
  });

  it("maps null postingDateParsed to null postedAt", () => {
    expect(mapApifyItem({ ...SAMPLE, postingDateParsed: null }).postedAt).toBeNull();
  });
});
