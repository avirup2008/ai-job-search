/**
 * Shared auth constants for Disha session management.
 * Single source of truth for cookie name and session token derivation.
 */

export const COOKIE_NAME = "disha_session" as const;

/**
 * Compute the session token value (sha256 hex of the password).
 * Uses node:crypto — call only from Node.js runtime contexts (API routes, page.tsx).
 * For Edge runtime (middleware.ts) use the inline Web Crypto implementation.
 */
import crypto from "node:crypto";
export function computeSessionToken(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}
