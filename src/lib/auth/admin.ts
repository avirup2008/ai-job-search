import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { COOKIE_NAME } from "@/lib/auth/constants";

/**
 * Server-side auth check for Server Actions and API routes.
 * Validates the disha_session cookie (sha256 of DISHA_PASSWORD).
 * Uses Node.js crypto — safe in serverless functions, not in Edge runtime.
 * Middleware (Edge) has its own equivalent using Web Crypto.
 */
export async function isAdmin(): Promise<boolean> {
  const pw = process.env.DISHA_PASSWORD;
  if (!pw) return false;

  const jar = await cookies();
  const cookieValue = jar.get(COOKIE_NAME)?.value;
  if (!cookieValue) return false;

  const expected = createHash("sha256").update(pw).digest("hex");
  return cookieValue === expected;
}
