import { describe, it, expect } from "vitest";
import { fingerprintStack } from "@/lib/research/fingerprint";

describe("fingerprintStack", () => {
  it("returns empty array for null/empty HTML", () => {
    expect(fingerprintStack(null)).toEqual([]);
    expect(fingerprintStack("")).toEqual([]);
  });

  it("detects HubSpot", () => {
    const html = `<script src="//js.hs-scripts.com/12345.js"></script>`;
    expect(fingerprintStack(html)).toContain("HubSpot");
  });

  it("detects Google Tag Manager", () => {
    const html = `<script>(function(w,d,s,l,i){...GTM-ABC123...})</script>`;
    expect(fingerprintStack(html)).toContain("Google Tag Manager");
  });

  it("detects multiple tools", () => {
    const html = `
      <script src="//js.hs-scripts.com/1.js"></script>
      <script src="//connect.facebook.net/en_US/fbevents.js"></script>
      <script>fbq('init', '123');</script>
    `;
    const result = fingerprintStack(html);
    expect(result).toContain("HubSpot");
    expect(result).toContain("Meta Pixel");
  });

  it("returns sorted, deduplicated results", () => {
    // Real WordPress pages emit wp-content/ and wp-includes/ (with trailing slash)
    const html = `<link rel="stylesheet" href="/wp-content/themes/main.css"><script src="/wp-includes/js/jquery.js"></script>`;
    expect(fingerprintStack(html)).toEqual(["WordPress"]);
  });
});
