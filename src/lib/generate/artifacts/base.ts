import { z } from "zod";
import { getLLM } from "@/lib/llm";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getCompanyDossier } from "@/lib/research";
import { profileToCompactText, type Profile } from "@/lib/profile/types";
import { findViolations, formatViolationsForRetry } from "../anti-ai";

export interface ArtifactContext {
  jobId: string;
  job: typeof schema.jobs.$inferSelect;
  companyName: string;
  companyDomain: string | null;
  profile: Profile;
  profileText: string;
  dossier: Awaited<ReturnType<typeof getCompanyDossier>>;
}

export async function loadArtifactContext(jobId: string): Promise<ArtifactContext> {
  const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1);
  if (!job) throw new Error(`Job ${jobId} not found`);
  const [company] = job.companyId
    ? await db.select().from(schema.companies).where(eq(schema.companies.id, job.companyId)).limit(1)
    : [];
  const companyName = company?.name ?? "the company";
  const companyDomain = company?.domain ?? null;

  const [profileRow] = await db.select().from(schema.profile).limit(1);
  if (!profileRow) throw new Error("No profile seeded");
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
  const profileText = profileToCompactText(profile);
  const dossier = await getCompanyDossier({ companyName, domain: companyDomain });
  return { jobId, job, companyName, companyDomain, profile, profileText, dossier };
}

/**
 * Run Sonnet with a 5-retry anti-AI loop. `narrativeOf` extracts the validatable
 * text from the structured response (which differs per artifact).
 */
export async function runAntiAiLoop<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  narrativeOf: (data: T) => string;
}): Promise<{ data: T; tokens: { in: number; out: number; cached: number }; costEur: number; attempts: number }> {
  const llm = getLLM();
  const MAX = 5;
  const acc = { in: 0, out: 0, cached: 0, cost: 0 };
  let last: { data: T } | null = null;
  let viols: ReturnType<typeof findViolations> = [];
  let attempt = 0;
  for (attempt = 1; attempt <= MAX; attempt++) {
    const feedback = attempt === 1 ? "" : formatViolationsForRetry(viols);
    const res = await llm.structured({
      model: "sonnet",
      system: params.systemPrompt,
      prompt: params.userPrompt + feedback,
      schema: params.schema,
      maxTokens: params.maxTokens ?? 3000,
      temperature: 0.4,
      cacheSystem: true,
    });
    acc.in += res.tokensIn;
    acc.out += res.tokensOut;
    acc.cached += res.cachedTokensIn;
    acc.cost += res.costEur;
    last = { data: res.data };
    const v = findViolations(params.narrativeOf(res.data));
    if (v.length === 0) break;
    viols = v;
    console.warn(`[artifact] attempt ${attempt} violated ${v.length}: ${v.map((x) => x.pattern).join(", ")}`);
  }
  if (!last) throw new Error("artifact generation failed");
  return { data: last.data, tokens: { in: acc.in, out: acc.out, cached: acc.cached }, costEur: acc.cost, attempts: attempt };
}
