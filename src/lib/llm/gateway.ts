import { loadLlmEnv } from "@/lib/env";
import type {
  LLMAdapter, CompleteRequest, CompleteResponse,
  StructuredRequest, StructuredResponse, Model,
} from "./adapter";
import { getBudget, recordSpend } from "./budget";

export class BudgetExceededError extends Error {
  constructor(period: string, eurSpent: number, capEur: number) {
    super(`Budget exceeded for ${period}: €${eurSpent.toFixed(2)}/€${capEur.toFixed(2)}`);
    this.name = "BudgetExceededError";
  }
}

type Decision = { action: "allow" | "downgrade" | "block"; reason?: string };

function decide(model: Model, utilization: number): Decision {
  if (utilization >= 1.0) return { action: "block", reason: "cap reached" };
  if (utilization >= 0.80 && model === "sonnet") return { action: "downgrade", reason: ">=80%: Sonnet→Haiku" };
  return { action: "allow" };
}

export class BudgetGateway implements LLMAdapter {
  constructor(private inner: LLMAdapter) {}

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const cap = loadLlmEnv().MONTHLY_LLM_CAP_EUR;
    const state = await getBudget(cap);
    const d = decide(req.model, state.utilization);
    if (d.action === "block") throw new BudgetExceededError(state.period, state.eurSpent, state.capEur);
    const finalModel: Model = d.action === "downgrade" ? "haiku" : req.model;
    const res = await this.inner.complete({ ...req, model: finalModel });
    await recordSpend({ costEur: res.costEur, tokensIn: res.tokensIn, tokensOut: res.tokensOut, capEur: cap });
    return res;
  }

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>> {
    const cap = loadLlmEnv().MONTHLY_LLM_CAP_EUR;
    const state = await getBudget(cap);
    const d = decide(req.model, state.utilization);
    if (d.action === "block") throw new BudgetExceededError(state.period, state.eurSpent, state.capEur);
    const finalModel: Model = d.action === "downgrade" ? "haiku" : req.model;
    const res = await this.inner.structured({ ...req, model: finalModel });
    await recordSpend({ costEur: res.costEur, tokensIn: res.tokensIn, tokensOut: res.tokensOut, capEur: cap });
    return res;
  }
}
