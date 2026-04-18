import Anthropic from "@anthropic-ai/sdk";
import type { LinkedinRewrites } from "@/db/schema";

const SYSTEM_PROMPT = `You are a LinkedIn profile specialist for the Netherlands digital marketing and marketing automation market.

Your job is to rewrite the candidate's LinkedIn profile sections to maximise recruiter discoverability — not creativity. Optimise for the terms that NL recruiters actually search: HubSpot, CRM, Marketing Automation, email marketing, lifecycle marketing, Salesforce, Pardot, Google Analytics.

Rules:
- Ground every suggestion in the candidate's actual profile. Do not fabricate experience, titles, companies, or metrics.
- Lead each section with the most-searched term relevant to the candidate.
- Headline: one line, 120 chars max, keyword-rich, include NL market signal.
- About: 3-5 sentences, open with the most-searched term, position as specialist not generalist.
- Experience: rewrite 2-3 bullets per role — outcome-focused, metric-forward, tool names prominent.
- Skills: reorder to front-load the most-searched terms in the NL marketing automation market.
- Anti-AI language rules (STRICT): no em-dashes, never use "leverage", never use "dynamic", no negative parallelisms ("not X but Y").
- Output ONLY valid JSON matching the schema below. No preamble, no explanation, no markdown fences.

JSON schema:
{
  "headline": { "text": string, "reasoning": string },
  "about": { "text": string, "reasoning": string },
  "experience": [{ "company": string, "role": string, "bullets": string[], "reasoning": string }],
  "skills": { "text": string, "reasoning": string }
}`;

export type OptimizeResult = {
  rewrites: LinkedinRewrites;
  tokenCost: number;
};

export async function optimizeLinkedinProfile(rawText: string): Promise<OptimizeResult> {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2500,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the candidate's LinkedIn profile PDF text:\n\n${rawText}\n\nRewrite headline, about, top 3 experience sections (bullet points), and skills.\nReturn JSON only. No preamble.`,
      },
    ],
  });

  const raw = message.content[0];
  if (raw.type !== "text") {
    throw new Error("Unexpected response type from Sonnet");
  }

  // Strip markdown fences if model adds them despite instructions
  const jsonString = raw.text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  const parsed = JSON.parse(jsonString) as LinkedinRewrites;

  // Basic shape validation
  if (!parsed.headline?.text || !parsed.about?.text || !Array.isArray(parsed.experience) || !parsed.skills?.text) {
    throw new Error("Sonnet response missing required fields");
  }

  // Capture cost from this single call (claude-sonnet-4-5: $3/M input, $15/M output)
  const inputCost = (message.usage.input_tokens / 1_000_000) * 3;
  const outputCost = (message.usage.output_tokens / 1_000_000) * 15;
  const tokenCost = inputCost + outputCost;

  return { rewrites: parsed, tokenCost };
}
