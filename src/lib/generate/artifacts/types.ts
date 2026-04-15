import { z } from "zod";

export const ARTIFACT_TYPES = [
  "thirty_sixty_ninety",
  "email_crm_teardown",
  "funnel_teardown",
  "seo_audit",
  "competitive_snapshot",
  "paid_audit",
] as const;

export type ArtifactType = typeof ARTIFACT_TYPES[number];

export const ARTIFACT_LABELS: Record<ArtifactType, string> = {
  thirty_sixty_ninety: "30-60-90 Day Plan",
  email_crm_teardown: "Email & CRM Teardown",
  funnel_teardown: "Funnel Teardown",
  seo_audit: "SEO Mini-Audit",
  competitive_snapshot: "Competitive Snapshot",
  paid_audit: "Paid Media Audit",
};

// Every artifact carries a common header shape (for consistent templating)
export const ArtifactHeaderSchema = z.object({
  title: z.string().describe("Artifact title — role + artifact-type, e.g. 'Senior Growth Marketing Manager: 30-60-90 Day Plan'"),
  subtitle: z.string().describe("One-line value proposition for this artifact, e.g. 'A structured first-90-days plan mapped to Thuisbezorgd.nl growth priorities'"),
  authorName: z.string(),
  authorTagline: z.string().optional(),
  companyName: z.string(),
  roleTitle: z.string(),
  dateIso: z.string().describe("ISO date string"),
});
export type ArtifactHeader = z.infer<typeof ArtifactHeaderSchema>;

export interface Violation { pattern: string; sample: string }  // duplicated from anti-ai.ts so artifacts don't recirc-import
