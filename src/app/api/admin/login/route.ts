import { NextResponse } from "next/server";
import { setAdminCookie } from "@/lib/auth/admin";

export async function POST(req: Request) {
  const { secret } = (await req.json()) as { secret?: string };
  if (!secret) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await setAdminCookie(secret);
  return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
}
