import { z } from "zod";
import { getLLM } from "@/lib/llm";
import { loadArtifactContext, runAntiAiLoop } from "./artifacts/base";

/**
 * Adaptive screening-interview Q&A generator.
 *
 * Two-stage pipeline:
 *   1. Haiku picks 6-10 questions from a fixed pool that apply to THIS role + candidate.
 *   2. Sonnet writes 2-4 sentence grounded answers with the shared anti-AI retry loop.
 */

export const SCREENING_QUESTION_IDS = [
  "visa_work_auth",
  "salary_expectations",
  "notice_period",
  "why_this_role",
  "why_this_company",
  "relevant_experience",
  "dutch_language",
  "remote_hybrid_preference",
  "commute_location",
  "tool_stack",
  "biggest_gap",
  "management_experience",
  "industry_transition",
  "metrics_achievements",
] as const;
export type ScreeningQuestionId = (typeof SCREENING_QUESTION_IDS)[number];

const QUESTION_LABELS: Record<ScreeningQuestionId, string> = {
  visa_work_auth: "Do you need sponsorship / what's your work authorisation?",
  salary_expectations: "What are your salary expectations?",
  notice_period: "What's your notice period / when can you start?",
  why_this_role: "Why this role specifically?",
  why_this_company: "Why our company?",
  relevant_experience: "Walk me through your most relevant experience.",
  dutch_language: "What's your Dutch level / are you comfortable in a Dutch-speaking environment?",
  remote_hybrid_preference: "What's your preference on remote / hybrid / onsite?",
  commute_location: "How does the commute work for you?",
  tool_stack: "What tools and platforms do you have hands-on experience with?",
  biggest_gap: "What's a skill you'd want to develop in this role?",
  management_experience: "Have you managed people or budgets?",
  industry_transition: "How do you see your experience transferring to our industry?",
  metrics_achievements: "Walk me through a result you're most proud of, with numbers.",
};

// -------------------- Stage 1: Haiku picker --------------------

const PickerSchema = z.object({
  questions: z
    .array(z.enum(SCREENING_QUESTION_IDS))
    .min(4)
    .max(10)
    .describe("Selected screening question IDs, ordered by likelihood (most likely first)"),
  reasoning: z.string().describe("One short sentence on why this selection for this role + candidate"),
});

const PICKER_SYSTEM = `You pick which screening-interview questions a recruiter is likely to ask a specific candidate for a specific role. Pick 6-10 questions from the allowed set, prioritising by likelihood for THIS job + THIS candidate.

Always include: why_this_role, why_this_company, relevant_experience.
Include visa_work_auth only if the JD hints at sponsorship concerns or the role is at a company that typically asks (large non-EU-HQ corps, startups). If the candidate's visa is settled and the JD is silent, skip.
Include dutch_language if the JD is in Dutch, mentions Dutch proficiency, or the company is Dutch-HQ with a local-facing role. Skip if it's clearly an English-speaking team.
Include commute_location if the JD mentions office presence and the company is outside easy commute.
Include management_experience only if the JD mentions leading, managing, or mentoring.
Include industry_transition if the candidate's prior industries obviously differ from the target company's industry.

Output the selected IDs in priority order (most likely first).`;

export async function pickScreeningQuestions(params: {
  jobId: string;
}): Promise<{ questions: ScreeningQuestionId[]; costEur: number; tokens: { in: number; out: number; cached: number } }> {
  const ctx = await loadArtifactContext(params.jobId);
  const prompt = [
    `COMPANY: ${ctx.companyName}`,
    `ROLE: ${ctx.job.title}`,
    `LOCATION: ${ctx.job.location ?? "unknown"}`,
    `DUTCH_REQUIRED: ${ctx.job.dutchRequired ? "yes" : "no"}`,
    `JD:\n${(ctx.job.jdText ?? "").slice(0, 3000)}`,
    "",
    `===COMPANY_DOSSIER===`,
    `Product: ${ctx.dossier.productOneLiner}`,
    `Stage: ${ctx.dossier.stage} | Industry: ${ctx.dossier.industry}`,
    `Narrative: ${ctx.dossier.narrative}`,
    `===END_DOSSIER===`,
    "",
    `===CANDIDATE_PROFILE===`,
    ctx.profileText,
    `CONSTRAINTS: location=${ctx.profile.constraints.location ?? "?"}, dutchLevel=${ctx.profile.constraints.dutchLevel ?? "?"}, sponsorNeeded=${ctx.profile.constraints.sponsorNeeded ?? "?"}, availability=${ctx.profile.constraints.availability ?? "?"}`,
    `===END_PROFILE===`,
    "",
    `Pick 6-10 screening questions, prioritised.`,
  ].join("\n");

  const llm = getLLM();
  const res = await llm.structured({
    model: "haiku",
    system: PICKER_SYSTEM,
    prompt,
    schema: PickerSchema,
    maxTokens: 400,
    temperature: 0.2,
    cacheSystem: true,
  });

  // Dedup while preserving order
  const seen = new Set<ScreeningQuestionId>();
  const ordered: ScreeningQuestionId[] = [];
  for (const q of res.data.questions) {
    if (!seen.has(q)) {
      seen.add(q);
      ordered.push(q);
    }
  }
  return {
    questions: ordered,
    costEur: res.costEur,
    tokens: { in: res.tokensIn, out: res.tokensOut, cached: res.cachedTokensIn },
  };
}

// -------------------- Stage 2: Sonnet answerer --------------------

const ScreeningQASchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.enum(SCREENING_QUESTION_IDS),
        question: z.string().describe("The recruiter-facing question phrasing"),
        answer: z.string().describe("2-4 sentence first-person candidate answer"),
        confidence: z
          .enum(["high", "medium", "low"])
          .describe("low = candidate should practise this one; it's a weak area"),
      }),
    )
    .min(4)
    .max(10),
  openingLine: z
    .string()
    .describe("One sentence to open the screening call after the recruiter's greeting"),
  closingQuestion: z
    .string()
    .describe("One question the candidate should ask the recruiter at the end"),
});
export type ScreeningQAStruct = z.infer<typeof ScreeningQASchema>;

const ANSWERER_SYSTEM = `You write screening-interview answers a real candidate will say out loud. First-person, tight, grounded in the profile. Not marketing copy.

======= CONTENT HARD RULES =======
- Never invent experience, metrics, tools, companies, or relationships not present in the profile.
- Never claim prior contact with the company.
- Output English only, even if the JD is partly Dutch.
- Reference the specific company by name and the role by title — no generic placeholders.
- Cite concrete achievements from the profile with their real metrics when they fit the question.

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

======= ANSWER RULES =======
- First person, candidate voice, spoken register.
- 2-4 sentences per answer. Tight.
- Ground every claim in the profile. Never fabricate roles, metrics, or relationships.
- Honest about gaps. If it's a weak area, mark confidence "low" and give a candid, non-defensive framing: "I haven't worked directly with X, but here's the closest thing I've done..."
- For salary: use the profile's salaryFloorEur but frame it as a range with sensible headroom based on the seniority level of the JD.
- For notice/availability: use profile.constraints.availability verbatim where sensible.
- For visa: use profile.constraints.sponsorNeeded. If sponsorNeeded is false, say so plainly and mention "HSM Dependent visa" (no sponsorship needed).
- For dutch_language: honest. If profile says A2, say A2. "Comfortable in English-speaking meetings, improving my Dutch steadily." Mark confidence "low" if the JD requires Dutch and the candidate is below B2.
- Opening line: warm, professional, one sentence.
- Closing question: one thoughtful question about the role, team, or success in the first 90 days. Never salary or logistics.`;

function narrativeOf(d: ScreeningQAStruct): string {
  const parts: string[] = [d.openingLine, d.closingQuestion];
  for (const q of d.questions) {
    parts.push(q.question, q.answer);
  }
  return parts.join("\n");
}

function confidenceBadge(c: "high" | "medium" | "low"): string {
  if (c === "high") return "green, confident";
  if (c === "medium") return "yellow, rehearse once";
  return "red, weak area, rehearse hard";
}

function toMarkdown(d: ScreeningQAStruct, params: { role: string; company: string }): string {
  const dateIso = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# Screening Q&A: ${params.role} @ ${params.company}`);
  lines.push("");
  lines.push(`_${dateIso}_`);
  lines.push("");
  lines.push(`**Opening line:** ${d.openingLine}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  for (const q of d.questions) {
    lines.push(`## ${q.question}`);
    lines.push(`_Confidence: ${confidenceBadge(q.confidence)}_`);
    lines.push("");
    lines.push(q.answer);
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push(`**Question to ask them:** ${d.closingQuestion}`);
  lines.push("");
  return lines.join("\n");
}

export interface ScreeningQAResult {
  qa: ScreeningQAStruct;
  markdown: string;
  tokens: { in: number; out: number; cached: number };
  costEur: number;
  attempts: number;
  pickedQuestions: ScreeningQuestionId[];
}

export async function generateScreeningQA(jobId: string): Promise<ScreeningQAResult> {
  const ctx = await loadArtifactContext(jobId);

  // Stage 1: pick applicable questions
  const picked = await pickScreeningQuestions({ jobId });
  const pickedList = picked.questions.length > 0
    ? picked.questions
    : (["why_this_role", "why_this_company", "relevant_experience", "tool_stack", "salary_expectations", "notice_period"] as ScreeningQuestionId[]);

  const questionBlock = pickedList
    .map((id, i) => `${i + 1}. [${id}] ${QUESTION_LABELS[id]}`)
    .join("\n");

  const prompt = [
    `COMPANY: ${ctx.companyName}`,
    `ROLE: ${ctx.job.title}`,
    `LOCATION: ${ctx.job.location ?? "unknown"}`,
    `DUTCH_REQUIRED: ${ctx.job.dutchRequired ? "yes" : "no"}`,
    `JD:\n${(ctx.job.jdText ?? "").slice(0, 4000)}`,
    "",
    `===COMPANY_DOSSIER===`,
    `Product: ${ctx.dossier.productOneLiner}`,
    `Stage: ${ctx.dossier.stage} | Industry: ${ctx.dossier.industry}`,
    `Marketing stack seen: ${ctx.dossier.marketingStack.join(", ") || "none detected"}`,
    `Narrative: ${ctx.dossier.narrative}`,
    `===END_DOSSIER===`,
    "",
    `===CANDIDATE_PROFILE===`,
    ctx.profileText,
    `CONSTRAINTS: location=${ctx.profile.constraints.location ?? "?"}, dutchLevel=${ctx.profile.constraints.dutchLevel ?? "?"}, sponsorNeeded=${ctx.profile.constraints.sponsorNeeded ?? "?"}, availability=${ctx.profile.constraints.availability ?? "?"}`,
    `PREFERENCES: salaryFloorEur=${ctx.profile.preferences.salaryFloorEur ?? "?"}, workModes=${(ctx.profile.preferences.workModes ?? []).join("/")}`,
    `===END_PROFILE===`,
    "",
    `===QUESTIONS_TO_ANSWER (in this priority order)===`,
    questionBlock,
    `===END_QUESTIONS===`,
    "",
    `Produce the screening Q&A pack as structured output. Answer every listed question, preserve the order, and use the exact id strings. Add an openingLine and closingQuestion.`,
  ].join("\n");

  const loop = await runAntiAiLoop<ScreeningQAStruct>({
    systemPrompt: ANSWERER_SYSTEM,
    userPrompt: prompt,
    schema: ScreeningQASchema,
    maxTokens: 2500,
    narrativeOf,
  });

  const markdown = toMarkdown(loop.data, { role: ctx.job.title, company: ctx.companyName });

  return {
    qa: loop.data,
    markdown,
    tokens: {
      in: loop.tokens.in + picked.tokens.in,
      out: loop.tokens.out + picked.tokens.out,
      cached: loop.tokens.cached + picked.tokens.cached,
    },
    costEur: loop.costEur + picked.costEur,
    attempts: loop.attempts,
    pickedQuestions: pickedList,
  };
}
