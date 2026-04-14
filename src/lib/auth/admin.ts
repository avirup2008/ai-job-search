import { cookies } from "next/headers";
import { loadAdminEnv } from "@/lib/env";

const COOKIE = "aijs_admin";

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value === loadAdminEnv().ADMIN_SECRET;
}

export async function setAdminCookie(secret: string): Promise<boolean> {
  if (secret !== loadAdminEnv().ADMIN_SECRET) return false;
  const jar = await cookies();
  jar.set(COOKIE, secret, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
