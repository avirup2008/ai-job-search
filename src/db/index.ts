import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schemaExports from "./schema";

type DB = NeonHttpDatabase<typeof schemaExports>;

let _db: DB | null = null;

function getDb(): DB {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url || url.length === 0) {
    throw new Error(
      "DATABASE_URL is not set. Set it in .env.local (pull with `vercel env pull`) " +
      "or export it before running tasks that touch the database.",
    );
  }
  const sql = neon(url);
  _db = drizzle(sql, { schema: schemaExports });
  return _db;
}

// Proxy that lazily materializes the drizzle client on first method call.
export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const actual = getDb();
    const value = Reflect.get(actual, prop, actual);
    return typeof value === "function" ? value.bind(actual) : value;
  },
}) as DB;

export const schema = schemaExports;
