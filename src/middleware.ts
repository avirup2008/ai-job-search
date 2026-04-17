import { type NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "aijs_admin";
const LOGIN_PATH = "/admin/login";

/**
 * Edge middleware — gates (app) route group pages and LLM generation APIs.
 *
 * Cookie name and comparison pattern are identical to src/lib/auth/admin.ts
 * but re-implemented here because next/headers is not available on the Edge
 * runtime.
 *
 * Paths NOT matched by config.matcher are never processed here:
 *   - /p/:slug*  (public artifact viewer)
 *   - /admin/*   (has its own layout-level isAdmin() gate)
 *   - /api/cron/* (Bearer-token auth, not cookie)
 *   - Everything else
 */
export function middleware(request: NextRequest) {
  const secret = process.env.ADMIN_SECRET;

  // Fail closed if env var is absent at edge time.
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const authenticated = secret !== undefined && cookieValue === secret;

  if (authenticated) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");

  if (isApiRoute) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Page route — redirect to login, preserving the intended destination.
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = LOGIN_PATH;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/inbox/:path*",
    "/pipeline/:path*",
    "/analytics/:path*",
    "/paste/:path*",
    "/api/generate/:path*",
    "/api/download-pack/:path*",
  ],
};
