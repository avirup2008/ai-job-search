import { NextResponse } from "next/server";

// Deprecated — replaced by /api/auth/login (disha_session cookie auth).
export async function POST() {
  return NextResponse.json({ error: "deprecated" }, { status: 410 });
}
