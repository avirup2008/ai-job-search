import { db, schema } from "@/db";
import { OptimizerPanel } from "@/components/linkedin/OptimizerPanel";
import type { LinkedinRewrites } from "@/db/schema";

export const dynamic = "force-dynamic";

async function loadOptimization() {
  const [row] = await db
    .select()
    .from(schema.linkedinOptimizations)
    .limit(1);
  return row ?? null;
}

export default async function LinkedinPage() {
  const row = await loadOptimization();

  const initial = row
    ? {
        rewrites: row.rewrites as LinkedinRewrites,
        createdAt: row.createdAt.toISOString(),
      }
    : null;

  return (
    <OptimizerPanel initial={initial} />
  );
}
