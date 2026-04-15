export interface ProfileStory {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  tags: string[];
}

export interface ProfileRole {
  company: string;
  title: string;
  dates: string;
  context: string;
  achievements: string[];
}

export interface ProfileAchievement {
  metric: string;
  context: string;
  toolStack: string[];
  narrative: string;
}

export interface Profile {
  fullName: string;
  headline?: string;
  roles: ProfileRole[];
  achievements: ProfileAchievement[];
  toolStack: Record<string, string>;
  industries: string[];
  stories: ProfileStory[];
  constraints: {
    location?: string;
    dutchLevel?: string;
    sponsorNeeded?: boolean;
    commuteMaxKm?: number;
    commuteMaxMinutesCar?: number;
    commuteMaxMinutesTrain?: number;
    availability?: string;
  };
  preferences: {
    salaryFloorEur?: number | null;
    vetoCompanies?: string[];
    roleFamilies?: string[];
    workModes?: Array<"hybrid" | "remote" | "onsite">;
    languagesAccepted?: string[];
    companyStagePreference?: string[];
    industryAntiPreference?: string[];
  };
  portfolioUrl?: string;
  linkedinUrl?: string | null;
  contactEmail?: string;
  phone?: string;
}

export function profileToCompactText(p: Profile): string {
  const parts: string[] = [];
  // Identity block first — generation code needs this for signatures
  parts.push(`NAME: ${p.fullName}`);
  if (p.headline) parts.push(`HEADLINE: ${p.headline}`);
  const contactParts: string[] = [];
  if (p.contactEmail) contactParts.push(`email: ${p.contactEmail}`);
  if (p.phone) contactParts.push(`phone: ${p.phone}`);
  if (p.portfolioUrl) contactParts.push(`portfolio: ${p.portfolioUrl}`);
  if (p.linkedinUrl) contactParts.push(`linkedin: ${p.linkedinUrl}`);
  if (contactParts.length > 0) parts.push(`CONTACT: ${contactParts.join(" | ")}`);

  if (Object.keys(p.toolStack).length) {
    parts.push("TOOLS: " + Object.entries(p.toolStack).map(([t, lvl]) => `${t} (${lvl})`).join(", "));
  }
  if (p.industries.length) parts.push("INDUSTRIES: " + p.industries.join(", "));
  for (const r of p.roles) {
    parts.push(`ROLE: ${r.title} @ ${r.company} (${r.dates})`);
    if (r.achievements.length) parts.push("  - " + r.achievements.join("\n  - "));
  }
  for (const a of p.achievements) {
    parts.push(`ACHIEVEMENT: ${a.metric} — ${a.context} (tools: ${a.toolStack.join(", ")})`);
  }
  for (const s of p.stories) {
    parts.push(`STORY [${s.tags.join(",")}]: ${s.title} — ${s.action} → ${s.result}`);
  }
  return parts.join("\n");
}
