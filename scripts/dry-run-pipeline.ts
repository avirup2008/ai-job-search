/**
 * End-to-end dry run: discover → dedupe → filter → rank (live Haiku) → tier.
 * Does NOT write to DB. Prints a summary to stdout.
 * Expect ~€0.01–0.02 in Anthropic spend for 5 sample ranks.
 */
import { discover } from "@/lib/pipeline/discover";
import { clusterJobs } from "@/lib/pipeline/dedupe";
import { applyHardFilters } from "@/lib/pipeline/filters";
import { assessJob } from "@/lib/pipeline/rank";
import { assignTier } from "@/lib/pipeline/tier";
import { db, schema } from "@/db";
import type { Profile } from "@/lib/profile/types";

async function main() {
  console.log("[1/5] discover()");
  const disc = await discover();
  console.log(`    → ${disc.jobs.length} raw jobs across ${Object.keys(disc.perSource).length} sources in ${disc.elapsedMs}ms`);

  console.log("[2/5] dedupe / cluster");
  const clusters = clusterJobs(disc.jobs);
  const dupes = disc.jobs.length - clusters.length;
  console.log(`    → ${clusters.length} canonical jobs (${dupes} duplicates collapsed)`);

  console.log("[3/5] apply hard filters");
  const scored = clusters.map((c) => ({
    c,
    f: applyHardFilters({ title: c.canonical.title, jdText: c.canonical.jdText, seniority: null }),
  }));
  const passing = scored.filter((x) => x.f.filter === null);
  const blocked = scored.filter((x) => x.f.filter !== null);
  const byReason: Record<string, number> = {};
  for (const x of blocked) byReason[x.f.filter as string] = (byReason[x.f.filter as string] ?? 0) + 1;
  console.log(`    → ${passing.length} passing, ${blocked.length} blocked`);
  console.log("    → blocked breakdown:", byReason);

  console.log("[4/5] load profile from Neon");
  const [row] = await db.select().from(schema.profile).limit(1);
  if (!row) {
    console.error("No profile found — run scripts/seed-profile.ts first");
    process.exit(1);
  }
  const profile: Profile = {
    roles: row.roles as Profile["roles"],
    achievements: row.achievements as Profile["achievements"],
    toolStack: row.toolStack as Profile["toolStack"],
    industries: row.industries as Profile["industries"],
    stories: row.stories as Profile["stories"],
    constraints: row.constraints as Profile["constraints"],
    preferences: row.preferences as Profile["preferences"],
  };
  console.log(`    → profile loaded (${profile.roles.length} roles)`);

  console.log("[5/5] rank first 5 passing jobs with Haiku (LIVE ANTHROPIC CALLS)");
  const sample = passing.slice(0, 5);
  for (const x of sample) {
    const t0 = Date.now();
    try {
      const r = await assessJob({ jdText: x.c.canonical.jdText, jobTitle: x.c.canonical.title, profile });
      const tier = assignTier(r.fitScore);
      const a = r.assessment;
      const title = x.c.canonical.title.slice(0, 60);
      const co = x.c.canonical.companyName ?? "?";
      console.log(`    → [${Date.now() - t0}ms] T${tier ?? "-"} fit=${r.fitScore.toFixed(1)} ${a.recommendation} | ${title} @ ${co}`);
      if (a.strengths.length > 0) console.log(`        strengths: ${a.strengths.slice(0, 2).join("; ").slice(0, 120)}`);
      if (a.gaps.length > 0) console.log(`        gaps:      ${a.gaps.slice(0, 2).join("; ").slice(0, 120)}`);
    } catch (e) {
      console.log(`    → ERROR on ${x.c.canonical.title.slice(0, 60)}: ${String(e).slice(0, 120)}`);
    }
  }
  console.log("[DONE] Dry-run complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
