import { describe, it, expect } from "vitest";
import { parseLinkedInSearchHtml, parseLinkedInDetailHtml } from "@/lib/sources/linkedin-guest";

describe("parseLinkedInSearchHtml", () => {
  const FIXTURE = `
    <ul>
      <li>
        <div data-entity-urn="urn:li:jobPosting:3987654321">
          <a href="https://www.linkedin.com/jobs/view/marketing-automation-specialist-at-acme-3987654321?refId=abc">
          <h3 class="base-search-card__title">Marketing Automation Specialist</h3>
          <h4 class="base-search-card__subtitle">Acme BV</h4>
          <span class="job-search-card__location">Amsterdam, Netherlands</span>
          <time datetime="2026-04-20">2 days ago</time>
        </div>
      </li>
      <li>
        <div data-entity-urn="urn:li:jobPosting:1111111111">
          <h3 class="base-search-card__title">CRM Specialist</h3>
        </div>
      </li>
    </ul>
  `;

  it("extracts job ID, title, company, location, date from a card", () => {
    const results = parseLinkedInSearchHtml(FIXTURE);
    const first = results[0];
    expect(first.jobId).toBe("3987654321");
    expect(first.title).toBe("Marketing Automation Specialist");
    expect(first.company).toBe("Acme BV");
    expect(first.location).toBe("Amsterdam, Netherlands");
    expect(first.postedAt).toEqual(new Date("2026-04-20"));
    expect(first.sourceUrl).toContain("3987654321");
  });

  it("skips cards with no job ID", () => {
    const results = parseLinkedInSearchHtml("<li><h3>No ID here</h3></li>");
    expect(results).toHaveLength(0);
  });

  it("skips cards with no title", () => {
    const results = parseLinkedInSearchHtml(
      `<li><div data-entity-urn="urn:li:jobPosting:9999"></div></li>`
    );
    expect(results).toHaveLength(0);
  });

  it("returns empty array for empty HTML", () => {
    expect(parseLinkedInSearchHtml("")).toHaveLength(0);
  });
});

describe("parseLinkedInDetailHtml", () => {
  it("extracts text from show-more-less-html__markup", () => {
    const html = `<div class="show-more-less-html__markup"><p>We are looking for a <strong>marketing automation</strong> specialist.</p></div>`;
    const result = parseLinkedInDetailHtml(html);
    expect(result).toContain("marketing automation");
    expect(result).not.toContain("<p>");
  });

  it("falls back to description__text", () => {
    const html = `<div class="description__text"><p>Fallback description</p></div>`;
    expect(parseLinkedInDetailHtml(html)).toContain("Fallback description");
  });

  it("returns empty string for unrecognised HTML", () => {
    expect(parseLinkedInDetailHtml("<html><body>Nothing</body></html>")).toBe("");
  });
});
