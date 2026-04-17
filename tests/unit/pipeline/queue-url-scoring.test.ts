/**
 * Tests for Step 0.5: nightly orchestrator scoring of queued url_paste rows (R-82).
 *
 * Strategy: mock all external dependencies (DB, LLM rank, CV generation, discover)
 * then call runNightly() and assert on the DB operations and returned RunSummary.
 *
 * The @/db mock uses a module-level selectCallCount so each runNightly() call
 * walks the same call sequence:
 *   call 0 → profile load
 *   call 1 → Step 0.5 queued rows select
 *   calls 2+ → re-score pass selects (return empty to keep tests minimal)
 *
 * beforeEach resets selectCallCount and the per-test state variables.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Shared mock state — mutated per test in beforeEach, read inside vi.mock factories
// ---------------------------------------------------------------------------

let queuedRows: { id: string; title: string; jdText: string }[] = [];
let assessJobResult: {
  fitScore: number;
  components: Record<string, number>;
  assessment: {
    strengths: string[];
    gaps: string[];
    recommendation: string;
    recommendationReason: string;
    seniorityLevel: string;
  };
} | null = null;
let assessJobShouldThrow = false;
let dbSelectCallCount = 0;
const dbUpdates: unknown[] = [];
const dbApplicationInserts: unknown[] = [];

// ---------------------------------------------------------------------------
// vi.mock calls — hoisted by vitest; factories run lazily on first import.
// All helpers used inside factories must be defined before this block
// OR reference module-level variables that are set before each test.
// ---------------------------------------------------------------------------

vi.mock("@/lib/pipeline/discover", () => ({
  discover: async () => ({ jobs: [], perSource: {}, errors: {} }),
}));

vi.mock("@/lib/pipeline/dedupe", () => ({
  clusterJobs: () => [],
  computeDedupeHash: () => "hash",
}));

vi.mock("@/lib/pipeline/filters", () => ({
  applyHardFilters: () => ({ filter: null }),
}));

vi.mock("@/lib/scoring/multipliers", () => ({
  readMultipliersFromProfile: () => ({}),
  blendFitScoreWithMultipliers: () => 50,
}));

vi.mock("@/lib/scoring/drift", () => ({
  detectDrift: () => ({ drifted: false, delta: 0 }),
}));

vi.mock("@/lib/generate/cv", () => ({
  generateCV: async () => ({ cv: {}, costEur: 0 }),
}));

vi.mock("@/lib/generate/cv-docx", () => ({
  renderCvDocx: async () => Buffer.from(""),
}));

vi.mock("@/lib/generate/storage", () => ({
  storeCv: async () => {},
}));

vi.mock("@/lib/pipeline/rank", () => ({
  assessJob: async () => {
    if (assessJobShouldThrow) throw new Error("LLM failure");
    if (!assessJobResult) throw new Error("assessJobResult not configured for this test");
    return assessJobResult;
  },
}));

vi.mock("@/lib/pipeline/tier", () => ({
  assignTier: (score: number) => {
    if (isNaN(score) || score < 40) return null;
    if (score >= 85) return 1;
    if (score >= 65) return 2;
    return 3;
  },
}));

vi.mock("@/db", async () => {
  // Infinite-depth proxy: schema.jobs.id etc. never throws, just returns another proxy
  function makeProxy(): unknown {
    return new Proxy(
      {},
      { get: (_t, _k) => makeProxy() },
    );
  }

  const schema = makeProxy();

  // thenable + .limit() helper — supports:
  //   await db.select().from().where()
  //   await db.select().from().where().limit()
  function thenable(result: unknown[]): Promise<unknown[]> & { limit: () => Promise<unknown[]> } {
    const p = Promise.resolve(result);
    return Object.assign(p, { limit: () => Promise.resolve(result) });
  }

  const PROFILE_ROW = {
    fullName: "Test User",
    headline: null,
    roles: [],
    achievements: [],
    toolStack: {},
    industries: [],
    stories: [],
    constraints: {},
    preferences: {},
    portfolioUrl: null,
    linkedinUrl: null,
    contactEmail: null,
    phone: null,
  };

  const db = {
    execute: async () => ({ rowCount: 0 }),

    select: (_fields?: unknown) => {
      const callIdx = dbSelectCallCount++;
      return {
        from: (_table: unknown) => {
          // The result for this select call
          // call 0 = profile (uses .limit())
          // call 1 = Step 0.5 queued rows (uses .where() with no .limit())
          // call 2 = existingRows for dedup pre-pass (direct await on .from())
          // calls 3+ = re-score existingRanked and needsCv queries

          let resolvedResult: unknown[];
          if (callIdx === 0) resolvedResult = [PROFILE_ROW];
          else if (callIdx === 1) resolvedResult = queuedRows;
          else resolvedResult = [];

          // Make from() itself thenable (for `await db.select().from()`)
          // and support all Drizzle chaining methods the orchestrator uses.
          const joinChain = {
            innerJoin: (_t: unknown, _c: unknown) => joinChain,
            leftJoin: (_t: unknown, _c: unknown) => joinChain,
            where: (_cond: unknown) => thenable(resolvedResult),
            limit: (_n: number) => Promise.resolve(resolvedResult),
            then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
              Promise.resolve(resolvedResult).then(resolve, reject),
          };
          const fromResult = Object.assign(Promise.resolve(resolvedResult), {
            limit: (_n: number) => Promise.resolve(resolvedResult),
            where: (_cond: unknown) => thenable(resolvedResult),
            innerJoin: (_t: unknown, _c: unknown) => joinChain,
            leftJoin: (_t: unknown, _c: unknown) => joinChain,
          });
          return fromResult;
        },
      };
    },

    insert: (_table: unknown) => ({
      values: (vals: unknown) => {
        // Capture application inserts at values() time (orchestrator Step 0.5
        // does `await db.insert(applications).values({...})` with no .returning())
        const v = vals as Record<string, unknown>;
        if (v.status === "new" && v.jobId) dbApplicationInserts.push(vals);

        // Return a thenable so `await db.insert().values()` resolves,
        // AND provide .returning() for callers that use it.
        const insertResult = v.status === "running"
          ? [{ id: "run-test" }]
          : [{ id: "item-test" }];
        return Object.assign(Promise.resolve(insertResult), {
          returning: () => Promise.resolve(insertResult),
        });
      },
    }),

    update: (_table: unknown) => ({
      set: (vals: unknown) => ({
        where: () => {
          dbUpdates.push(vals);
          return Promise.resolve();
        },
      }),
    }),
  };

  return { db, schema };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Orchestrator Step 0.5: score queued url_paste rows", () => {
  beforeEach(() => {
    // Reset call counter so every runNightly() call sees the same sequence
    dbSelectCallCount = 0;
    queuedRows = [];
    assessJobResult = null;
    assessJobShouldThrow = false;
    dbUpdates.length = 0;
    dbApplicationInserts.length = 0;
  });

  it("scores queued url_paste rows and clears hardFilterReason", async () => {
    queuedRows = [{ id: "job-1", title: "Senior Engineer", jdText: "Great role with Kubernetes" }];
    assessJobResult = {
      fitScore: 82,
      components: { skills: 0.9, tools: 0.8, seniority: 0.7, industry: 0.6 },
      assessment: {
        strengths: ["Strong backend skills"],
        gaps: ["No Go experience"],
        recommendation: "apply",
        recommendationReason: "Good fit",
        seniorityLevel: "senior",
      },
    };

    const { runNightly } = await import("@/lib/pipeline/orchestrator");
    const summary = await runNightly();

    expect(summary.counts.queuedScored).toBe(1);
    expect(summary.counts.queuedFailed).toBe(0);

    // DB update should clear hardFilterReason and write fit data
    const jobUpdate = dbUpdates.find(
      (u) => (u as Record<string, unknown>).hardFilterReason === null,
    ) as Record<string, unknown> | undefined;
    expect(jobUpdate).toBeDefined();
    expect(jobUpdate!.fitScore).toBe("82");
    expect(jobUpdate!.tier).toBe(2); // 82 → tier 2

    // Applications row created for non-null tier
    expect(dbApplicationInserts).toHaveLength(1);
    expect((dbApplicationInserts[0] as Record<string, unknown>).status).toBe("new");
  });

  it("leaves hardFilterReason='queued' on assessJob failure", async () => {
    queuedRows = [{ id: "job-fail", title: "Data Engineer", jdText: "Spark and Kafka role" }];
    assessJobShouldThrow = true;

    const { runNightly } = await import("@/lib/pipeline/orchestrator");
    const summary = await runNightly();

    expect(summary.counts.queuedScored).toBe(0);
    expect(summary.counts.queuedFailed).toBe(1);

    // No update cleared hardFilterReason
    const clearedUpdate = dbUpdates.find(
      (u) => (u as Record<string, unknown>).hardFilterReason === null,
    );
    expect(clearedUpdate).toBeUndefined();

    // No application row
    expect(dbApplicationInserts).toHaveLength(0);
  });

  it("assigns tier=null and creates no application when fitScore below threshold", async () => {
    queuedRows = [{ id: "job-low", title: "Intern Role", jdText: "Junior position" }];
    assessJobResult = {
      fitScore: 20,
      components: { skills: 0.2, tools: 0.2, seniority: 0.1, industry: 0.1 },
      assessment: {
        strengths: [],
        gaps: ["Too junior"],
        recommendation: "skip",
        recommendationReason: "Below threshold",
        seniorityLevel: "junior",
      },
    };

    const { runNightly } = await import("@/lib/pipeline/orchestrator");
    const summary = await runNightly();

    expect(summary.counts.queuedScored).toBe(1);
    expect(summary.counts.queuedFailed).toBe(0);

    const jobUpdate = dbUpdates.find(
      (u) => (u as Record<string, unknown>).hardFilterReason === null,
    ) as Record<string, unknown> | undefined;
    expect(jobUpdate).toBeDefined();
    expect(jobUpdate!.tier).toBeNull(); // score 20 < 40 → null tier

    // No application — tier is null
    expect(dbApplicationInserts).toHaveLength(0);
  });

  it("counters queuedScored and queuedFailed present in RunSummary.counts", async () => {
    queuedRows = [];

    const { runNightly } = await import("@/lib/pipeline/orchestrator");
    const summary = await runNightly();

    expect(summary.counts).toHaveProperty("queuedScored");
    expect(summary.counts).toHaveProperty("queuedFailed");
    expect(typeof summary.counts.queuedScored).toBe("number");
    expect(typeof summary.counts.queuedFailed).toBe("number");
  });
});
