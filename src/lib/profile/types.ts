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
  };
  preferences: {
    salaryFloorEur?: number;
    vetoCompanies?: string[];
    roleFamilies?: string[];
  };
  portfolioUrl?: string;
  linkedinUrl?: string;
}

export function profileToCompactText(p: Profile): string {
  const parts: string[] = [];
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
