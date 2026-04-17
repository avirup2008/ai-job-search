import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/constants";

export async function POST(request: NextRequest) {
  const redirectUrl = new URL("/", request.url);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
