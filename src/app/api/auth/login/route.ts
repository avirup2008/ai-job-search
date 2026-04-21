import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/constants";
import { computeSessionToken } from "@/lib/auth/session-token";
import { checkRateLimit } from "@/lib/auth/rate-limit";


export async function POST(request: Request) {
  // Rate limiting — 10 attempts per IP per 15 minutes
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    const retryAfterSec = Math.ceil(rateLimit.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      },
    );
  }

  const pw = process.env.DISHA_PASSWORD;
  if (!pw) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 503 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const expectedHash = computeSessionToken(pw);
  const submittedHash = computeSessionToken(body.password ?? "");

  const match = crypto.timingSafeEqual(
    Buffer.from(expectedHash),
    Buffer.from(submittedHash),
  );

  if (!match) {
    return NextResponse.json({ error: "incorrect password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, expectedHash, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
