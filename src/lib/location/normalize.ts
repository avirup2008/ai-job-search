/**
 * Location normalization for display + grouping.
 *
 * Discovery sources write location strings in wildly different shapes:
 *   Jooble:    "Netherlands"
 *   MagnetMe:  "Amsterdam, NL"
 *   NVB:       "Amsterdam" or "Noord-Holland, Amsterdam"
 *   Adzuna:    "North Holland"
 *
 * Without normalization the analytics page shows "Netherlands" and
 * "Nederland" as separate bars, and "Amsterdam" appears split across
 * "Amsterdam", "Amsterdam, NL", "Amsterdam, Netherlands" etc.
 *
 * Rules:
 *   - Country-only values (any of: netherlands, nederland, the netherlands, nl)
 *     collapse to the canonical "Netherlands".
 *   - "City, CountrySuffix" strips the trailing country suffix where the
 *     suffix matches NL/Netherlands/Nederland — so "Amsterdam, NL" becomes
 *     "Amsterdam" and merges with plain "Amsterdam".
 *   - Everything else is trimmed only; we preserve the source's casing to
 *     avoid accidentally mangling non-Dutch locations.
 *   - null/empty → null (caller decides how to handle)
 */

const NL_COUNTRY_FORMS = new Set(["netherlands", "nederland", "the netherlands", "nl"]);
const NL_COUNTRY_SUFFIXES = new Set(["nl", "netherlands", "nederland", "the netherlands"]);

export function normalizeLocation(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // Country-only
  if (NL_COUNTRY_FORMS.has(trimmed.toLowerCase())) {
    return "Netherlands";
  }

  // "City, CountrySuffix" — strip a known NL suffix, return city alone.
  // Only strip the LAST comma-separated segment so "Noord-Holland, Amsterdam"
  // (region, city) is preserved as-is.
  const commaIdx = trimmed.lastIndexOf(",");
  if (commaIdx !== -1) {
    const head = trimmed.slice(0, commaIdx).trim();
    const tail = trimmed.slice(commaIdx + 1).trim();
    if (head !== "" && NL_COUNTRY_SUFFIXES.has(tail.toLowerCase())) {
      return head;
    }
  }

  return trimmed;
}

/**
 * Re-aggregate a list of {location, count} rows by normalized key.
 * The SQL GROUP BY runs on the raw column; this merges the result set.
 */
export function aggregateByNormalizedLocation<T extends { location: string | null; count: number }>(
  rows: T[],
): { location: string; count: number }[] {
  const bucket = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeLocation(row.location);
    if (key === null) continue;
    bucket.set(key, (bucket.get(key) ?? 0) + row.count);
  }
  return Array.from(bucket.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count);
}
