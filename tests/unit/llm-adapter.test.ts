import { describe, it, expect } from "vitest";
import { costEur } from "@/lib/llm/anthropic-api";

describe("costEur", () => {
  it("computes Sonnet cost correctly (USD → EUR at 0.92)", () => {
    // Sonnet: $3/M in, $15/M out
    // 1000 in, 500 out => 0.003 + 0.0075 = $0.0105 USD
    // × 0.92 = €0.00966
    const c = costEur("sonnet", { tokensIn: 1000, tokensOut: 500, cachedTokensIn: 0 });
    expect(c).toBeCloseTo(0.00966, 5);
  });

  it("applies cached-input discount (Sonnet cache-read is $0.30/M, 10% of input)", () => {
    // 1000 cached => 1000 × 0.3 / 1e6 = $0.0003 USD × 0.92 = €0.000276
    const c = costEur("sonnet", { tokensIn: 0, tokensOut: 0, cachedTokensIn: 1000 });
    expect(c).toBeCloseTo(0.000276, 6);
  });

  it("computes Haiku cost correctly", () => {
    // Haiku: $1/M in, $5/M out
    // 1000 in, 500 out => 0.001 + 0.0025 = $0.0035 USD × 0.92 = €0.00322
    const c = costEur("haiku", { tokensIn: 1000, tokensOut: 500, cachedTokensIn: 0 });
    expect(c).toBeCloseTo(0.00322, 5);
  });
});
