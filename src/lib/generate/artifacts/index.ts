import type { ArtifactType } from "./types";
import { generateThirtySixtyNinety } from "./thirty-sixty-ninety";
import { generateEmailCrmTeardown } from "./email-crm-teardown";
import { renderThirtySixtyNinetyHtml, renderEmailCrmTeardownHtml } from "./templates";
export type { ArtifactType } from "./types";
export { pickArtifacts } from "./router";

export interface ArtifactResult {
  type: ArtifactType;
  html: string;
  data: unknown;
  tokens: { in: number; out: number; cached: number };
  costEur: number;
  attempts: number;
}

export async function generateArtifact(jobId: string, type: ArtifactType): Promise<ArtifactResult> {
  switch (type) {
    case "thirty_sixty_ninety": {
      const r = await generateThirtySixtyNinety(jobId);
      return { type, html: renderThirtySixtyNinetyHtml(r.data), data: r.data, tokens: r.tokens, costEur: r.costEur, attempts: r.attempts };
    }
    case "email_crm_teardown": {
      const r = await generateEmailCrmTeardown(jobId);
      return { type, html: renderEmailCrmTeardownHtml(r.data), data: r.data, tokens: r.tokens, costEur: r.costEur, attempts: r.attempts };
    }
    default:
      throw new Error(`Artifact type not yet implemented: ${type}`);
  }
}
