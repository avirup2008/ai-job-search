/**
 * Live-test Plan 8.2: generate CV for the Takeaway role, render DOCX,
 * write to .tmp/ and audit narrative text for AI tells.
 */
import { db, schema } from "@/db";
import { eq, ilike } from "drizzle-orm";
import { generateCV } from "@/lib/generate/cv";
import { renderCvDocx } from "@/lib/generate/cv-docx";
import { cvNarrativeText } from "@/lib/generate/cv-types";
import { findViolations } from "@/lib/generate/anti-ai";
import { writeFileSync, mkdirSync } from "node:fs";

async function main() {
  const [company] = await db.select().from(schema.companies).where(ilike(schema.companies.name, "%takeaway%")).limit(1);
  if (!company) throw new Error("Takeaway not found");
  const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.companyId, company.id)).limit(1);
  if (!job) throw new Error("no Takeaway job");
  console.log("[cv] job:", { id: job.id, title: job.title });

  const gen = await generateCV(job.id);
  console.log(`[cv] attempts=${gen.attempts}, cost=€${gen.costEur.toFixed(4)}, tokens=${JSON.stringify(gen.tokens)}`);

  const narrative = cvNarrativeText(gen.cv);
  const tells = findViolations(narrative);
  console.log(`[cv] tells: ${tells.length === 0 ? "CLEAN ✅" : tells.map((t) => t.pattern).join(", ")}`);

  mkdirSync(".tmp", { recursive: true });
  const buf = await renderCvDocx(gen.cv);
  writeFileSync(".tmp/cv.docx", buf);
  console.log(`[cv] DOCX: .tmp/cv.docx (${buf.length} bytes)`);

  console.log(`\n=== HEADLINE ===\n${gen.cv.headline}`);
  console.log(`\n=== SUMMARY ===\n${gen.cv.summary}`);
  console.log(`\n=== FIRST ROLE BULLETS ===`);
  for (const b of gen.cv.experience[0]?.bullets ?? []) console.log(`• ${b}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
