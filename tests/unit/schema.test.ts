import { describe, it, expect } from "vitest";
import * as schema from "@/db/schema";

describe("schema", () => {
  it("exports all Week 1 + A/B tables", () => {
    const expected = [
      "profile", "companies", "jobs", "applications",
      "documents", "events", "screeningAnswers",
      "researchCache", "runs", "llmBudget",
      "experiments", "variants",
    ];
    for (const t of expected) {
      expect((schema as Record<string, unknown>)[t]).toBeDefined();
    }
  });
});
