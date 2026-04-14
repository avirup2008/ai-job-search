import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { tryLoadEnv } from "@/lib/env";
import * as schemaExports from "./schema";

// Use tryLoadEnv so this module can be imported in contexts where DATABASE_URL
// is not yet set (e.g. drizzle-kit generate, type-checking, tests).
const env = tryLoadEnv();
const sql = neon(env?.DATABASE_URL ?? "");
export const db = drizzle(sql, { schema: schemaExports });
export const schema = schemaExports;
