import { scrapeCompany } from "./scraper";
import { fingerprintStack } from "./fingerprint";
import { synthesizeDossier } from "./synthesizer";
import { readCached, writeCached } from "./cache";
import type { Dossier } from "./types";

export type { Dossier } from "./types";

/**
 * Get a company dossier. Lazy: checks cache first, synthesizes on miss.
 * Never throws — returns a conservative low-signal dossier if everything fails.
 */
export async function getCompanyDossier(params: {
  companyName: string;
  domain?: string | null;
}): Promise<Dossier> {
  const { companyName } = params;

  // 1. Cache hit?
  const cached = await readCached(companyName);
  if (cached) return cached;

  // 2. Miss — build dossier
  let scrapedPages: Array<{ path: string; text: string }> = [];
  let marketingStack: string[] = [];
  let domain = params.domain ?? null;

  if (domain) {
    try {
      const scrape = await scrapeCompany(domain);
      scrapedPages = scrape.pagesScraped;
      marketingStack = fingerprintStack(scrape.rawHtmlHome);
    } catch {
      // scrape failed — fall through to low-signal
    }
  }

  let dossier: Dossier;
  try {
    dossier = await synthesizeDossier({
      companyName,
      domain,
      scrapedPages,
      marketingStack,
    });
  } catch {
    // LLM failed — emit minimal dossier
    dossier = {
      company: companyName,
      domain,
      productOneLiner: "",
      stage: "unknown",
      marketingStack,
      industry: "",
      hqLocation: null,
      employeeSize: null,
      recentNews: [],
      cultureSignals: [],
      narrative: `${companyName} — research unavailable.`,
      lowSignal: true,
    };
  }

  // 3. Cache (best-effort — don't block on write failure)
  try { await writeCached(companyName, dossier); } catch { /* ignore */ }

  return dossier;
}
