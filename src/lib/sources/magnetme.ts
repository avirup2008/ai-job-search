// Magnet.me job source. NL scale-up-focused job board with English-first listings.
// Extraction strategy: parse window.__PRELOAD_STATE__ from the SSR HTML.
// Magnet.me uses a custom _Rec/_Map/_o/_a serialisation format; we decode it here.
// Fixture at tests/fixtures/magnetme-search.html (captured from /en/opportunities?query=marketing).

import type { JobSource, RawJob } from "./types";
import { SEARCH_KEYWORDS } from "./keywords";

const BASE = "https://magnet.me";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const DELAY_MS = 1500;

// ---------------------------------------------------------------------------
// Decode the _Rec / _Map / _o / _a serialisation Magnet.me bakes into HTML.
// Each tag is a two-element array: [tagName, payload].
//   _Rec / _o  -> object (payload is [[key, val], ...])
//   _Map       -> same structure as _o (used for entity maps)
//   _a         -> array  (payload is [item, ...])
//   _u         -> null/undefined sentinel (payload is null)
//   _Set       -> set    (payload is [item, ...])
// Scalar values are left as-is. String values for leaf nodes are wrapped in an
// extra layer of JSON-encoded quotes (e.g. '"Amsterdam"') — we unquote those.
// ---------------------------------------------------------------------------

type MagnetVal =
  | string
  | number
  | boolean
  | null
  | MagnetVal[]
  | { [k: string]: MagnetVal };

function decodeState(val: MagnetVal): MagnetVal {
  if (!Array.isArray(val) || val.length === 0) return val;
  const [tag, payload] = val as [string, MagnetVal];
  if (tag === "_Rec" || tag === "_o") {
    const pairs = payload as [string, MagnetVal][];
    const obj: { [k: string]: MagnetVal } = {};
    for (const [k, v] of pairs) obj[k] = decodeState(v);
    return obj;
  }
  if (tag === "_Map") {
    const pairs = payload as [string, MagnetVal][];
    const obj: { [k: string]: MagnetVal } = {};
    for (const [k, v] of pairs) obj[k] = decodeState(v);
    return obj;
  }
  if (tag === "_a" || tag === "_Set") {
    return (payload as MagnetVal[]).map(decodeState);
  }
  if (tag === "_u") return null;
  // Not a tag — regular array, decode elements
  return (val as MagnetVal[]).map(decodeState);
}

/** String leaf values are JSON-encoded strings: '"Amsterdam"' → 'Amsterdam'. */
function unquote(s: MagnetVal): string | null {
  if (typeof s !== "string") return null;
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    try {
      return JSON.parse(s) as string;
    } catch {
      return s;
    }
  }
  return s;
}

/** Find the bracket-balanced JSON blob for window.__PRELOAD_STATE__. */
function extractPreloadStateJson(html: string): string | null {
  const marker = "window.__PRELOAD_STATE__ = ";
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const raw = html.slice(start + marker.length);

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return raw.slice(0, i + 1);
    }
  }
  return null;
}

type EntityRecord = Record<string, MagnetVal>;
type EntityMap = Record<string, EntityRecord>;

/** Strip HTML tags for plain-text job descriptions. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseMagnetmeSearch(html: string): RawJob[] {
  if (!html) return [];

  const jsonBlob = extractPreloadStateJson(html);
  if (!jsonBlob) return [];

  let parsed: MagnetVal;
  try {
    parsed = JSON.parse(jsonBlob) as MagnetVal;
  } catch {
    return [];
  }

  const decoded = decodeState(parsed);
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) return [];
  const top = decoded as EntityRecord;

  const entities = top["entities"];
  if (typeof entities !== "object" || entities === null || Array.isArray(entities)) return [];
  const ent = entities as EntityRecord;

  // Entity maps: keys are quoted strings e.g. '"12345"', values are entity objects.
  const oppsRaw = ent["opportunities"];
  const companiesRaw = ent["companies"];
  const locationsRaw = ent["locations"];

  if (typeof oppsRaw !== "object" || oppsRaw === null || Array.isArray(oppsRaw)) return [];

  const opps = oppsRaw as EntityMap;
  const companies: EntityMap =
    typeof companiesRaw === "object" && companiesRaw !== null && !Array.isArray(companiesRaw)
      ? (companiesRaw as EntityMap)
      : {};
  const locations: EntityMap =
    typeof locationsRaw === "object" && locationsRaw !== null && !Array.isArray(locationsRaw)
      ? (locationsRaw as EntityMap)
      : {};

  // Build lookup maps by numeric id for O(1) join
  const companyById = new Map<number, EntityRecord>();
  for (const c of Object.values(companies)) {
    const id = (c as EntityRecord)["id"];
    if (typeof id === "number") companyById.set(id, c as EntityRecord);
  }

  const locationById = new Map<number, EntityRecord>();
  for (const l of Object.values(locations)) {
    const id = (l as EntityRecord)["id"];
    if (typeof id === "number") locationById.set(id, l as EntityRecord);
  }

  const out: RawJob[] = [];

  for (const opp of Object.values(opps)) {
    const o = opp as EntityRecord;

    const id = o["id"];
    if (typeof id !== "number") continue;

    const title = unquote(o["name"]);
    if (!title) continue;

    // Build canonical URL: /en/opportunities/{id}
    const slug = unquote(o["slug"]);
    const sourceUrl = slug
      ? `${BASE}/en/opportunities/${slug}`
      : `${BASE}/en/opportunities/${id}`;

    // Company name via join
    const companyIdVal = o["company"];
    let companyName: string | null = null;
    if (typeof companyIdVal === "number") {
      const company = companyById.get(companyIdVal);
      if (company) companyName = unquote(company["name"]);
    }

    // Location via join
    const geoIdVal = o["geolocation"];
    let location: string | null = null;
    if (typeof geoIdVal === "number") {
      const loc = locationById.get(geoIdVal);
      if (loc) {
        const city = unquote(loc["city"]);
        const countryCode = unquote(loc["countryCode"]);
        location = [city, countryCode].filter(Boolean).join(", ") || null;
      }
    } else if (typeof geoIdVal === "object" && geoIdVal !== null && !Array.isArray(geoIdVal)) {
      // Inline geolocation object
      const geo = geoIdVal as EntityRecord;
      const city = unquote(geo["city"]);
      const countryCode = unquote(geo["countryCode"]);
      location = [city, countryCode].filter(Boolean).join(", ") || null;
    }

    // Description
    const descHtml = unquote(o["descriptionHtml"]);
    const descPreview = unquote(o["descriptionPreview"]);
    const jdText = descHtml ? stripHtml(descHtml) : (descPreview ?? "");

    // Posted date (virtualPostDate is the display date, created is when it was first stored)
    const posted = unquote(o["virtualPostDate"]) ?? unquote(o["created"]) ?? unquote(o["createdAt"]);
    const postedAt = posted ? new Date(posted) : null;

    out.push({
      source: "magnetme",
      sourceExternalId: String(id),
      sourceUrl,
      title,
      jdText,
      companyName,
      companyDomain: null,
      location,
      postedAt,
    });
  }

  return out;
}

export class MagnetmeSource implements JobSource {
  readonly name = "magnetme";

  async fetch(): Promise<RawJob[]> {
    const out: RawJob[] = [];
    const seen = new Set<string>();

    for (const kw of SEARCH_KEYWORDS) {
      const url = `${BASE}/en/opportunities?query=${encodeURIComponent(kw)}`;
      let res: Response;
      try {
        res = await fetch(url, {
          headers: {
            "user-agent": UA,
            accept: "text/html,application/xhtml+xml",
            "accept-language": "en-US,en;q=0.9,nl;q=0.8",
          },
        });
      } catch (err) {
        console.warn(`[magnetme] network error on "${kw}":`, err);
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        console.warn(`[magnetme] ${res.status} on "${kw}": ${body.slice(0, 200)}`);
        continue;
      }

      const html = await res.text();
      for (const j of parseMagnetmeSearch(html)) {
        if (seen.has(j.sourceExternalId)) continue;
        seen.add(j.sourceExternalId);
        out.push(j);
      }

      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    return out;
  }
}
