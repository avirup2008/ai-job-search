import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (compatible; ai-job-search-bot/1.0; +personal-use)";
const TIMEOUT_MS = 8000;
const MAX_CHARS_PER_PAGE = 4000;
// Paths to try in order; first 3 that succeed contribute.
const PATHS = ["", "/about", "/about-us", "/company", "/product", "/products", "/careers", "/jobs", "/team"] as const;

export interface ScrapeResult {
  domain: string;
  rawHtmlHome: string | null;
  pagesScraped: Array<{ path: string; text: string }>;
  errors: string[];
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, "accept": "text/html,application/xhtml+xml", "accept-language": "en,nl;q=0.5" },
      signal: ctl.signal,
      redirect: "follow",
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  // Strip scripts/styles
  $("script, style, noscript, nav, footer, header").remove();
  // Extract visible text
  const text = $("body").text()
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, MAX_CHARS_PER_PAGE);
}

export async function scrapeCompany(domain: string): Promise<ScrapeResult> {
  const normalized = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const base = `https://${normalized}`;
  const out: ScrapeResult = { domain: normalized, rawHtmlHome: null, pagesScraped: [], errors: [] };

  for (const path of PATHS) {
    if (out.pagesScraped.length >= 3) break;
    const url = `${base}${path}`;
    const res = await fetchWithTimeout(url);
    if (!res) { out.errors.push(`${path}: fetch failed`); continue; }
    if (!res.ok) { out.errors.push(`${path}: ${res.status}`); continue; }
    const html = await res.text();
    if (path === "") out.rawHtmlHome = html;
    const text = htmlToText(html);
    if (text.length < 100) continue; // skip near-empty pages
    out.pagesScraped.push({ path, text });
  }
  return out;
}
