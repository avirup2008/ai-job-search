import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const redirectUrl = new URL("/", request.url);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set("disha_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
