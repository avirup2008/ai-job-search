import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { COOKIE_NAME, computeSessionToken } from "@/lib/auth/constants";

export async function POST(request: Request) {
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
