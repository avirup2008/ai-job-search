"use server";
import { cookies } from "next/headers";

export async function updateLastVisit(): Promise<void> {
  const store = await cookies();
  store.set("disha_last_visit", new Date().toISOString(), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: false, // readable client-side is fine
    sameSite: "lax",
  });
}
