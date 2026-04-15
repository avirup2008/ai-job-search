import { z } from "zod";
import { getLLM } from "@/lib/llm";
import type { ArtifactType } from "./types";

const AVAILABLE_TYPES: ArtifactType[] = [
  "thirty_sixty_ninety",
  "email_crm_teardown",
  "funnel_teardown",
  "seo_audit",
  "competitive_snapshot",
  "paid_audit",
];
// Router picks from AVAILABLE_TYPES only.

const RouterSchema = z.object({
  primary: z.enum(AVAILABLE_TYPES as [ArtifactType, ...ArtifactType[]]),
  secondary: z.enum([
    "thirty_sixty_ninety",
    "email_crm_teardown",
    "funnel_teardown",
    "seo_audit",
    "competitive_snapshot",
    "paid_audit",
    "none",
  ] as const).describe("optional second artifact; 'none' if one is enough"),
  reasoning: z.string().max(600),
});

const SYSTEM = `You pick 1-2 proof-of-work artifacts to attach to a specific job application.

You pick from the CURRENTLY AVAILABLE types only. The currently available types are:
- thirty_sixty_ninety: structured first-90-days plan. Safe fallback. Good for strategic roles, senior roles, and cases where no specific proof-work stands out.
- email_crm_teardown: critique of the company's email marketing and CRM approach, with concrete improvement suggestions. Use when the JD emphasises email marketing, CRM, HubSpot, Pardot, Marketo, lifecycle marketing, nurture, or retention programmes.
- funnel_teardown: end-to-end funnel teardown with friction diagnosis + experiments. Use when JD emphasises growth funnel optimisation, conversion rate, activation, lifecycle funnel, or when the role is growth/performance/acquisition focused.
- seo_audit: mini SEO audit covering technical, on-page, content. Use when JD explicitly emphasises SEO, organic growth, content marketing, or when company has a content-heavy site.
- competitive_snapshot: competitor positioning map with strategic readout. Use when JD emphasises category leadership, brand strategy, market positioning, or when the company operates in a crowded space.
- paid_audit: paid-media channel-by-channel audit with test plan. Use when JD emphasises performance marketing, paid acquisition, CAC, Meta/Google/LinkedIn Ads, or when role is performance/paid focused.

Pick the primary based on JD fit. Add a secondary only if a second artifact would materially strengthen the application; otherwise 'none'. Keep reasoning to 1-2 sentences.`;

export async function pickArtifacts(params: {
  jobTitle: string;
  jdText: string;
}): Promise<{ primary: ArtifactType; secondary: ArtifactType | null; reasoning: string; costEur: number }> {
  const llm = getLLM();
  const res = await llm.structured({
    model: "haiku",
    system: SYSTEM,
    prompt: `JD TITLE: ${params.jobTitle}\n\nJD:\n${params.jdText.slice(0, 4000)}`,
    schema: RouterSchema,
    maxTokens: 500,
    temperature: 0.1,
  });
  return {
    primary: res.data.primary,
    secondary: res.data.secondary === "none" ? null : res.data.secondary as ArtifactType,
    reasoning: res.data.reasoning,
    costEur: res.costEur,
  };
}
