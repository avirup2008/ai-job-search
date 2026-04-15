/**
 * Live-test Plan 8.3: pick a Takeaway job, generate both artifact types,
 * save HTML to disk, and report picker output + costs.
 */
import { db, schema } from "@/db";
import { and, eq, ilike } from "drizzle-orm";
import { pickArtifacts, generateArtifact } from "@/lib/generate/artifacts";
import { writeFileSync, mkdirSync } from "node:fs";

async function main() {
  const companyRows = await db
    .select()
    .from(schema.companies)
    .where(ilike(schema.companies.name, "%takeaway%"))
    .limit(5);
  console.log("[test-artifacts] candidate companies:", companyRows.map((c) => ({ id: c.id, name: c.name, domain: c.domain })));

  let job: typeof schema.jobs.$inferSelect | undefined;
  for (const c of companyRows) {
    const [j] = await db.select().from(schema.jobs).where(eq(schema.jobs.companyId, c.id)).limit(1);
    if (j) { job = j; break; }
  }
  if (!job) {
    console.log("[test-artifacts] no Takeaway job found; trying JustEat/JET...");
    for (const name of ["Just Eat", "JET", "thuisbezorgd"]) {
      const [c] = await db.select().from(schema.companies).where(ilike(schema.companies.name, `%${name}%`)).limit(1);
      if (c) {
        const [j] = await db.select().from(schema.jobs).where(eq(schema.jobs.companyId, c.id)).limit(1);
        if (j) { job = j; console.log(`[test-artifacts] matched "${name}" →`, c.name); break; }
      }
    }
  }
  if (!job) {
    console.log("[test-artifacts] falling back to any T1/T2 digital-marketing job");
    const [j] = await db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.tier, 1)))
      .limit(1);
    job = j;
  }
  if (!job) throw new Error("no job to test on");

  console.log("[test-artifacts] job:", { id: job.id, title: job.title, tier: job.tier });

  const picker = await pickArtifacts({ jobTitle: job.title, jdText: job.jdText ?? "" });
  console.log("[test-artifacts] picker result:", picker);

  mkdirSync(".tmp", { recursive: true });

  const primary = await generateArtifact(job.id, picker.primary);
  writeFileSync(`.tmp/artifact-${picker.primary}.html`, primary.html);
  console.log(`[test-artifacts] PRIMARY ${picker.primary} → attempts=${primary.attempts}, cost=€${primary.costEur.toFixed(4)}, bytes=${primary.html.length}`);

  if (picker.secondary) {
    const sec = await generateArtifact(job.id, picker.secondary);
    writeFileSync(`.tmp/artifact-${picker.secondary}.html`, sec.html);
    console.log(`[test-artifacts] SECONDARY ${picker.secondary} → attempts=${sec.attempts}, cost=€${sec.costEur.toFixed(4)}, bytes=${sec.html.length}`);
  }

  // Force-generate whichever type the router didn't pick, for completeness
  const ALL = ["thirty_sixty_ninety", "email_crm_teardown"] as const;
  for (const t of ALL) {
    if (t === picker.primary || t === picker.secondary) continue;
    const r = await generateArtifact(job.id, t);
    writeFileSync(`.tmp/artifact-${t}.html`, r.html);
    console.log(`[test-artifacts] FORCED ${t} → attempts=${r.attempts}, cost=€${r.costEur.toFixed(4)}, bytes=${r.html.length}`);
  }

  console.log("[test-artifacts] DONE — HTML files in .tmp/");
}

main().catch((e) => { console.error(e); process.exit(1); });
