import { z } from "zod";
import { loadArtifactContext, runAntiAiLoop } from "./artifacts/base";

// -------------------- Zod schema --------------------

const RoundSection = z.object({
  overview: z.string().describe("1-2 sentence overview of what to expect in this round"),
  likelyQuestions: z
    .array(
      z.object({
        question: z.string().describe("The interviewer-facing question"),
        talkingPoints: z.array(z.string()).min(2).max(5).describe("2-5 concrete talking points, grounded in candidate profile"),
      }),
    )
    .min(2)
    .max(6),
});

const MiniCase = z.object({
  scenario: z.string().describe("A realistic case scenario referencing the company's actual product, stage, and market position — no generic placeholders"),
  suggested30DayPlan: z.array(z.string()).min(3).max(6).describe("3-6 concrete steps for the first 30 days"),
});

const InterviewPrepSchema = z.object({
  phoneScreen: RoundSection.describe("Round 1: phone screen / recruiter chat"),
  hiringManager: RoundSection.describe("Round 2: hiring manager deep-dive"),
  caseRound: RoundSection.extend({
    miniCase: MiniCase.describe("Mini-case tied to THIS company's product, narrative, and marketing stack"),
  }).describe("Round 3: marketing case or technical round"),
  cultureFit: RoundSection.describe("Round 4: culture-fit / values round"),
  questionsToAskThem: z
    .array(z.string())
    .min(5)
    .max(7)
    .describe("5-7 thoughtful questions the candidate should ask across rounds"),
});

export type InterviewPrepStruct = z.infer<typeof InterviewPrepSchema>;

// -------------------- System prompt --------------------

const SYSTEM_PROMPT = `You write interview preparation notes a real candidate will use to rehearse. First-person where answers appear, strategic and concrete elsewhere.

======= CONTENT HARD RULES =======
- Never invent experience, metrics, tools, companies, or relationships not present in the profile.
- Never claim prior contact with the company.
- Output English only, even if the JD is partly in another language.
- Reference the specific company by name and the role by title — no generic placeholders.
- Cite concrete achievements from the profile with their real metrics when they fit a question.
- Section 3 (marketing case / technical round): the miniCase MUST reference the actual product, stage, funding position, and recent moves from the dossier. Generic scenarios like "a SaaS company" are a failure.
- Section 4 (culture-fit): use profile.achievements and profile.stories to ground STAR-scaffold answers — always anchor to real profile content.

======= ANTI-AI WRITING RULES =======
Your output will be compared against known LLM tells. You must avoid them.

BANNED WORDS AND PHRASES (do not use any of these, even once):
- delve, crucial, pivotal, underscore, underscores, highlight (as verb), showcase (as verb), leverage (as verb), foster, fostering, garner, resonate, resonates, align with, alignment, tapestry, landscape (figurative), intricate, enduring, vibrant, robust, robustly, seamless, seamlessly, elevate, unlock, unlocking, testament, ever-evolving, dynamic, transformative, empower, navigate the (figurative), at the intersection of, sits at the heart of, in the heart of, nestled, nestle, stand as, stands as, serves as, marks a, represents a shift, paving the way, shaping the future, in today's (landscape|world|market), additionally, moreover, furthermore, it is worth noting, it's worth noting, it is important to note, notably, ultimately, indeed, truly, genuinely, arguably

BANNED RHETORICAL MOVES:
- ZERO em-dashes. Use commas, periods, colons, or parentheses. A single em-dash in the output counts as a failure.
- ZERO negative parallelisms: "not just X but Y", "not only X but also Y", "not merely X, Y", "more than just X, it's Y", "X isn't Y, it's Z", "rather than X, Y". Rewrite as a plain positive statement.
- No tricolons as rhetorical flourish. Use two items, or three only if they are the real three things.
- No "maps to / mirrors / translates to / speaks to / ties into" when drawing parallels. Just say what matches.
- No rule-of-three adjectives: "strategic, data-driven, and scalable" = avoid.
- No "X stands out / sits / represents / embodies Y". Use plain is/does/has.

PREFERRED PATTERNS:
- Copulatives ("is", "has") over "serves as / features / boasts".
- Concrete verbs over abstract nouns. "I rebuilt the CRM" beats "I delivered a CRM transformation".
- Short sentences are fine. Contractions are allowed (I'm, I've, it's).

======= STRUCTURE RULES =======
- FOUR sections exactly: phoneScreen, hiringManager, caseRound, cultureFit.
- caseRound must include miniCase with a realistic scenario tied to THIS company's dossier.
- questionsToAskThem: 5-7 questions the candidate should ask — one per round plus extras. No salary or logistics questions.
- talkingPoints: short, punchy, first-person where spoken. Not bullet-pointed essays.`;

// -------------------- narrativeOf (for anti-AI validation) --------------------

function narrativeOf(d: InterviewPrepStruct): string {
  const parts: string[] = [];

  for (const section of [d.phoneScreen, d.hiringManager, d.caseRound, d.cultureFit]) {
    parts.push(section.overview);
    for (const q of section.likelyQuestions) {
      parts.push(q.question);
      parts.push(...q.talkingPoints);
    }
  }

  parts.push(d.caseRound.miniCase.scenario);
  parts.push(...d.caseRound.miniCase.suggested30DayPlan);
  parts.push(...d.questionsToAskThem);

  return parts.join("\n");
}

// -------------------- toMarkdown --------------------

function toMarkdown(d: InterviewPrepStruct, params: { role: string; company: string }): string {
  const dateIso = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push(`# Interview prep: ${params.role} @ ${params.company}`);
  lines.push("");
  lines.push(`_${dateIso}_`);
  lines.push("");

  // Section 1
  lines.push("## 1. Phone screen / recruiter chat");
  lines.push("");
  lines.push(d.phoneScreen.overview);
  lines.push("");
  for (const q of d.phoneScreen.likelyQuestions) {
    lines.push(`### ${q.question}`);
    for (const tp of q.talkingPoints) {
      lines.push(`- ${tp}`);
    }
    lines.push("");
  }

  // Section 2
  lines.push("## 2. Hiring manager round");
  lines.push("");
  lines.push(d.hiringManager.overview);
  lines.push("");
  for (const q of d.hiringManager.likelyQuestions) {
    lines.push(`### ${q.question}`);
    for (const tp of q.talkingPoints) {
      lines.push(`- ${tp}`);
    }
    lines.push("");
  }

  // Section 3 with mini-case
  lines.push("## 3. Marketing case / technical round");
  lines.push("");
  lines.push(d.caseRound.overview);
  lines.push("");
  for (const q of d.caseRound.likelyQuestions) {
    lines.push(`### ${q.question}`);
    for (const tp of q.talkingPoints) {
      lines.push(`- ${tp}`);
    }
    lines.push("");
  }
  lines.push("**Mini-case:** " + d.caseRound.miniCase.scenario);
  lines.push("");
  lines.push("_Suggested 30-day plan:_");
  for (const step of d.caseRound.miniCase.suggested30DayPlan) {
    lines.push(`- ${step}`);
  }
  lines.push("");

  // Section 4
  lines.push("## 4. Culture-fit / values round");
  lines.push("");
  lines.push(d.cultureFit.overview);
  lines.push("");
  for (const q of d.cultureFit.likelyQuestions) {
    lines.push(`### ${q.question}`);
    for (const tp of q.talkingPoints) {
      lines.push(`- ${tp}`);
    }
    lines.push("");
  }

  // Closing questions
  lines.push("## Questions you should ask them");
  lines.push("");
  for (const q of d.questionsToAskThem) {
    lines.push(`- ${q}`);
  }
  lines.push("");

  return lines.join("\n");
}

// -------------------- Main export --------------------

export interface InterviewPrepResult {
  prep: InterviewPrepStruct;
  markdown: string;
  tokens: { in: number; out: number; cached: number };
  costEur: number;
  attempts: number;
}

export async function generateInterviewPrep(jobId: string): Promise<InterviewPrepResult> {
  const ctx = await loadArtifactContext(jobId);

  const prompt = [
    `COMPANY: ${ctx.companyName}`,
    `ROLE: ${ctx.job.title}`,
    `LOCATION: ${ctx.job.location ?? "unknown"}`,
    `JD:\n${(ctx.job.jdText ?? "").slice(0, 4000)}`,
    "",
    `===COMPANY_DOSSIER===`,
    `Product: ${ctx.dossier.productOneLiner}`,
    `Stage: ${ctx.dossier.stage} | Industry: ${ctx.dossier.industry}`,
    `Narrative: ${ctx.dossier.narrative}`,
    `Marketing stack: ${ctx.dossier.marketingStack.join(", ") || "none detected"}`,
    `===END_DOSSIER===`,
    "",
    `===CANDIDATE_PROFILE===`,
    ctx.profileText,
    `CONSTRAINTS: location=${ctx.profile.constraints.location ?? "?"}, dutchLevel=${ctx.profile.constraints.dutchLevel ?? "?"}, sponsorNeeded=${ctx.profile.constraints.sponsorNeeded ?? "?"}, availability=${ctx.profile.constraints.availability ?? "?"}`,
    `PREFERENCES: salaryFloorEur=${ctx.profile.preferences.salaryFloorEur ?? "?"}, workModes=${(ctx.profile.preferences.workModes ?? []).join("/")}`,
    `===END_PROFILE===`,
    "",
    `Generate a four-round interview prep pack. Section 3 mini-case MUST reference ${ctx.companyName}'s actual product ("${ctx.dossier.productOneLiner}"), stage (${ctx.dossier.stage}), and narrative. Do not invent company facts.`,
  ].join("\n");

  const loop = await runAntiAiLoop<InterviewPrepStruct>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: prompt,
    schema: InterviewPrepSchema,
    maxTokens: 4000,
    narrativeOf,
  });

  const markdown = toMarkdown(loop.data, { role: ctx.job.title, company: ctx.companyName });

  return {
    prep: loop.data,
    markdown,
    tokens: loop.tokens,
    costEur: loop.costEur,
    attempts: loop.attempts,
  };
}
