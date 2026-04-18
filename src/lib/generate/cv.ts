import { getLLM } from "@/lib/llm";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getCompanyDossier } from "@/lib/research";
import { profileToCompactText, type Profile } from "@/lib/profile/types";
import { findViolations, formatViolationsForRetry, mapStrings, sanitizeMechanicalTells, type Violation } from "./anti-ai";
import { atsKeywordPass } from "@/lib/ats/keyword-pass";
import { z } from "zod";
import { CvSchema, cvNarrativeText } from "./cv-types";
import type { CvStruct } from "./cv-types";

const SYSTEM_PROMPT = `You write a single candidate's CV, tailored to a specific role at a specific company.

CONTENT HARD RULES:
- Never invent experience, metrics, tools, companies, certifications, dates.
- Preserve metrics in original context — no reattribution.
- Re-order and re-emphasize achievements to match JD; do not fabricate.
- Output English only.
- Use the candidate's real name, contact info, portfolio URL from profile.

TAILORING RULES:
- Headline: role-tailored positioning, grounded in actual discipline.
- Summary: 3-4 sentences. Years of experience + core domain + what they bring to THIS role.
- Skills: 3-5 groups ordered by JD relevance.
- Experience: re-order bullets by JD relevance. 3-6 bullets per role. Real metrics only.

ANTI-AI WRITING RULES (STRICT):
- ZERO em-dashes. Use commas, periods, colons, parentheses.
- ZERO negative parallelisms ("not just X but Y", "not only", "not merely", "more than just").
- ZERO "maps to / mapped to / mapping to" constructions.
- BANNED WORDS: delve, pivotal, crucial, vital, underscore, showcase, leverage, foster, tapestry, intricate, enduring, vibrant, robust, robustly, seamless, seamlessly, elevate, transformative, dynamic, comprehensive, holistic, facilitate, facilitate, ensure, navigate (figurative).
- BANNED PHRASES: at the intersection of, sits at the heart of, stands as, serves as, paving the way, shaping the future, ever-evolving, in today's, additionally, moreover, furthermore, ultimately, it is worth noting, it's worth noting, it is important to note, mirrors, mirroring, translates to, speaks to, ties into, it goes without saying, needless to say, in many cases, in most scenarios.
- BANNED rhetorical flourish: filler tricolons, "stands out/embodies/represents", rule-of-three adjectives.
- PREFERRED: concrete verbs, copulatives (is/has), short sentences OK.

WRITING STYLE (HUMANIZER RULES):
- Vary sentence length. Mix short punchy sentences with longer ones. Uniform 18-22 word sentences signal AI.
- Preserve all real metrics exactly. Never replace specific numbers with vague claims like "significantly improved".
- Direct voice: active over passive, concrete over abstract. "Rebuilt the CRM" beats "delivered a CRM transformation".
- No identical structure across bullets or sections — vary how each opens.

LENGTH:
- Summary: 60-90 words.
- Each experience bullet: 15-35 words. Lead with a verb.
- Total narrative: 500-800 words.`;

export interface CvGenerationResult {
  cv: CvStruct;
  tokens: { in: number; out: number; cached: number };
  costEur: number;
  attempts: number;
}

export async function generateCV(jobId: string): Promise<CvGenerationResult> {
  // Load job + company
  const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1);
  if (!job) throw new Error(`Job ${jobId} not found`);
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
    `Produce the tailored CV as structured output.`,
  ].join("\n");

  const llm = getLLM();
  const MAX_ATTEMPTS = 5;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res: Awaited<ReturnType<typeof llm.structured<any>>> | null = null;
  let accumulatedTokens = { in: 0, out: 0, cached: 0 };
  let accumulatedCost = 0;
  let lastViolations: Violation[] = [];
  let finalAttempt = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    finalAttempt = attempt;
    const retryFeedback = attempt === 1 ? "" : formatViolationsForRetry(lastViolations);

    const thisRes = await llm.structured({
      model: "sonnet",
      system: SYSTEM_PROMPT,
      prompt: prompt + retryFeedback,
      schema: CvSchema as z.ZodType<CvStruct>,
      maxTokens: 3500,
      temperature: 0.4,
      cacheSystem: true,
    });

    accumulatedTokens.in += thisRes.tokensIn;
    accumulatedTokens.out += thisRes.tokensOut;
    accumulatedTokens.cached += thisRes.cachedTokensIn;
    accumulatedCost += thisRes.costEur;

    const violations = findViolations(cvNarrativeText(thisRes.data));
    if (violations.length === 0) {
      res = thisRes;
      break;
    }
    lastViolations = violations;
    res = thisRes; // keep latest even if violating, in case we exhaust retries
    console.warn(`[cv] attempt ${attempt} violated ${violations.length} rule(s): ${violations.map((v) => v.pattern).join(", ")}`);
  }

  if (!res) throw new Error("CV generation failed — no response");

  // Final mechanical sanitisation — catches em-dashes that slip past all 5 retries
  const sanitised = mapStrings(res.data as CvStruct, sanitizeMechanicalTells);

  // R-84: ATS keyword post-pass — inject high-frequency JD keywords missing from skills.
  // Pure function; no LLM call. Runs AFTER anti-AI sanitisation — injected tokens are
  // proper-noun tool names so they do not re-trigger mechanical-tell rules.
  const atsResult = atsKeywordPass(sanitised, job.jdText ?? "");
  if (atsResult.injected.length > 0) {
    console.log(`[ats-pass] jobId=${jobId} injected=${atsResult.injected.length} candidates=${atsResult.candidates} keywords=${atsResult.injected.join(",")}`);
  } else {
    console.log(`[ats-pass] jobId=${jobId} injected=0 candidates=${atsResult.candidates}`);
  }

  return {
    cv: atsResult.cv,
    tokens: accumulatedTokens,
    costEur: accumulatedCost,
    attempts: finalAttempt,
  };
}
