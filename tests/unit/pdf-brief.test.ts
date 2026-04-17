import { describe, it, expect } from "vitest";
import { buildInterviewBriefPdf } from "@/lib/interview/pdf-brief";

describe("buildInterviewBriefPdf", () => {
  it("produces a PDF starting with %PDF magic bytes", async () => {
    const bytes = await buildInterviewBriefPdf({
      title: "Senior Marketing Manager",
      companyName: "Atlas Heavy",
      prepMarkdown: "# Phone screen\n\n- Expect questions about metrics\n- Discuss ICP",
      dossier: { productOneLiner: "x", stage: "scale-up", industry: "MarTech", narrative: "n" },
    });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes[0]).toBe(0x25);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x44);
    expect(bytes[3]).toBe(0x46);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("handles null dossier — still produces valid PDF > 1000 bytes", async () => {
    const bytes = await buildInterviewBriefPdf({
      title: "Product Manager",
      companyName: "Tech Corp",
      prepMarkdown: "## Prep\n\n- Know the product",
      dossier: null,
    });
    expect(bytes[0]).toBe(0x25);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x44);
    expect(bytes[3]).toBe(0x46);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("handles empty prepMarkdown — still produces valid PDF > 1000 bytes", async () => {
    const bytes = await buildInterviewBriefPdf({
      title: "Engineer",
      companyName: "Startup Inc",
      prepMarkdown: "",
      dossier: { productOneLiner: "SaaS tool", stage: "seed", industry: "B2B" },
    });
    expect(bytes[0]).toBe(0x25);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x44);
    expect(bytes[3]).toBe(0x46);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("larger markdown body produces larger PDF than small markdown body", async () => {
    const longMarkdown = Array(50)
      .fill("- This is a bullet point with some meaningful content about the interview process")
      .join("\n");

    const smallBytes = await buildInterviewBriefPdf({
      title: "Role A",
      companyName: "Company A",
      prepMarkdown: "Short text.",
      dossier: null,
    });

    const largeBytes = await buildInterviewBriefPdf({
      title: "Role A",
      companyName: "Company A",
      prepMarkdown: longMarkdown,
      dossier: null,
    });

    expect(largeBytes.length).toBeGreaterThan(smallBytes.length);
  });
});
