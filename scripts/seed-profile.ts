// scripts/seed-profile.ts — one-shot seed. Safe to re-run; uses upsert semantics.
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import type { Profile } from "@/lib/profile/types";

const PROFILE: Profile = {
  roles: [
    {
      company: "Inbox Storage BV",
      title: "Marketing Operations Support",
      dates: "May 2025 — Present",
      context: "Dutch self-storage scale-up. Sole marketing hire owning full marketing + CRM stack: automation, demand gen, SEO, content, paid media.",
      achievements: [
        "Redesigned HubSpot lifecycle architecture — contact properties, lifecycle stage mapping, automated segmentation rules — giving team first-time visibility across 2,055 qualified leads supporting 202 bookings in Q3 2025",
        "Built 5-email MQL nurture workflow (30 min → 2 days → 5 days → 10 days → 25 days) with conditional exit triggers, automatic cold lead classification, A/B testing",
        "Designed Trustpilot review acquisition workflow: HubSpot ticket pipeline → Trustpilot review request automation → pre-outreach email priming",
        "Integrated HubSpot with Meta Business Suite, Unbounce, Aircall — unified CRM view",
        "Improved website SEO health from 43% to 90% via AI-assisted audit, SEMrush backlink analysis, dev-team direction",
        "Configured GA4 + GTM for Unbounce landing pages",
        "Meta lead-gen campaigns: 212 leads at €1.29 CPL",
        "Unbounce landing pages: 5.5% visit-to-form-fill conversion",
        "Grew organic social reach to 6,000 monthly views in 5 months (Instagram + LinkedIn + Facebook)",
      ],
    },
    {
      company: "Graduate Management Admission Council (GMAC)",
      title: "Marketing Manager, India | Marketing Specialist, Europe (Freelance)",
      dates: "Nov 2021 — Dec 2024",
      context: "Global B2B org running the GMAT exam. Delivered multi-market campaigns, events, and GTM across 7 markets (UK, France, Germany, Italy, Spain, Finland, Denmark, India).",
      achievements: [
        "Women in Business campaign end-to-end — HubSpot landing page, email campaign at 64% open rate, agent-network distribution",
        "GMAT European Scholarship campaign — 5.6% CTR; reviewed 20+ scholarship entries at shortlisting",
        "Monthly webinars: 90 registrations UK/Europe, 450 registrations + 100-120 attendees India",
        "Co-hosted partner webinars with HEC Paris, BITS Pilani, ISB",
        "Contributed to GMAT Focus Edition GTM — institution seminars India, trainer education webinars Europe",
        "Represented GMAC at QS, MBA Tour, Access MBA fairs across 7 markets",
      ],
    },
    {
      company: "British Council — India",
      title: "Operations Executive → Operations Manager → Project Manager → Higher Education Marketing",
      dates: "Aug 2015 — Dec 2021",
      context: "6 years across 3 departments. IELTS operations, government-partnered project management, education marketing.",
      achievements: [
        "Mo School initiative with Odisha State Government — upskilled 300 primary-school teachers in English-teaching methodology; delivered 4 large training events over 2 years",
        "Northeast India teacher-training programme across 7 states — 900 teachers, goal of 100 teacher-educator cohort for sustainability",
        "Promoted Study in UK programmes across India — alumni groups, employability workshops",
        "Managed IELTS pre-test operations West + North India — logistics, scheduling, freelancer management",
      ],
    },
  ],

  achievements: [
    { metric: "2,055 leads → 202 bookings Q3 2025", context: "Inbox Storage — HubSpot lifecycle architecture redesign", toolStack: ["HubSpot"], narrative: "First-time pipeline visibility via contact properties + lifecycle stage mapping + segmentation rules" },
    { metric: "5.5% visit-to-form-fill conversion", context: "Inbox Storage — Unbounce landing pages", toolStack: ["Unbounce"], narrative: "Conversion-focused layout + brand-consistent execution + form integration" },
    { metric: "€1.29 cost-per-lead × 212 leads", context: "Inbox Storage — Meta lead-gen campaigns", toolStack: ["Meta Ads"], narrative: "Daily budget + audience targeting management across Facebook + Instagram" },
    { metric: "SEO health 43% → 90%", context: "Inbox Storage — technical SEO audit + cleanup", toolStack: ["SEMrush", "GSC"], narrative: "AI-assisted audit of schema, alt text, heading structure, duplicate pages + SEMrush backlink analysis + dev-team direction" },
    { metric: "64% email open rate", context: "GMAC — Women in Business campaign", toolStack: ["HubSpot"], narrative: "Panel sourcing + HubSpot landing page + social content + agent-network distribution" },
    { metric: "5.6% CTR", context: "GMAC — GMAT European Scholarship email + webinar campaign", toolStack: ["HubSpot"], narrative: "" },
    { metric: "6,000 monthly views in 5 months, from near-zero", context: "Inbox Storage — organic social (IG+LI+FB)", toolStack: [], narrative: "Structured multi-platform content strategy" },
    { metric: "900 teachers upskilled across 7 NE India states", context: "British Council — Northeast India teacher training", toolStack: [], narrative: "Goal: 100 teacher-educator cohort for cascade sustainability" },
  ],

  toolStack: {
    "HubSpot": "Expert — lifecycle architecture, workflow automation, ticket pipelines, CRM property design, Trustpilot integration",
    "HubSpot Marketing Hub": "Expert — email nurture, segmentation, A/B testing",
    "Google Analytics 4": "Proficient — event tracking, funnel analysis, reporting",
    "Google Tag Manager": "Proficient — containers, triggers, tags",
    "Google Search Console": "Proficient",
    "SEMrush": "Proficient — backlink analysis, technical SEO",
    "Looker Studio": "Basic",
    "Meta Ads (FB + IG)": "Proficient — lead gen, audience targeting, budget management",
    "Unbounce": "Proficient — landing-page design, conversion optimization",
    "Canva": "Proficient",
    "Figma": "Proficient",
    "Adobe": "Basic",
    "Shopify": "Basic",
    "Sanity CMS": "Basic",
    "WordPress": "Proficient",
    "Aircall": "Integration experience",
    "Trustpilot": "Integration + campaign automation",
  },

  industries: [
    "B2B SaaS",
    "Scale-ups",
    "Self-storage / consumer services",
    "Education / ed-tech",
    "International / multi-market",
  ],

  stories: [],

  constraints: {
    location: "Beverwijk, Netherlands",
    dutchLevel: "A2",
    sponsorNeeded: false,
    commuteMaxMinutesCar: 30,
    commuteMaxMinutesTrain: 60,
    availability: "immediate",
  },

  preferences: {
    salaryFloorEur: null,
    vetoCompanies: [],
    roleFamilies: [
      "Marketing Automation",
      "CRM Marketing",
      "Email Marketing",
      "Digital Marketing",
      "Growth Marketing",
      "Marketing Operations",
    ],
    workModes: ["hybrid", "remote", "onsite"],
    languagesAccepted: ["English"],
    companyStagePreference: ["scale-up", "mid-market", "startup"],
    industryAntiPreference: [],
  },

  portfolioUrl: "https://upashana.online",
  linkedinUrl: "https://www.linkedin.com/in/upashana-borpuzari/",
  contactEmail: "upashana1910@gmail.com",
  phone: "+31 613 970 398",
};

async function main() {
  loadDbEnv();
  const existing = await db.select({ id: schema.profile.id }).from(schema.profile).limit(1);
  const payload = {
    roles: PROFILE.roles as unknown,
    achievements: PROFILE.achievements as unknown,
    toolStack: PROFILE.toolStack as unknown,
    industries: PROFILE.industries as unknown,
    stories: PROFILE.stories as unknown,
    constraints: PROFILE.constraints as unknown,
    preferences: PROFILE.preferences as unknown,
    portfolioUrl: PROFILE.portfolioUrl ?? null,
    linkedinUrl: PROFILE.linkedinUrl ?? null,
    updatedAt: sql`now()`,
    updatedBy: "seed-script",
  };
  if (existing.length > 0) {
    await db.update(schema.profile).set(payload).where(eq(schema.profile.id, existing[0].id));
    console.log(`✓ Updated existing profile row (id=${existing[0].id})`);
  } else {
    const [inserted] = await db.insert(schema.profile).values(payload).returning({ id: schema.profile.id });
    console.log(`✓ Inserted new profile row (id=${inserted.id})`);
  }
}

function loadDbEnv() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Source .env.local and export DATABASE_URL before running this script.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
