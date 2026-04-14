import { AnthropicAPIAdapter } from "./anthropic-api";
import type { LLMAdapter } from "./adapter";

export type { LLMAdapter } from "./adapter";

let singleton: LLMAdapter | null = null;
export function getLLM(): LLMAdapter {
  if (!singleton) singleton = new AnthropicAPIAdapter();
  return singleton;
}
