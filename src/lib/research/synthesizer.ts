import { getLLM } from "@/lib/llm";
import type { Dossier } from "./types";
import { DossierSchema } from "./types";

const SYSTEM_PROMPT = `You are a company-research analyst for a job-search tool.

You produce concise, accurate company dossiers that will be fed into CV and cover-letter generation. You MUST:
- Base claims on the provided scrape text and fingerprint when available.
- If the scrape is thin or the company is unknown, set lowSignal=true and produce a conservative narrative grounded in the name alone.
- Never invent funding rounds, headcount, or news that isn't clearly stated or publicly well-known.
- Narrative should be 500-800 words, structured as: what they do (2-3 sentences) → market position → product or service differentiation → who's on the marketing/growth team → recent notable moves → culture/working style signals.
- Prefer "unknown"/"null"/empty-array to fabrication.
- Write the narrative in English.`;

export async function synthesizeDossier(input: {
  companyName: string;
  domain: string | null;
  scrapedPages: Array<{ path: string; text: string }>;
  marketingStack: string[];
}): Promise<Dossier> {
  const llm = getLLM();
  const scrapeSummary = input.scrapedPages.length > 0
    ? input.scrapedPages.map((p) => `## Path: ${p.path}\n${p.text}`).join("\n\n---\n\n")
    : "NO_SCRAPE_AVAILABLE";
  const stackLine = input.marketingStack.length > 0
    ? `Marketing stack detected from home-page HTML: ${input.marketingStack.join(", ")}.`
    : "No marketing-stack signals detected.";

  const prompt = `COMPANY: ${input.companyName}
DOMAIN: ${input.domain ?? "unknown"}
${stackLine}

SCRAPED CONTENT:
${scrapeSummary}

Produce the structured dossier. If scrape is NO_SCRAPE_AVAILABLE and the company is a household name, use your baseline knowledge with lowSignal=false. Otherwise set lowSignal=true.`;

  const res = await llm.structured({
    model: "sonnet",
    system: SYSTEM_PROMPT,
    prompt,
    schema: DossierSchema,
    maxTokens: 2000,
    temperature: 0.3,
    cacheSystem: true,
  });
  return res.data;
}
