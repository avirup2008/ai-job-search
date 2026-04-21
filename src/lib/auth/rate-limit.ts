/**
 * In-memory rate limiter for the login endpoint.
 *
 * Vercel serverless: state is per-instance (not distributed). This still
 * meaningfully throttles brute-force attempts on a single warm instance.
 * For stricter guarantees, replace with Upstash Redis INCR + EXPIRE.
 *
 * Limit: MAX_ATTEMPTS per WINDOW_MS per IP address.
 */

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

/** Periodically clean up expired entries to prevent memory growth. */
function sweep() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

/**
 * Record an attempt for the given IP.
 * Returns { allowed: true } if under limit, { allowed: false, retryAfterMs } if over.
 */
export function checkRateLimit(ip: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
  sweep();
  const now = Date.now();
  const existing = store.get(ip);

  if (!existing || existing.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  existing.count++;
  if (existing.count > MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: existing.resetAt - now };
  }

  return { allowed: true };
}
