import type { LLMAdapter } from "./adapter";

export class ClaudeMaxCLIAdapter implements LLMAdapter {
  complete(): never {
    throw new Error("ClaudeMaxCLIAdapter not implemented — use AnthropicAPIAdapter");
  }
  structured(): never {
    throw new Error("ClaudeMaxCLIAdapter not implemented");
  }
}
