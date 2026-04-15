import { z } from "zod";
import { getLLM } from "@/lib/llm";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getCompanyDossier } from "@/lib/research";
import { profileToCompactText, type Profile } from "@/lib/profile/types";

const CoverLetterSchema = z.object({
  subject: z.string().describe("Email subject line / letter title (under 90 chars)"),
  greeting: z.string().describe("Greeting line, e.g. 'Dear hiring team,'"),
  paragraphs: z.array(z.string()).min(3).max(5).describe("2-4 body paragraphs, each 2-5 sentences"),
  closing: z.string().describe("Closing line, e.g. 'Kind regards,'"),
  signature: z.string().describe("Candidate name + portfolio url if available"),
});
export type CoverLetterStruct = z.infer<typeof CoverLetterSchema>;

const SYSTEM_PROMPT = `You are a cover-letter writer for a single candidate applying to carefully-chosen roles.

HARD RULES — you will be tested for compliance:
- Never invent experience, metrics, tools, companies, or relationships not present in the profile.
- Never claim prior contact, meeting, or introduction with the company.
- Output English only, even if JD is partly Dutch. The candidate targets English-speaking roles.
- Reference the specific company by name and the role by title — no generic placeholders.
- Cite 1-2 concrete achievements from the profile that match the JD emphasis. Use the candidate's real metrics.
- Read the company dossier and demonstrate comprehension — acknowledge what they do in 1 phrase early in the body.
- Avoid cliches ("I'm passionate about", "I'm a self-starter"). Be concrete.
- 200-350 words total across all paragraphs. Dense, not flowery.

Structure:
- Opener paragraph: what drew the candidate to this role + a one-line grasp of what the company does.
- 1-2 body paragraphs: concrete match evidence from the candidate's profile, mapped to JD priorities.
- Closing paragraph: clear call to action, available-immediately signal.`;

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
    roles: profileRow.roles as Profile["roles"],
    achievements: profileRow.achievements as Profile["achievements"],
    toolStack: profileRow.toolStack as Profile["toolStack"],
    industries: profileRow.industries as Profile["industries"],
    stories: profileRow.stories as Profile["stories"],
    constraints: profileRow.constraints as Profile["constraints"],
    preferences: profileRow.preferences as Profile["preferences"],
    portfolioUrl: profileRow.portfolioUrl ?? undefined,
    linkedinUrl: profileRow.linkedinUrl,
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
  const res = await llm.structured({
    model: "sonnet",
    system: SYSTEM_PROMPT,
    prompt,
    schema: CoverLetterSchema,
    maxTokens: 1500,
    temperature: 0.4,
    cacheSystem: true,
  });

  return {
    cover: res.data,
    markdown: toMarkdown(res.data),
    tokens: { in: res.tokensIn, out: res.tokensOut, cached: res.cachedTokensIn },
    costEur: res.costEur,
  };
}
