import { AnthropicAPIAdapter } from "./anthropic-api";
import { BudgetGateway } from "./gateway";
import type { LLMAdapter } from "./adapter";

export type { LLMAdapter } from "./adapter";
export { BudgetExceededError } from "./gateway";

let singleton: LLMAdapter | null = null;
export function getLLM(): LLMAdapter {
  if (!singleton) singleton = new BudgetGateway(new AnthropicAPIAdapter());
  return singleton;
}
