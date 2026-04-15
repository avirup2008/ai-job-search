/**
 * Live-test Plan 8.4: pick Takeaway job, run two-stage Screening Q&A,
 * save markdown + print picker + costs + AI-tell audit.
 */
import { db, schema } from "@/db";
import { eq, ilike } from "drizzle-orm";
import { generateScreeningQA, pickScreeningQuestions } from "@/lib/generate/screening-qa";
import { findViolations } from "@/lib/generate/anti-ai";
import { writeFileSync, mkdirSync } from "node:fs";

async function main() {
  const [company] = await db.select().from(schema.companies).where(ilike(schema.companies.name, "%takeaway%")).limit(1);
  if (!company) throw new Error("Takeaway not found");
  const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.companyId, company.id)).limit(1);
  if (!job) throw new Error("no Takeaway job");
  console.log("[screening-qa] job:", { id: job.id, title: job.title, tier: job.tier });

  const picker = await pickScreeningQuestions({ jobId: job.id });
  console.log("[screening-qa] picker:", picker);

  const res = await generateScreeningQA(job.id);
  mkdirSync(".tmp", { recursive: true });
  writeFileSync(".tmp/screening-qa.md", res.markdown);
  console.log(`[screening-qa] answers: ${res.qa.questions.length}, attempts=${res.attempts}, cost=€${res.costEur.toFixed(4)}`);

  // AI-tell audit on the full markdown
  const tells = findViolations(res.markdown);
  console.log(`[screening-qa] tells: ${tells.length === 0 ? "CLEAN ✅" : tells.map((t) => t.pattern).join(", ")}`);

  // Print compact summary
  console.log("\n=== OPENING ===");
  console.log(res.qa.openingLine);
  console.log("\n=== Q&A ===");
  for (const q of res.qa.questions) {
    const badge = q.confidence === "high" ? "🟢" : q.confidence === "medium" ? "🟡" : "🔴";
    console.log(`\n${badge} [${q.id}] ${q.question}\n→ ${q.answer}`);
  }
  console.log("\n=== CLOSING QUESTION ===");
  console.log(res.qa.closingQuestion);
}

main().catch((e) => { console.error(e); process.exit(1); });
