// Parses a home-page HTML string for known marketing-stack signatures.
// Extend this list over time as we encounter more tools.
const SIGNATURES: Array<{ tool: string; patterns: RegExp[] }> = [
  { tool: "HubSpot", patterns: [/js\.hs[-\w]*\.(com|net)/i, /\bhs-scripts\b/i, /_hsq\s*=\s*window\._hsq/i] },
  { tool: "Pardot", patterns: [/pardot\.com/i, /pi\.pardot/i] },
  { tool: "Marketo", patterns: [/mktoresp\.com/i, /marketo\.com/i] },
  { tool: "Salesforce", patterns: [/salesforce\.com/i, /force\.com/i] },
  { tool: "Klaviyo", patterns: [/klaviyo\.com/i, /klaviyo-media/i] },
  { tool: "Mailchimp", patterns: [/list-manage\.com/i, /mailchimp\.com/i] },
  { tool: "Google Analytics 4", patterns: [/googletagmanager\.com\/gtag\/js\?id=G-/i, /gtag\('config', 'G-/i] },
  { tool: "Google Tag Manager", patterns: [/googletagmanager\.com\/gtm\.js/i, /GTM-[A-Z0-9]+/] },
  { tool: "Meta Pixel", patterns: [/connect\.facebook\.net.*\/fbevents\.js/i, /fbq\('init'/i] },
  { tool: "LinkedIn Insight", patterns: [/snap\.licdn\.com\/li\.lms-analytics\//i, /linkedin\.com\/li\.js/i] },
  { tool: "Intercom", patterns: [/widget\.intercom\.io/i, /intercom-h2h-server/i] },
  { tool: "Drift", patterns: [/js\.driftt\.com/i] },
  { tool: "Segment", patterns: [/cdn\.segment\.com\/analytics\.js/i] },
  { tool: "Amplitude", patterns: [/amplitude\.com\/libs\//i, /amplitude\.init/i] },
  { tool: "Mixpanel", patterns: [/cdn\.mxpnl\.com/i, /mixpanel\.init/i] },
  { tool: "Hotjar", patterns: [/static\.hotjar\.com/i, /hj\.id\s*=/i] },
  { tool: "Fullstory", patterns: [/fullstory\.com\/s\/fs\.js/i] },
  { tool: "Braze", patterns: [/appboycdn\.com/i, /braze\.com/i] },
  { tool: "Iterable", patterns: [/iterable\.com/i] },
  { tool: "ActiveCampaign", patterns: [/activecampaign\.com/i] },
  { tool: "Shopify", patterns: [/cdn\.shopify\.com/i, /Shopify\.theme/i] },
  { tool: "WordPress", patterns: [/wp-content\//i, /wp-includes\//i] },
  { tool: "Webflow", patterns: [/webflow\.com/i, /webflow\.io/i] },
  { tool: "Wix", patterns: [/static\.wixstatic\.com/i] },
  { tool: "Unbounce", patterns: [/unbounce\.com/i] },
  { tool: "Typeform", patterns: [/typeform\.com/i] },
];

export function fingerprintStack(html: string | null | undefined): string[] {
  if (!html) return [];
  const out = new Set<string>();
  for (const { tool, patterns } of SIGNATURES) {
    for (const re of patterns) {
      if (re.test(html)) { out.add(tool); break; }
    }
  }
  return Array.from(out).sort();
}
