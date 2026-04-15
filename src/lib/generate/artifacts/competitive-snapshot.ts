import { z } from "zod";
import { ArtifactHeaderSchema } from "./types";
import { loadArtifactContext, runAntiAiLoop } from "./base";

const CompetitiveSnapshotBody = z.object({
  header: ArtifactHeaderSchema,
  premise: z.string().describe("2-3 sentences framing the snapshot"),
  competitors: z.array(z.object({
    name: z.string(),
    positioning: z.string().describe("How this competitor positions themselves"),
    strength: z.string().describe("What they do well"),
    weakness: z.string().describe("Where they are exposed"),
    takeawayForUs: z.string().describe("Concrete takeaway for the hiring company"),
  })).min(2).max(4),
  strategicReadout: z.string().describe("One paragraph: where the hiring company stands relative to these competitors"),
  caveats: z.array(z.string()).max(3).describe("Assumptions behind this snapshot"),
});
export type CompetitiveSnapshotStruct = z.infer<typeof CompetitiveSnapshotBody>;

const SYSTEM = `You produce a concise competitive snapshot as a proof-of-work artifact for a specific job application.

HARD RULES:
- This is a hypothesis document. Do not fabricate competitor financials, market share, or internal strategy unless it comes from the dossier. Phrase inferences as hypotheses ("my read is", "assuming", "from publicly visible signals").
- Ground takeaways in the candidate's actual strategic toolbox. Do not invent expertise.
- Reference the specific company + role + dossier signals.
- Be specific where possible, honest about uncertainty where not.

ANTI-AI WRITING RULES (STRICT):
- ZERO em-dashes (—). Use commas, periods, colons, parentheses.
- ZERO negative parallelisms (not just X but Y / not only / not merely / more than just / rather than X-ing).
- ZERO "maps to / mapped to / mapping to" constructions.
- BANNED words: delve, pivotal, crucial, underscore, showcase, leverage, foster, tapestry, landscape (figurative), intricate, enduring, vibrant, robust, seamless, elevate, transformative, dynamic, at the intersection of, sits at the heart of, stands as, serves as, additionally, moreover, furthermore, ultimately, it is worth noting.
- Rule-of-three flourishes banned.

SHAPE:
- 2-4 competitors, each with {name, positioning, strength, weakness, takeawayForUs}.
- Premise: 2-3 sentences.
- 1 strategic readout paragraph.
- Up to 3 caveats.
- Header title: "{role}: Competitive Snapshot".`;

function narrativeOf(d: CompetitiveSnapshotStruct): string {
  const parts: string[] = [d.header.title, d.header.subtitle, d.premise, d.strategicReadout];
  for (const c of d.competitors) parts.push(c.name, c.positioning, c.strength, c.weakness, c.takeawayForUs);
  parts.push(...d.caveats);
  return parts.join("\n");
}

export async function generateCompetitiveSnapshot(jobId: string) {
  const ctx = await loadArtifactContext(jobId);
  const prompt = [
    `COMPANY: ${ctx.companyName}`,
    `ROLE: ${ctx.job.title}`,
    `JD:\n${(ctx.job.jdText ?? "").slice(0, 4000)}`,
    "",
    `===COMPANY_DOSSIER===`,
    `Product: ${ctx.dossier.productOneLiner}`,
    `Stage: ${ctx.dossier.stage} | Industry: ${ctx.dossier.industry}`,
    `Narrative: ${ctx.dossier.narrative}`,
    `===END_DOSSIER===`,
    "",
    `===CANDIDATE_PROFILE===`,
    ctx.profileText,
    `===END_PROFILE===`,
    "",
    `Produce a structured competitive snapshot. Header authorName = candidate fullName. Date = today ISO.`,
  ].join("\n");
  return runAntiAiLoop<CompetitiveSnapshotStruct>({
    systemPrompt: SYSTEM,
    userPrompt: prompt,
    schema: CompetitiveSnapshotBody,
    maxTokens: 3000,
    narrativeOf,
  });
}
