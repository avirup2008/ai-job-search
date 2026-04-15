import { z } from "zod";

export const DossierSchema = z.object({
  company: z.string(),
  domain: z.string().nullable(),
  productOneLiner: z.string().describe("What the company sells/does in one sentence"),
  stage: z.enum(["startup", "scale-up", "mid-market", "enterprise", "unknown"]),
  marketingStack: z.array(z.string()).describe("Tools/platforms the company uses for marketing/CRM/analytics if detectable"),
  industry: z.string(),
  hqLocation: z.string().nullable(),
  employeeSize: z.string().nullable().describe("Rough headcount band if known, e.g. '50-200', '1K+'"),
  recentNews: z.array(z.string()).max(5).describe("Last 6-12 months noteworthy news/launches/funding; empty if unknown"),
  cultureSignals: z.array(z.string()).max(5).describe("Values, work mode, team structure signals"),
  narrative: z.string().describe("500-800 word narrative synthesis suitable for feeding into Phase 8 generation"),
  lowSignal: z.boolean().describe("True if we had insufficient data and this dossier is speculative"),
});
export type Dossier = z.infer<typeof DossierSchema>;
