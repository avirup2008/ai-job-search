import { z } from "zod";

export const CvSchema = z.object({
  name: z.string(),
  headline: z.string().describe("Role-tailored positioning line"),
  location: z.string(),
  contact: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    linkedin: z.string().optional(),
    portfolio: z.string().optional(),
  }),
  summary: z.string().describe("3-4 sentence professional summary tailored to THIS role"),
  skillsGrouped: z.array(z.object({
    group: z.string(),
    items: z.array(z.string()),
  })).min(2).max(5),
  experience: z.array(z.object({
    company: z.string(),
    title: z.string(),
    dates: z.string(),
    location: z.string().optional(),
    context: z.string().optional(),
    highlights: z.array(z.string()).min(2).max(6),
  })).min(2).max(5),
  education: z.array(z.object({
    degree: z.string(),
    school: z.string(),
    year: z.string().optional(),
  })),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
});
export type CvStruct = z.infer<typeof CvSchema>;

export function cvNarrativeText(cv: CvStruct): string {
  const parts: string[] = [cv.headline, cv.summary];
  for (const g of cv.skillsGrouped) { parts.push(g.group); parts.push(...g.items); }
  for (const r of cv.experience) {
    if (r.context) parts.push(r.context);
    parts.push(...r.highlights);
  }
  return parts.join("\n");
}
