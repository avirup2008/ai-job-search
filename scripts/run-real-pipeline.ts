/**
 * One-shot REAL run of runNightly() against all 4 live sources + real profile.
 * Writes to the production Neon DB. Idempotent — safe to re-run.
 * Expected spend: ~€0.70–1.00 Anthropic (within €20 cap).
 * Expected duration: ~4 min (with p-limit(10) on rank calls).
 */
import { runNightly } from "@/lib/pipeline/orchestrator";

async function main() {
  console.log("[run-real-pipeline] starting…");
  const t0 = Date.now();
  try {
    const summary = await runNightly();
    const mins = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`[run-real-pipeline] DONE in ${mins} min`);
    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    const mins = ((Date.now() - t0) / 60000).toFixed(1);
    console.error(`[run-real-pipeline] FAILED after ${mins} min`);
    console.error(e);
    process.exit(1);
  }
}

main();
