import { describe, it, expect } from "vitest";

describe("LLM live integration", () => {
  it("calls Haiku with a tiny prompt", async () => {
    if (!process.env.RUN_INTEGRATION) {
      console.log("skipped — set RUN_INTEGRATION=1");
      return;
    }
    const { getLLM } = await import("@/lib/llm");
    const res = await getLLM().complete({
      model: "haiku",
      prompt: "Reply with exactly the word: PONG",
      maxTokens: 20,
      temperature: 0,
    });
    expect(res.text).toContain("PONG");
    expect(res.tokensIn).toBeGreaterThan(0);
    expect(res.costEur).toBeGreaterThan(0);
  });
});
