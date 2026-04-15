import type { ArtifactHeader } from "./types";
import type { ThirtySixtyNinetyStruct } from "./thirty-sixty-ninety";
import type { EmailCrmTeardownStruct } from "./email-crm-teardown";
import type { FunnelTeardownStruct } from "./funnel-teardown";
import type { SeoAuditStruct } from "./seo-audit";
import type { CompetitiveSnapshotStruct } from "./competitive-snapshot";
import type { PaidAuditStruct } from "./paid-audit";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function headerHtml(h: ArtifactHeader): string {
  return `
    <header>
      <div class="meta">${escapeHtml(new Date(h.dateIso).toDateString())}</div>
      <h1>${escapeHtml(h.title)}</h1>
      <p class="subtitle">${escapeHtml(h.subtitle)}</p>
      <div class="author">${escapeHtml(h.authorName)}${h.authorTagline ? ` · ${escapeHtml(h.authorTagline)}` : ""}</div>
    </header>`;
}

const BASE_STYLE = `
  :root { --fg: #0f1419; --muted: #5a6370; --border: #e2e5ea; --accent: #0a8f55; }
  * { box-sizing: border-box; }
  body { font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: var(--fg); max-width: 820px; margin: 0 auto; padding: 36px 24px 60px; }
  header { border-bottom: 2px solid var(--accent); padding-bottom: 18px; margin-bottom: 24px; }
  header .meta { font-size: 12px; color: var(--muted); letter-spacing: 0.5px; text-transform: uppercase; }
  header h1 { margin: 4px 0 6px; font-size: 26px; font-weight: 700; }
  header .subtitle { color: var(--muted); margin: 0 0 10px; font-size: 16px; }
  header .author { font-size: 13px; color: var(--muted); }
  h2 { font-size: 17px; margin: 24px 0 8px; border-bottom: 1px solid var(--border); padding-bottom: 4px; }
  h3 { font-size: 15px; margin: 14px 0 4px; }
  ul { padding-left: 22px; margin: 6px 0; }
  li { margin: 4px 0; }
  .phase { margin: 18px 0; padding: 14px 16px; border-left: 3px solid var(--accent); background: #fafbfc; }
  .phase .label { display: inline-block; font-weight: 700; color: var(--accent); letter-spacing: 0.5px; font-size: 12px; text-transform: uppercase; }
  .phase .theme { font-weight: 600; margin: 2px 0 8px; }
  .initiative { margin: 8px 0; }
  .initiative .name { font-weight: 600; }
  .initiative .metric { display: inline-block; margin-top: 4px; font-size: 12px; color: var(--accent); background: #e6f5ee; padding: 2px 8px; border-radius: 3px; }
  .obs { margin: 14px 0; padding: 12px 14px; border: 1px solid var(--border); border-radius: 4px; }
  .obs .area { display: inline-block; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; color: var(--accent); font-weight: 700; }
  .obs .signal { font-weight: 600; margin: 4px 0; }
  .obs .gap, .obs .suggestion { font-size: 14px; margin: 4px 0; }
  .obs .gap strong, .obs .suggestion strong { color: var(--muted); font-weight: 600; }
  .footer-caveats { font-size: 12px; color: var(--muted); margin-top: 28px; padding-top: 12px; border-top: 1px solid var(--border); }
  @media print { body { padding: 18px; } .phase, .obs { break-inside: avoid; } }
`;

export function renderThirtySixtyNinetyHtml(d: ThirtySixtyNinetyStruct): string {
  const phaseHtml = d.phases.map((p) => `
    <section class="phase">
      <span class="label">Days ${escapeHtml(p.phase)}</span>
      <div class="theme">${escapeHtml(p.theme)}</div>
      <h3>Goals</h3>
      <ul>${p.goals.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul>
      <h3>Initiatives</h3>
      ${p.initiatives.map((i) => `
        <div class="initiative">
          <div class="name">${escapeHtml(i.name)}</div>
          <div>${escapeHtml(i.description)}</div>
          <div class="metric">${escapeHtml(i.successMetric)}</div>
        </div>
      `).join("")}
    </section>
  `).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(d.header.title)}</title>
<style>${BASE_STYLE}</style>
</head><body>
${headerHtml(d.header)}
<section>
  <h2>Premise</h2>
  <p>${escapeHtml(d.premise)}</p>
</section>
${phaseHtml}
<section>
  <h2>Open Questions</h2>
  <ul>${d.openQuestions.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ul>
</section>
<footer class="footer-caveats">
  Prepared by ${escapeHtml(d.header.authorName)} for ${escapeHtml(d.header.companyName)}. A hypothesis document grounded in publicly available information, intended to open a conversation.
</footer>
</body></html>`;
}

export function renderEmailCrmTeardownHtml(d: EmailCrmTeardownStruct): string {
  const obsHtml = d.observations.map((o) => `
    <div class="obs">
      <span class="area">${escapeHtml(o.area)}</span>
      <div class="signal">${escapeHtml(o.signal)}</div>
      <div class="gap"><strong>Gap: </strong>${escapeHtml(o.gap)}</div>
      <div class="suggestion"><strong>Suggestion: </strong>${escapeHtml(o.suggestion)}</div>
    </div>
  `).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(d.header.title)}</title>
<style>${BASE_STYLE}</style>
</head><body>
${headerHtml(d.header)}
<section>
  <h2>Observations</h2>
  ${obsHtml}
</section>
<section>
  <h2>Quick Wins</h2>
  <ul>${d.quickWins.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ul>
</section>
<section>
  <h2>Measurement Plan</h2>
  <p>${escapeHtml(d.measurementPlan)}</p>
</section>
${d.caveats.length > 0 ? `
<section>
  <h2>Caveats</h2>
  <ul>${d.caveats.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
</section>` : ""}
<footer class="footer-caveats">
  Prepared by ${escapeHtml(d.header.authorName)} for ${escapeHtml(d.header.companyName)}. A teardown based on publicly available signals and stated JD priorities; precise numbers and specific emails are hypotheses, not claims about internal data.
</footer>
</body></html>`;
}

export function renderFunnelTeardownHtml(d: FunnelTeardownStruct): string {
  const stageHtml = d.funnelStages.map((s) => `
    <div class="obs">
      <span class="area">${escapeHtml(s.stage)}</span>
      <div class="signal">${escapeHtml(s.observation)}</div>
      <div class="gap"><strong>Friction: </strong>${escapeHtml(s.frictionPoint)}</div>
      <div class="suggestion"><strong>Experiment: </strong>${escapeHtml(s.experiment)}</div>
    </div>
  `).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(d.header.title)}</title>
<style>${BASE_STYLE}</style>
</head><body>
${headerHtml(d.header)}
<section>
  <h2>Premise</h2>
  <p>${escapeHtml(d.premise)}</p>
</section>
<section>
  <h2>Funnel Stages</h2>
  ${stageHtml}
</section>
<section>
  <h2>Measurement Plan</h2>
  <p>${escapeHtml(d.measurementPlan)}</p>
</section>
${d.caveats.length > 0 ? `
<section>
  <h2>Caveats</h2>
  <ul>${d.caveats.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
</section>` : ""}
<footer class="footer-caveats">
  Prepared by ${escapeHtml(d.header.authorName)} for ${escapeHtml(d.header.companyName)}. A funnel teardown based on publicly available signals and stated JD priorities; specific drop-off points and conversion rates are hypotheses, not claims about internal data.
</footer>
</body></html>`;
}

export function renderSeoAuditHtml(d: SeoAuditStruct): string {
  const findingsHtml = d.findings.map((f) => `
    <div class="obs">
      <span class="area">${escapeHtml(f.area)}</span>
      <div class="signal">${escapeHtml(f.observation)}</div>
      <div class="gap"><strong>Impact: </strong>${escapeHtml(f.impact)}</div>
      <div class="suggestion"><strong>Recommendation: </strong>${escapeHtml(f.recommendation)}</div>
    </div>
  `).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(d.header.title)}</title>
<style>${BASE_STYLE}</style>
</head><body>
${headerHtml(d.header)}
<section>
  <h2>Premise</h2>
  <p>${escapeHtml(d.premise)}</p>
</section>
<section>
  <h2>Findings</h2>
  ${findingsHtml}
</section>
<section>
  <h2>Quick Wins</h2>
  <ul>${d.quickWins.map((q) => `<li>${escapeHtml(q)}</li>`).join("")}</ul>
</section>
${d.caveats.length > 0 ? `
<section>
  <h2>Caveats</h2>
  <ul>${d.caveats.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
</section>` : ""}
<footer class="footer-caveats">
  Prepared by ${escapeHtml(d.header.authorName)} for ${escapeHtml(d.header.companyName)}. An SEO audit based on publicly visible signals; specific rankings and traffic numbers are hypotheses, not claims about internal data.
</footer>
</body></html>`;
}

export function renderCompetitiveSnapshotHtml(d: CompetitiveSnapshotStruct): string {
  const compHtml = d.competitors.map((c) => `
    <div class="obs">
      <span class="area">${escapeHtml(c.name)}</span>
      <div class="signal">${escapeHtml(c.positioning)}</div>
      <div class="gap"><strong>Strength: </strong>${escapeHtml(c.strength)}</div>
      <div class="gap"><strong>Weakness: </strong>${escapeHtml(c.weakness)}</div>
      <div class="suggestion"><strong>Takeaway for us: </strong>${escapeHtml(c.takeawayForUs)}</div>
    </div>
  `).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(d.header.title)}</title>
<style>${BASE_STYLE}</style>
</head><body>
${headerHtml(d.header)}
<section>
  <h2>Premise</h2>
  <p>${escapeHtml(d.premise)}</p>
</section>
<section>
  <h2>Competitors</h2>
  ${compHtml}
</section>
<section>
  <h2>Strategic Readout</h2>
  <p>${escapeHtml(d.strategicReadout)}</p>
</section>
${d.caveats.length > 0 ? `
<section>
  <h2>Caveats</h2>
  <ul>${d.caveats.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
</section>` : ""}
<footer class="footer-caveats">
  Prepared by ${escapeHtml(d.header.authorName)} for ${escapeHtml(d.header.companyName)}. A competitive snapshot based on publicly available signals; competitor strategy, financials, and internal priorities are hypotheses, not claims about private data.
</footer>
</body></html>`;
}

export function renderPaidAuditHtml(d: PaidAuditStruct): string {
  const chanHtml = d.channels.map((c) => `
    <div class="obs">
      <span class="area">${escapeHtml(c.channel)}</span>
      <div class="signal">${escapeHtml(c.currentState)}</div>
      <div class="gap"><strong>Opportunity: </strong>${escapeHtml(c.opportunity)}</div>
      <div class="suggestion"><strong>Test plan: </strong>${escapeHtml(c.testPlan)}</div>
    </div>
  `).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(d.header.title)}</title>
<style>${BASE_STYLE}</style>
</head><body>
${headerHtml(d.header)}
<section>
  <h2>Premise</h2>
  <p>${escapeHtml(d.premise)}</p>
</section>
<section>
  <h2>Channels</h2>
  ${chanHtml}
</section>
<section>
  <h2>Budget Hypothesis</h2>
  <p>${escapeHtml(d.budgetHypothesis)}</p>
</section>
${d.caveats.length > 0 ? `
<section>
  <h2>Caveats</h2>
  <ul>${d.caveats.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
</section>` : ""}
<footer class="footer-caveats">
  Prepared by ${escapeHtml(d.header.authorName)} for ${escapeHtml(d.header.companyName)}. A paid-media audit based on publicly visible creative and positioning; spend, CAC, and ROAS are hypotheses, not claims about internal accounts.
</footer>
</body></html>`;
}
