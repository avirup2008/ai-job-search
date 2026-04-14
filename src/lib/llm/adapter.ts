import { z } from "zod";

export type Model = "haiku" | "sonnet";

export interface CompleteRequest {
  model: Model;
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  cacheSystem?: boolean;
}

export interface CompleteResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  cachedTokensIn: number;
  model: string;
  costEur: number;
}

export interface StructuredRequest<T> {
  model: Model;
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
  cacheSystem?: boolean;
}

export interface StructuredResponse<T> {
  data: T;
  tokensIn: number;
  tokensOut: number;
  cachedTokensIn: number;
  model: string;
  costEur: number;
}

export interface LLMAdapter {
  complete(req: CompleteRequest): Promise<CompleteResponse>;
  structured<T>(req: StructuredRequest<T>): Promise<StructuredResponse<T>>;
}
