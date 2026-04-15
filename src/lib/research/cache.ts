import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import type { Dossier } from "./types";

const TTL_DAYS = 90;

function scopeKey(companyName: string): string {
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `company:${slug}:v1`;
}

export async function readCached(companyName: string): Promise<Dossier | null> {
  const key = scopeKey(companyName);
  const rows = await db
    .select()
    .from(schema.researchCache)
    .where(eq(schema.researchCache.scopeKey, key))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;
  return row.content as Dossier;
}

export async function writeCached(companyName: string, dossier: Dossier): Promise<void> {
  const key = scopeKey(companyName);
  const expires = new Date(Date.now() + TTL_DAYS * 24 * 3600 * 1000);
  await db
    .insert(schema.researchCache)
    .values({ scopeKey: key, content: dossier as unknown as object, expiresAt: expires })
    .onConflictDoUpdate({
      target: schema.researchCache.scopeKey,
      set: {
        content: dossier as unknown as object,
        expiresAt: expires,
      },
    });
}
