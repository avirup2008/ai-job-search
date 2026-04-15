import raw from "../../../data/commute-times.json" with { type: "json" };

type CommuteEntry = { car_min: number; transit_min: number };
const CITIES = raw.cities as Record<string, CommuteEntry>;

export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";
export type CommuteVerdict =
  | { commutable: true; reason?: undefined }
  | { commutable: false; reason: "location_unknown" | "too_far_onsite" | "too_far_hybrid" };

const REMOTE_PATTERNS: RegExp[] = [
  /\bfully\s+remote\b/i,
  /\bremote\s+only\b/i,
  /\bremote[-\s]first\b/i,
  /\b100%\s+remote\b/i,
  /\bwork\s+from\s+anywhere\b/i,
  /\banywhere\s+in\s+(europe|eu)\b/i,
];

const HYBRID_PATTERNS: RegExp[] = [
  /\bhybrid\b/i,
  /\b\d+\s+days?\s+(in|at)\s+(the\s+)?office\b/i,
  /\boffice\s+\d+\s+days?\s+(a|per)\s+week\b/i,
  /\bflexible\s+(work|office)\b/i,
];

export function detectWorkMode(jdText: string): WorkMode {
  if (REMOTE_PATTERNS.some((re) => re.test(jdText))) return "remote";
  if (HYBRID_PATTERNS.some((re) => re.test(jdText))) return "hybrid";
  return "onsite";
}

/**
 * Normalize a location string to a city key we can look up in the commute table.
 * Tries progressively more aggressive extraction — first-token, then multi-token cities.
 */
export function locationToCity(location: string | null | undefined): string | null {
  if (!location) return null;
  // Lowercase, strip accents, replace separators with space
  const norm = location
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  // Multi-token cities first (most specific)
  const multiToken = [
    "amsterdam-zuidoost",
    "amsterdam-zuid",
    "amsterdam-noord",
    "amsterdam-west",
    "amsterdam-oost",
    "den haag",
    "the hague",
    "s-gravenhage",
    "s-hertogenbosch",
    "den bosch",
    "wijk bij duurstede",
  ];
  for (const c of multiToken) {
    if (norm.includes(c.replace("-", " ")) || norm.includes(c)) return c;
  }
  // Single-token cities (match any word in the location against our known cities)
  const tokens = norm.split(/[\s,]+/).filter((t) => t.length >= 3);
  for (const t of tokens) {
    if (t in CITIES) return t;
  }
  return null;
}

/**
 * Reject if BOTH car AND transit exceed the threshold. Pass if EITHER is within.
 */
export function checkCommute(location: string | null | undefined, workMode: WorkMode): CommuteVerdict {
  if (workMode === "remote") return { commutable: true };
  const city = locationToCity(location);
  if (!city) return { commutable: false, reason: "location_unknown" };
  const entry = CITIES[city];
  if (!entry) return { commutable: false, reason: "location_unknown" };

  const carLimit = workMode === "hybrid" ? 60 : 30;
  const transitLimit = workMode === "hybrid" ? 90 : 60;
  const carOk = entry.car_min <= carLimit;
  const transitOk = entry.transit_min <= transitLimit;

  if (carOk || transitOk) return { commutable: true };
  return { commutable: false, reason: workMode === "hybrid" ? "too_far_hybrid" : "too_far_onsite" };
}
