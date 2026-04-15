import { z } from "zod";
import { getLLM } from "@/lib/llm";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getCompanyDossier } from "@/lib/research";
import { profileToCompactText, type Profile } from "@/lib/profile/types";
import { findViolations, formatViolationsForRetry, type Violation } from "./anti-ai";

const CoverLetterSchema = z.object({
  subject: z.string().describe("Email subject line / letter title (under 90 chars)"),
  greeting: z.string().describe("Greeting line, e.g. 'Dear hiring team,'"),
  paragraphs: z.array(z.string()).min(3).max(5).describe("2-4 body paragraphs, each 2-5 sentences"),
  closing: z.string().describe("Closing line, e.g. 'Kind regards,'"),
  signature: z.string().describe("Full signature block as one string with newlines: Name, then Email | Phone | LinkedIn | Portfolio on separate lines using whichever contact details are present in the profile"),
});
export type CoverLetterStruct = z.infer<typeof CoverLetterSchema>;

const SYSTEM_PROMPT = `You are writing a cover letter for a single, specific candidate to a single, specific role. This is not marketing copy and not a Wikipedia-style summary. You are imitating the voice of a thoughtful, capable human applicant who has actually read the JD and the company.

======= CONTENT HARD RULES =======
- Never invent experience, metrics, tools, companies, or relationships not present in the profile.
- Never claim prior contact, meeting, or introduction with the company.
- Output English only, even if the JD is partly Dutch.
- Reference the specific company by name and the role by title — no generic placeholders.
- Cite 1-2 concrete achievements from the profile with their real metrics.
- Read the company dossier and show comprehension — one phrase about what they do, grounded in the dossier, early on.
- If the company's detected marketing stack overlaps the candidate's tools, name the overlap directly.
- Greeting: "Dear Hiring Manager," unless the dossier names a specific contact.

======= ANTI-AI WRITING RULES =======
Your output will be compared against known LLM tells. You must avoid them. Reviewers read a lot of ChatGPT. Sound human.

BANNED WORDS AND PHRASES (do not use any of these, even once):
- delve, crucial, pivotal, underscore, underscores, highlight (as verb), showcase (as verb), leverage (as verb), foster, fostering, garner, resonate, resonates, align with, alignment, tapestry, landscape (figurative), intricate, enduring, vibrant, robust, robustly, seamless, seamlessly, elevate, unlock, unlocking, testament, ever-evolving, dynamic, transformative, empower, navigate the (figurative), at the intersection of, sits at the heart of, in the heart of, nestled, nestle, stand as, stands as, serves as, marks a, represents a shift, paving the way, shaping the future, in today's (landscape|world|market), additionally, moreover, furthermore, it is worth noting, it's worth noting, it is important to note, notably, ultimately, indeed, truly, genuinely, arguably

BANNED RHETORICAL MOVES:
- **ZERO em-dashes (—). None. Not one. Use commas, periods, colons, or parentheses.** The em-dash is one of the strongest LLM tells. If you feel the urge to use an em-dash, rewrite the sentence. This rule is absolute: a single em-dash in the output counts as a failure.
- **ZERO negative parallelisms.** All of these are banned with no exceptions: "not just X, but Y", "not only X but also Y", "not merely X, Y", "more than just X, it's Y", "X isn't Y, it's Z", "not X — Y", "rather than X, Y". This construction is a top LLM tell. Rewrite as a plain positive statement.
- Tricolons used as rhetorical flourish (e.g. "performance marketing, CRM retention, and data-driven segmentation"). Use two items, or three only if they are the real three things, not padding.
- Superficial trailing -ing clauses that puff the previous clause: "..., mirroring your priorities", "..., contributing to X", "..., reflecting Y". Cut the -ing clause or replace with a short direct sentence.
- "Elegant variation" — do not call the same thing three different names across the letter (the role, the position, this opportunity, this remit). Pick one and stick to it.
- Rule-of-three adjectives: "strategic, data-driven, and scalable" = avoid.
- "X stands out / sits / represents / embodies Y" constructions. Use plain is/does/has.
- "Maps to / mirrors / translates to / speaks to / ties into" when drawing parallels. Just say what matches.

PREFERRED PATTERNS:
- Copulatives ("is", "has") over "serves as / features / boasts".
- Concrete verbs over abstract nouns. "I rebuilt the CRM" beats "I delivered a CRM transformation".
- Short sentences are fine. Not every sentence needs a subordinate clause.
- It's OK to start a sentence with a conjunction (And, But, So) occasionally if it reads naturally.
- One slightly human imperfection is good: a mild opinion, a candid phrase, a specific-not-generic observation. Not cute, not flippant — just unvarnished.
- Contractions are allowed (I'm, I've, it's) where tone permits.

======= LENGTH AND STRUCTURE =======
- Target 230-280 words across the body paragraphs. Tight.
- Opener (~50 words): a specific hook + one phrase showing you understood what the company does.
- Body 1 (~90 words): strongest match evidence — one achievement with real metrics, mapped to a JD priority.
- Body 2 (~80 words): second evidence OR stack-overlap callout OR cross-border / coordination strength.
- Closing (~35 words): clear next step + immediate availability. No flourish.

======= SUBJECT LINE =======
Plain and functional. Format: "Application: {RoleTitle}" (colon, not a dash). No name, no marketing copy, no dashes of any kind. Under 80 chars.

======= SIGNATURE =======
Put ALL of this inside the 'signature' field as a single string with newlines:
  {fullName}
  {email} | {phone} | {linkedinUrl} | {portfolioUrl}
Use only the contact fields present in the profile. Separate with " | ". Omit any missing field cleanly.`;

export interface GenerationInput {
  jobId: string;
}

export interface GenerationResult {
  cover: CoverLetterStruct;
  markdown: string;
  tokens: { in: number; out: number; cached: number };
  costEur: number;
}

function toMarkdown(c: CoverLetterStruct): string {
  return [
    `# ${c.subject}`,
    "",
    c.greeting,
    "",
    ...c.paragraphs.map((p) => p.trim()),
    "",
    c.closing,
    "",
    c.signature,
  ].join("\n");
}

/**
 * Text-only content of the letter (everything the candidate would actually send).
 * We validate this portion — NOT the signature block (which legitimately contains
 * vertical bars between contact fields).
 */
function bodyText(c: CoverLetterStruct): string {
  return [c.subject, c.greeting, ...c.paragraphs, c.closing].join("\n");
}


export async function generateCoverLetter(input: GenerationInput): Promise<GenerationResult> {
  // Load job + company
  const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, input.jobId)).limit(1);
  if (!job) throw new Error(`Job ${input.jobId} not found`);
  const [company] = job.companyId
    ? await db.select().from(schema.companies).where(eq(schema.companies.id, job.companyId)).limit(1)
    : [];
  const companyName = company?.name ?? "the company";
  const companyDomain = company?.domain ?? null;

  // Load profile
  const [profileRow] = await db.select().from(schema.profile).limit(1);
  if (!profileRow) throw new Error("No profile row in DB — seed first");
  const profile: Profile = {
    fullName: profileRow.fullName ?? "",
    headline: profileRow.headline ?? undefined,
    roles: profileRow.roles as Profile["roles"],
    achievements: profileRow.achievements as Profile["achievements"],
    toolStack: profileRow.toolStack as Profile["toolStack"],
    industries: profileRow.industries as Profile["industries"],
    stories: profileRow.stories as Profile["stories"],
    constraints: profileRow.constraints as Profile["constraints"],
    preferences: profileRow.preferences as Profile["preferences"],
    portfolioUrl: profileRow.portfolioUrl ?? undefined,
    linkedinUrl: profileRow.linkedinUrl,
    contactEmail: profileRow.contactEmail ?? undefined,
    phone: profileRow.phone ?? undefined,
  };

  // Lazy-research dossier
  const dossier = await getCompanyDossier({ companyName, domain: companyDomain });

  // Build the user prompt
  const profileText = profileToCompactText(profile);
  const prompt = [
    `COMPANY: ${companyName}`,
    `ROLE: ${job.title}`,
    `JD:\n${(job.jdText ?? "").slice(0, 4000)}`,
    "",
    `===COMPANY_DOSSIER===`,
    `Product: ${dossier.productOneLiner}`,
    `Stage: ${dossier.stage} | Industry: ${dossier.industry}`,
    `Marketing stack seen: ${dossier.marketingStack.join(", ") || "none detected"}`,
    `Narrative: ${dossier.narrative}`,
    dossier.lowSignal ? "(note: low-signal dossier — be conservative with company-specific claims)" : "",
    `===END_DOSSIER===`,
    "",
    `===CANDIDATE_PROFILE===`,
    profileText,
    `===END_PROFILE===`,
    "",
    `Produce the cover letter as structured output.`,
  ].join("\n");

  const llm = getLLM();
  const MAX_ATTEMPTS = 5;
  let res: Awaited<ReturnType<typeof llm.structured<CoverLetterStruct>>> | null = null;
  let accumulatedTokens = { in: 0, out: 0, cached: 0 };
  let accumulatedCost = 0;
  let lastViolations: Violation[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const retryFeedback = attempt === 1 ? "" : formatViolationsForRetry(lastViolations);

    const thisRes = await llm.structured({
      model: "sonnet",
      system: SYSTEM_PROMPT,
      prompt: prompt + retryFeedback,
      schema: CoverLetterSchema,
      maxTokens: 1500,
      temperature: 0.4,
      cacheSystem: true,
    });

    accumulatedTokens.in += thisRes.tokensIn;
    accumulatedTokens.out += thisRes.tokensOut;
    accumulatedTokens.cached += thisRes.cachedTokensIn;
    accumulatedCost += thisRes.costEur;

    const violations = findViolations(bodyText(thisRes.data));
    if (violations.length === 0) {
      res = thisRes;
      break;
    }
    lastViolations = violations;
    res = thisRes; // keep latest even if violating, in case we exhaust retries
    console.warn(`[cover-letter] attempt ${attempt} violated ${violations.length} rule(s): ${violations.map((v) => v.pattern).join(", ")}`);
  }

  if (!res) throw new Error("cover letter generation failed — no response");

  return {
    cover: res.data,
    markdown: toMarkdown(res.data),
    tokens: accumulatedTokens,
    costEur: accumulatedCost,
  };
}
