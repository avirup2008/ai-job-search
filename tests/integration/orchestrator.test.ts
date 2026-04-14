import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { JobSource, RawJob } from "@/lib/sources/types";

// Mock sources to avoid network + mock LLM to avoid real API cost.
vi.mock("@/lib/sources", () => {
  const fakeSource: JobSource = {
    name: "fake",
    async fetch() {
      const now = new Date();
      return [
        // Strong match
        {
          source: "fake", sourceExternalId: "f-strong",
          sourceUrl: "https://x/f-strong",
          title: "Marketing Automation Manager",
          jdText: "HubSpot lifecycle, email nurture, segmentation. English-speaking team in Amsterdam.",
          companyName: "Test Strong Co", companyDomain: null,
          location: "Amsterdam, NL", postedAt: now,
        } satisfies RawJob,
        // Dutch-required — should be hard-filtered
        {
          source: "fake", sourceExternalId: "f-dutch",
          sourceUrl: "https://x/f-dutch",
          title: "Marketing Manager",
          jdText: "Vloeiend Nederlands vereist.",
          companyName: "Test Dutch Co", companyDomain: null,
          location: "Amsterdam, NL", postedAt: now,
        } satisfies RawJob,
        // VP — should be hard-filtered for seniority
        {
          source: "fake", sourceExternalId: "f-vp",
          sourceUrl: "https://x/f-vp",
          title: "VP of Marketing",
          jdText: "Senior leadership role.",
          companyName: "Test VP Co", companyDomain: null,
          location: "Amsterdam, NL", postedAt: now,
        } satisfies RawJob,
      ];
    },
  };
  return { allSources: () => [fakeSource] };
});

// Mock rank to avoid real Haiku calls
vi.mock("@/lib/pipeline/rank", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pipeline/rank")>();
  return {
    ...actual,
    assessJob: vi.fn(async ({ jobTitle }: { jobTitle: string }) => {
      // Return a deterministic assessment based on title
      const isStrong = /automation|crm/i.test(jobTitle);
      return {
        fitScore: isStrong ? 90 : 55,
        components: {
          skills: isStrong ? 0.9 : 0.5,
          tools: isStrong ? 0.95 : 0.5,
          seniority: 0.9, geo: 1, industry: 0.6,
        },
        assessment: {
          tools: ["HubSpot"],
          seniorityLevel: "manager" as const,
          dutchRequired: false,
          industries: ["SaaS"],
          locationText: "Amsterdam",
          components: {
            skills: isStrong ? 0.9 : 0.5,
            tools: isStrong ? 0.95 : 0.5,
            seniority: 0.9, geo: 1, industry: 0.6,
          },
          strengths: ["HubSpot expert"],
          gaps: [],
          recommendation: isStrong ? "strong_apply" as const : "apply_with_caveat" as const,
          recommendationReason: "Test reason.",
        },
      };
    }),
  };
});

async function cleanFixtures() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "");
  await sql`DELETE FROM applications WHERE job_id IN (SELECT id FROM jobs WHERE source='fake')`;
  await sql`DELETE FROM jobs WHERE source='fake'`;
  await sql`DELETE FROM companies WHERE name LIKE 'Test % Co'`;
}

describe("runNightly orchestrator", () => {
  beforeEach(async () => {
    if (process.env.RUN_INTEGRATION) await cleanFixtures();
  });
  afterAll(async () => {
    if (process.env.RUN_INTEGRATION) await cleanFixtures();
  });

  it("processes mocked sources end-to-end and persists to Neon", async () => {
    if (!process.env.RUN_INTEGRATION) {
      console.log("skipped — set RUN_INTEGRATION=1");
      return;
    }
    const { runNightly } = await import("@/lib/pipeline/orchestrator");
    const s = await runNightly();

    expect(s.counts.discovered).toBe(3);
    expect(s.counts.clusters).toBe(3);      // 3 distinct companies
    expect(s.counts.filtered).toBe(2);       // dutch + vp
    expect(s.counts.ranked).toBe(1);         // only the strong match gets ranked
    expect(s.counts.byTier["1"]).toBe(1);    // 90 → T1

    expect(s.perSource).toHaveProperty("fake");
    expect(s.perSource.fake).toBe(3);

    expect(s.errors).toEqual({});
  }, 60_000);

  it("is idempotent — re-run does not duplicate rows", async () => {
    if (!process.env.RUN_INTEGRATION) {
      console.log("skipped — set RUN_INTEGRATION=1");
      return;
    }
    const { runNightly } = await import("@/lib/pipeline/orchestrator");
    const first = await runNightly();
    const second = await runNightly();

    // Second run should insert 0 new job rows (all unique constraint collisions)
    // The orchestrator should report this in its summary or at least not throw.
    expect(first.counts.inserted).toBeGreaterThanOrEqual(1);
    expect(second.counts.inserted).toBe(0);
  }, 120_000);
});
