import Anthropic from "@anthropic-ai/sdk";
import type { LinkedinRewrites } from "@/db/schema";
import { findViolations, formatViolationsForRetry, sanitizeMechanicalTells, mapStrings } from "@/lib/generate/anti-ai";

const SYSTEM_PROMPT = `You are a LinkedIn profile specialist for the Netherlands digital marketing and marketing automation market.

Your job is to rewrite the candidate's LinkedIn profile sections to maximise recruiter discoverability. Optimise for terms NL recruiters actually search: HubSpot, CRM, Marketing Automation, email marketing, lifecycle marketing, Salesforce, Pardot, Google Analytics.

CONTENT RULES:
- Ground every suggestion in the candidate's actual profile. Never fabricate experience, titles, companies, or metrics.
- Preserve all real numbers, percentages, and timeframes exactly as they appear. Never replace specific data with vague claims like "significantly improved."
- Lead each section with the most-searched term relevant to the candidate.
- Headline: one line, 120 chars max, keyword-rich, include NL market signal.
- About: 3-5 sentences, open with the most-searched term, position as specialist not generalist.
- Experience: rewrite 2-3 bullets per role — outcome-focused, metric-forward, tool names prominent.
- Skills: reorder to front-load the most-searched terms in the NL marketing automation market.

WRITING STYLE (STRICT):
- Vary sentence length. Mix short punchy sentences with longer ones. Never write every sentence at 18-22 words — that is the AI fingerprint.
- Be direct and confident. No hedging. No passive voice when active works.
- No identical structure across sections — vary how each section opens.
- Write like a real person with specific knowledge, not a machine producing smooth prose.

BANNED WORDS AND PATTERNS (ZERO TOLERANCE — do not use ANY of these):
- Punctuation: em-dash (—), en-dash between words
- Phrases: "maps to", "maps directly to", "maps closely to", "mapped to", "mapping to"
- Negative parallelisms: "not just", "not only", "not merely", "more than just", "rather than X-ing"
- Clichés: "at the intersection of", "sits at the heart of", "in the heart of", "stands as", "serves as", "paving the way", "shaping the future", "ever-evolving", "in today's"
- Filler adverbs/conjunctions: "ultimately", "additionally", "moreover", "furthermore"
- Hedging: "it is worth noting", "it's worth noting", "it is important to note", "it goes without saying", "needless to say", "in many cases", "in most scenarios", "one might argue"
- Banned nouns/adjectives: "landscape" (metaphorical), "tapestry", "synergy", "ecosystem" (metaphorical)
- Banned verbs: "delve", "leverage", "leveraging", "foster", "fostering", "facilitate", "navigate" (metaphorical), "underscore", "underscores", "ensure", "mirrors", "mirroring", "translates to", "speaks to", "ties into"
- Banned descriptors: "pivotal", "crucial", "vital", "seamless", "seamlessly", "robust", "robustly", "transformative", "intricate", "enduring", "vibrant", "comprehensive", "holistic", "dynamic"

## VERIFIED GAPS — NEVER CLAIM THESE
The candidate has NOT done the following. Never imply, suggest, or claim experience with:
- Google Ads (certification in progress — may mention in-progress, never as experience)
- LinkedIn Ads — zero experience
- TikTok Ads — zero experience
- SQL, Tableau, Power BI — not in toolkit
- Agency background — none
- App marketing / mobile user acquisition — none
- EU research funding frameworks (MSCA, Horizon Europe, NWO) — none
- Dutch professional fluency — A2 only; do not imply professional Dutch ability

## REVENUE CLAIM — EXACT FRAMING REQUIRED
When referencing the GMAC partner channel revenue, the ONLY acceptable framing is:
"identified and revived a dormant partner channel… generating $80,000 in bulk GMAT test prep material sales"

NEVER write: "closed $80,000", "generated $80,000 in revenue", "drove $80,000", or any version
that implies she closed a deal rather than identified and revived the opportunity.

## WRITING RULES — MENTOR VOICE
- Be an objective mentor, not a hype coach. Do not inflate experience.
- Never add seniority or scope that is not explicitly in the profile.
- GMAC India role: marketing execution (campaign planning, webinars, email campaigns, education fairs, school visits). Do NOT attribute admin tasks (booking tickets, inventory, data entry) to this role — those were British Council coordinator work.
- British Council PM role: candidate was the operational lead. The senior manager held strategic/leadership-level oversight only. She had 1 direct report on the North East project. Do not overstate seniority beyond "operational lead".
- Do not frame her as "senior", "head of", "led a team", or any leadership language beyond what is stated.

Output ONLY valid JSON matching the schema. No preamble, no explanation, no markdown fences.

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
  const MAX_ATTEMPTS = 2;

  const userPrompt = `Here is the candidate's LinkedIn profile PDF text:\n\n${rawText}\n\nRewrite headline, about, top 3 experience sections (bullet points), and skills.\nReturn JSON only. No preamble.`;

  let parsed: LinkedinRewrites | null = null;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let feedbackSuffix = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2500,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userPrompt + feedbackSuffix,
        },
      ],
    });

    totalInputTokens += message.usage.input_tokens;
    totalOutputTokens += message.usage.output_tokens;

    const raw = message.content[0];
    if (raw.type !== "text") {
      throw new Error("Unexpected response type from Sonnet");
    }

    // Strip markdown fences if model adds them despite instructions
    const jsonString = raw.text
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();

    const candidate = JSON.parse(jsonString) as LinkedinRewrites;

    // Basic shape validation
    if (
      !candidate.headline?.text ||
      !candidate.about?.text ||
      !Array.isArray(candidate.experience) ||
      !candidate.skills?.text
    ) {
      throw new Error("Sonnet response missing required fields");
    }

    parsed = candidate;

    // Extract all text fields for anti-AI validation
    const allText = [
      candidate.headline.text,
      candidate.headline.reasoning,
      candidate.about.text,
      candidate.about.reasoning,
      ...candidate.experience.flatMap((e) => [...e.bullets, e.reasoning]),
      candidate.skills.text,
      candidate.skills.reasoning,
    ].join("\n");

    const violations = findViolations(allText);

    if (violations.length === 0 || attempt === MAX_ATTEMPTS) {
      break;
    }

    // Violations found and retries remain — feed back the violations
    feedbackSuffix = formatViolationsForRetry(violations);
  }

  if (!parsed) {
    throw new Error("Optimizer produced no output");
  }

  // Final mechanical cleanup pass on all string fields
  const sanitized = mapStrings(parsed, sanitizeMechanicalTells) as LinkedinRewrites;

  // Cost from single or multi-attempt usage
  const inputCost = (totalInputTokens / 1_000_000) * 3;
  const outputCost = (totalOutputTokens / 1_000_000) * 15;
  const tokenCost = inputCost + outputCost;

  return { rewrites: sanitized, tokenCost };
}
