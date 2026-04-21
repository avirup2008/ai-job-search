import { createHash } from "node:crypto";

/**
 * Derives the session token from DISHA_PASSWORD + SESSION_NONCE.
 *
 * SESSION_NONCE is an optional env var. Rotate it in Vercel env vars and
 * redeploy to invalidate all active sessions without changing the password.
 * If SESSION_NONCE is not set, falls back to empty string (backward-compatible).
 *
 * NODE.JS ONLY — uses node:crypto. Do not import in Edge runtime (middleware.ts).
 */
export function computeSessionToken(password: string): string {
  const nonce = process.env.SESSION_NONCE ?? "";
  return createHash("sha256").update(password + nonce).digest("hex");
}
