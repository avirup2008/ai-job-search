import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema as zodToJson } from "zod-to-json-schema";
import { z } from "zod";
import { loadEnv } from "@/lib/env";
import type {
  LLMAdapter,
  CompleteRequest,
  CompleteResponse,
  StructuredRequest,
  StructuredResponse,
  Model,
} from "./adapter";

const MODEL_IDS: Record<Model, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
};

// Pricing per 1M tokens in USD (2026-04-14).
// Update from https://www.anthropic.com/pricing
const PRICE_USD = {
  haiku: { in: 1.0, out: 5.0, cachedIn: 0.1 },
  sonnet: { in: 3.0, out: 15.0, cachedIn: 0.3 },
} as const;

const USD_TO_EUR = 0.92;

export function costEur(
  model: Model,
  usage: { tokensIn: number; tokensOut: number; cachedTokensIn: number },
): number {
  const p = PRICE_USD[model];
  const usd =
    (usage.tokensIn * p.in) / 1e6 +
    (usage.tokensOut * p.out) / 1e6 +
    (usage.cachedTokensIn * p.cachedIn) / 1e6;
  return usd * USD_TO_EUR;
}

function zodToJsonSchema(schema: z.ZodType<unknown>): object {
  return zodToJson(schema, { target: "openApi3" });
}

export class AnthropicAPIAdapter implements LLMAdapter {
  private anth: Anthropic;

  constructor() {
    const env = loadEnv();
    this.anth = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const modelId = MODEL_IDS[req.model];
    const system = req.system
      ? [
          {
            type: "text" as const,
            text: req.system,
            ...(req.cacheSystem ? { cache_control: { type: "ephemeral" as const } } : {}),
          },
        ]
      : undefined;

    const res = await this.anth.messages.create({
      model: modelId,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.4,
      system,
      messages: [{ role: "user", content: req.prompt }],
    });

    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");

    const tokensIn = res.usage.input_tokens ?? 0;
    const cachedTokensIn = res.usage.cache_read_input_tokens ?? 0;
    const tokensOut = res.usage.output_tokens ?? 0;

    return {
      text,
      tokensIn,
      tokensOut,
      cachedTokensIn,
      model: modelId,
      costEur: costEur(req.model, { tokensIn, tokensOut, cachedTokensIn }),
    };
  }

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>> {
    // Use Anthropic's tool-use JSON output mode for reliable structured output.
    // We define a single tool "respond" whose input schema matches the requested zod schema.
    const modelId = MODEL_IDS[req.model];
    const jsonSchema = zodToJsonSchema(req.schema);

    const system = req.system
      ? [
          {
            type: "text" as const,
            text: req.system,
            ...(req.cacheSystem ? { cache_control: { type: "ephemeral" as const } } : {}),
          },
        ]
      : undefined;

    const res = await this.anth.messages.create({
      model: modelId,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.1,
      system,
      tools: [
        {
          name: "respond",
          description: "Return the structured response matching the schema.",
          input_schema: jsonSchema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "respond" },
      messages: [{ role: "user", content: req.prompt }],
    });

    const toolUse = res.content.find((b) => b.type === "tool_use") as
      | { type: "tool_use"; input: unknown }
      | undefined;
    if (!toolUse) {
      throw new Error(
        `structured: no tool_use block returned; raw=${JSON.stringify(res.content).slice(0, 300)}`,
      );
    }
    const data = req.schema.parse(toolUse.input);

    const tokensIn = res.usage.input_tokens ?? 0;
    const cachedTokensIn = res.usage.cache_read_input_tokens ?? 0;
    const tokensOut = res.usage.output_tokens ?? 0;

    return {
      data,
      tokensIn,
      tokensOut,
      cachedTokensIn,
      model: modelId,
      costEur: costEur(req.model, { tokensIn, tokensOut, cachedTokensIn }),
    };
  }
}
