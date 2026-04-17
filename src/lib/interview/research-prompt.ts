export interface DossierLite {
  productOneLiner?: string;
  stage?: string;
  industry?: string;
  narrative?: string;
}

export interface ResearchPromptParams {
  role: string;
  companyName: string;
  jdText: string;
  dossier: DossierLite | null;
}

const JD_LIMIT = 3000;
const NARRATIVE_LIMIT = 500;

export function assembleResearchPrompt(params: ResearchPromptParams): string {
  const { role, companyName, jdText, dossier } = params;
  const jd = (jdText ?? "").slice(0, JD_LIMIT);

  const lines: string[] = [
    `I have an interview for a ${role} role at ${companyName}.`,
    ``,
    `Here is the job description:`,
    ``,
    jd,
    ``,
  ];

  if (dossier) {
    lines.push(`Company context:`);
    lines.push(`- What they do: ${dossier.productOneLiner ?? "unknown"}`);
    lines.push(`- Stage: ${dossier.stage ?? "unknown"}`);
    lines.push(`- Industry: ${dossier.industry ?? "unknown"}`);
    if (dossier.narrative) {
      lines.push(`- Background: ${dossier.narrative.slice(0, NARRATIVE_LIMIT)}`);
    }
    lines.push(``);
  }

  lines.push(`Please help me prepare for this interview by:`);
  lines.push(`1. Identifying the top 5 questions I'm likely to be asked`);
  lines.push(`2. Suggesting what to research about ${companyName} before the interview`);
  lines.push(`3. Flagging any red flags or opportunities in the JD I should address`);
  lines.push(`4. Drafting a 2-minute "tell me about yourself" answer tailored to this role`);

  return lines.join("\n");
}
