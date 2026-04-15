import { describe, it, expect } from "vitest";
import { renderThirtySixtyNinetyHtml, renderEmailCrmTeardownHtml } from "@/lib/generate/artifacts/templates";

describe("artifact HTML templates", () => {
  it("renders 30-60-90 without JSX errors", () => {
    const html = renderThirtySixtyNinetyHtml({
      header: {
        title: "Test: 30-60-90",
        subtitle: "A test subtitle",
        authorName: "Test Author",
        companyName: "Test Co",
        roleTitle: "Test Role",
        dateIso: "2026-04-15",
      },
      premise: "Test premise.",
      phases: [
        { phase: "0-30", theme: "T1", goals: ["g1", "g2"], initiatives: [{ name: "n1", description: "d1", successMetric: "m1" }, { name: "n2", description: "d2", successMetric: "m2" }] },
        { phase: "31-60", theme: "T2", goals: ["g3", "g4"], initiatives: [{ name: "n3", description: "d3", successMetric: "m3" }, { name: "n4", description: "d4", successMetric: "m4" }] },
        { phase: "61-90", theme: "T3", goals: ["g5", "g6"], initiatives: [{ name: "n5", description: "d5", successMetric: "m5" }, { name: "n6", description: "d6", successMetric: "m6" }] },
      ],
      openQuestions: ["q1", "q2"],
    });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Test: 30-60-90");
    expect(html).toContain("Days 0-30");
  });

  it("escapes HTML injection", () => {
    const html = renderThirtySixtyNinetyHtml({
      header: {
        title: "<script>x</script>",
        subtitle: "x",
        authorName: "x",
        companyName: "x",
        roleTitle: "x",
        dateIso: "2026-04-15",
      },
      premise: "",
      phases: [
        { phase: "0-30", theme: "", goals: [""], initiatives: [{ name: "", description: "", successMetric: "" }, { name: "", description: "", successMetric: "" }] },
        { phase: "31-60", theme: "", goals: [""], initiatives: [{ name: "", description: "", successMetric: "" }, { name: "", description: "", successMetric: "" }] },
        { phase: "61-90", theme: "", goals: [""], initiatives: [{ name: "", description: "", successMetric: "" }, { name: "", description: "", successMetric: "" }] },
      ],
      openQuestions: [],
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
  });

  it("renders email-crm teardown", () => {
    const html = renderEmailCrmTeardownHtml({
      header: { title: "T", subtitle: "s", authorName: "a", companyName: "c", roleTitle: "r", dateIso: "2026-04-15" },
      observations: [
        { area: "acquisition", signal: "s1", gap: "g1", suggestion: "sg1" },
        { area: "retention", signal: "s2", gap: "g2", suggestion: "sg2" },
        { area: "onboarding", signal: "s3", gap: "g3", suggestion: "sg3" },
      ],
      quickWins: ["qw1", "qw2"],
      measurementPlan: "mp",
      caveats: ["cv1"],
    });
    expect(html).toContain("Quick Wins");
    expect(html).toContain("Measurement Plan");
  });
});
