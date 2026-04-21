import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/constants";

/**
 * Edge middleware — gates (app) route group pages and LLM generation APIs.
 *
 * Uses disha_session cookie whose value is sha256(DISHA_PASSWORD) in hex.
 * Web Crypto (crypto.subtle) is used here because the Edge runtime does not
 * have access to Node's crypto module.
 *
 * Paths NOT matched by config.matcher are never processed here:
 *   - /                (login page — public)
 *   - /api/auth/*      (login/logout — public)
 *   - /api/cron/*      (Bearer-token auth, not cookie)
 *   - /p/:slug*        (public artifact viewer)
 *   - /api/health      (public)
 *   - Everything else
 */
async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const pw = process.env.DISHA_PASSWORD;
  if (!pw) return false;

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookieValue) return false;

  // Edge runtime — uses Web Crypto; see src/lib/auth/session-token.ts for Node runtime equivalent.
  // SESSION_NONCE is appended so rotating it in Vercel env vars invalidates all active sessions.
  const nonce = process.env.SESSION_NONCE ?? "";
  const encoded = new TextEncoder().encode(pw + nonce);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const expectedHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return cookieValue === expectedHex;
}

export async function middleware(request: NextRequest) {
  const authenticated = await isAuthenticated(request);

  if (authenticated) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");

  if (isApiRoute) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Page route — redirect to login page.
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/inbox/:path*",
    "/pipeline/:path*",
    "/analytics/:path*",
    "/profile/:path*",
    "/paste/:path*",
    "/gap-coach/:path*",
    "/api/generate/:path*",
    "/api/download-pack/:path*",
    "/api/paste-role",
    "/api/admin/:path*",
    "/api/linkedin/:path*",
    "/budget/:path*",
  ],
};
