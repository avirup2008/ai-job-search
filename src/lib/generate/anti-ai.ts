export interface Violation { pattern: string; sample: string }

export const FORBIDDEN_REGEX: Array<{ re: RegExp; label: string }> = [
  // Em-dash (any form)
  { re: /—/g, label: "em-dash (—)" },
  // "maps X to" variants: maps to, maps directly to, maps closely to, maps neatly to, maps cleanly to, mapped to
  { re: /\bmaps?\s+(\w+\s+)?to\b/gi, label: "maps [X] to (any variant)" },
  { re: /\bmapped\s+(\w+\s+)?to\b/gi, label: "mapped [X] to" },
  { re: /\bmapping\s+(\w+\s+)?to\b/gi, label: "mapping [X] to" },
  // Negative parallelisms
  { re: /\bnot\s+just\b/gi, label: "not just" },
  { re: /\bnot\s+only\b/gi, label: "not only" },
  { re: /\bnot\s+merely\b/gi, label: "not merely" },
  { re: /\bmore\s+than\s+just\b/gi, label: "more than just" },
  { re: /\brather\s+than\s+\w+ing\b/gi, label: "rather than X-ing" },
];

export const FORBIDDEN_SUBSTRINGS: string[] = [
  "at the intersection of",
  "sits at the heart of",
  "in the heart of",
  "stands as",
  "serves as",
  "delve",
  "pivotal",
  "crucial",
  "seamless",
  "seamlessly",
  "tapestry",
  "intricate",
  "enduring",
  "vibrant",
  "robust",
  "robustly",
  "leverage",
  "leveraging",
  "foster",
  "fostering",
  "transformative",
  "ever-evolving",
  "paving the way",
  "shaping the future",
  "ultimately",
  "in today's",
  "additionally",
  "moreover",
  "furthermore",
  "it is worth noting",
  "it's worth noting",
  "it is important to note",
  "underscore",
  "underscores",
  "mirrors",
  "mirroring",
  "translates to",
  "speaks to",
  "ties into",
  // Humanizer additions
  "vital",
  "comprehensive",
  "holistic",
  "facilitate",
  "facilitating",
  "ensure",
  "ensures",
  "it goes without saying",
  "needless to say",
  "in many cases",
  "in most scenarios",
  "one might argue",
];

export function findViolations(text: string): Violation[] {
  const hits: Violation[] = [];
  // Regex-based patterns first (catches variants like "maps closely to")
  for (const { re, label } of FORBIDDEN_REGEX) {
    re.lastIndex = 0;
    const match = re.exec(text);
    if (!match) continue;
    const idx = match.index;
    const start = Math.max(0, idx - 25);
    const end = Math.min(text.length, idx + match[0].length + 35);
    hits.push({ pattern: label, sample: text.slice(start, end).replace(/\s+/g, " ").trim() });
  }
  // Literal substring patterns
  const lower = text.toLowerCase();
  for (const needle of FORBIDDEN_SUBSTRINGS) {
    const idx = lower.indexOf(needle.toLowerCase());
    if (idx === -1) continue;
    const start = Math.max(0, idx - 25);
    const end = Math.min(text.length, idx + needle.length + 35);
    hits.push({ pattern: needle, sample: text.slice(start, end).replace(/\s+/g, " ").trim() });
  }
  return hits;
}

/**
 * Mechanical cleanup for tells that are purely cosmetic.
 * Applied after the retry loop exhausts as a last-resort sanitiser.
 * Only fixes the tells that can be safely regex-replaced without changing meaning.
 */
export function sanitizeMechanicalTells(text: string): string {
  return text
    // em-dash → ", " (most natural replacement in prose)
    .replace(/\s*—\s*/g, ", ")
    // en-dash between words → "-" (between numbers it stays, but this pattern needs letters on both sides)
    .replace(/(\w)\s*–\s*(\w)/g, "$1-$2");
}

/**
 * Deep-walks an object/array/string tree and runs `fn` on every string leaf.
 * Used to sanitise structured LLM output after the retry loop.
 */
export function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === "string") return fn(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, fn);
    return out as unknown as T;
  }
  return value;
}

export function formatViolationsForRetry(violations: Violation[]): string {
  return [
    "",
    "===RETRY FEEDBACK — rewrite without these banned patterns===",
    ...violations.map((v) => `  • "${v.pattern}" found in: "${v.sample}"`),
    "Produce the same content with ZERO banned tokens.",
    "===END RETRY FEEDBACK===",
    "",
  ].join("\n");
}
