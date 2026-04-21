/**
 * Shared SSRF-prevention helpers for server-side URL fetching.
 * Both /api/paste-role and /api/queue-url must call isBlockedHost()
 * before fetching any user-supplied URL.
 */

/**
 * Returns true for localhost, loopback, RFC-1918 ranges, link-local,
 * and .local/.internal hostnames — any of which could be an SSRF target.
 */
export function isBlockedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
    if (host.endsWith(".local") || host.endsWith(".internal")) return true;
    // RFC-1918 + APIPA
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^169\.254\./.test(host)) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
    return false;
  } catch {
    return true; // unparseable URL → block
  }
}

/**
 * Validates that a URL is safe to fetch server-side:
 * - Must start with https:// (http:// rejected — plaintext + potentially internal)
 * - Host must not be blocked
 * Returns an error string if invalid, null if OK.
 */
export function validateFetchUrl(url: string): string | null {
  if (!url.startsWith("https://")) {
    return "Only https:// URLs are supported";
  }
  if (isBlockedHost(url)) {
    return "URL host is not allowed";
  }
  return null;
}
