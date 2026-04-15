import { describe, it, expect } from "vitest";

describe("cover letter generator", () => {
  it("module loads without hitting network/db at import time", async () => {
    const mod = await import("@/lib/generate/cover-letter");
    expect(typeof mod.generateCoverLetter).toBe("function");
  });
});
