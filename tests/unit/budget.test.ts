import { describe, it, expect, beforeEach, vi } from "vitest";
import type { LLMAdapter, CompleteRequest, CompleteResponse } from "@/lib/llm/adapter";

// Mock db + env
const getBudgetSpy = vi.fn();
const recordSpendSpy = vi.fn();
vi.mock("@/lib/llm/budget", () => ({
  getBudget: (...args: unknown[]) => getBudgetSpy(...args),
  recordSpend: (...args: unknown[]) => recordSpendSpy(...args),
  currentPeriod: () => "2026-04",
}));
vi.mock("@/lib/env", () => ({
  loadEnv: () => ({ MONTHLY_LLM_CAP_EUR: 20 }),
  tryLoadEnv: () => ({ MONTHLY_LLM_CAP_EUR: 20 }),
}));

function mkAdapter(overrides: Partial<LLMAdapter> = {}, log?: string[]): LLMAdapter {
  return {
    complete: async (r: CompleteRequest): Promise<CompleteResponse> => {
      log?.push(r.model);
      return { text: "ok", tokensIn: 100, tokensOut: 50, cachedTokensIn: 0, model: r.model, costEur: 0.01 };
    },
    structured: async () => { throw new Error("nyi"); },
    ...overrides,
  };
}

describe("BudgetGateway", () => {
  beforeEach(() => {
    getBudgetSpy.mockReset();
    recordSpendSpy.mockReset();
  });

  it("allows and records spend when under cap", async () => {
    getBudgetSpy.mockResolvedValue({ period: "2026-04", eurSpent: 5, capEur: 20, utilization: 0.25 });
    recordSpendSpy.mockResolvedValue(undefined);

    const { BudgetGateway } = await import("@/lib/llm/gateway");
    const gw = new BudgetGateway(mkAdapter());
    const res = await gw.complete({ model: "sonnet", prompt: "x" });

    expect(res.text).toBe("ok");
    expect(recordSpendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ costEur: 0.01, tokensIn: 100, tokensOut: 50, capEur: 20 }),
    );
  });

  it("downgrades Sonnet → Haiku at ≥80% utilization", async () => {
    getBudgetSpy.mockResolvedValue({ period: "2026-04", eurSpent: 16, capEur: 20, utilization: 0.8 });
    recordSpendSpy.mockResolvedValue(undefined);

    const log: string[] = [];
    const { BudgetGateway } = await import("@/lib/llm/gateway");
    const gw = new BudgetGateway(mkAdapter({}, log));
    await gw.complete({ model: "sonnet", prompt: "x" });
    expect(log[0]).toBe("haiku");
  });

  it("does not downgrade Haiku calls (already cheapest)", async () => {
    getBudgetSpy.mockResolvedValue({ period: "2026-04", eurSpent: 18, capEur: 20, utilization: 0.9 });
    recordSpendSpy.mockResolvedValue(undefined);

    const log: string[] = [];
    const { BudgetGateway } = await import("@/lib/llm/gateway");
    const gw = new BudgetGateway(mkAdapter({}, log));
    await gw.complete({ model: "haiku", prompt: "x" });
    expect(log[0]).toBe("haiku");
  });

  it("blocks with BudgetExceededError at ≥100% utilization", async () => {
    getBudgetSpy.mockResolvedValue({ period: "2026-04", eurSpent: 20, capEur: 20, utilization: 1.0 });

    const { BudgetGateway, BudgetExceededError } = await import("@/lib/llm/gateway");
    const gw = new BudgetGateway(mkAdapter());
    await expect(gw.complete({ model: "sonnet", prompt: "x" })).rejects.toBeInstanceOf(BudgetExceededError);
    expect(recordSpendSpy).not.toHaveBeenCalled();
  });

  it("applies downgrade/block policy to structured calls too", async () => {
    getBudgetSpy.mockResolvedValue({ period: "2026-04", eurSpent: 16, capEur: 20, utilization: 0.8 });
    recordSpendSpy.mockResolvedValue(undefined);

    const log: string[] = [];
    const mock: LLMAdapter = {
      complete: async () => { throw new Error("not used"); },
      structured: async (r) => {
        log.push(r.model);
        return { data: {} as never, tokensIn: 10, tokensOut: 5, cachedTokensIn: 0, model: r.model, costEur: 0.001 };
      },
    };
    const { BudgetGateway } = await import("@/lib/llm/gateway");
    const gw = new BudgetGateway(mock);
    await gw.structured({ model: "sonnet", prompt: "x", schema: {} as never });
    expect(log[0]).toBe("haiku");
  });
});
