import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockLoadCronEnv = vi.fn();
const mockIsAdmin = vi.fn();
const mockRunNightly = vi.fn();
const mockDbExecute = vi.fn();


vi.mock("@/lib/env", () => ({
  loadCronEnv: () => mockLoadCronEnv(),
  loadAdminEnv: () => ({ ADMIN_SECRET: "x".repeat(32) }),
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdmin: () => mockIsAdmin(),
}));

vi.mock("@/lib/pipeline/orchestrator", () => ({
  runNightly: () => mockRunNightly(),
}));

vi.mock("@/db", () => ({
  db: { execute: (...a: unknown[]) => mockDbExecute(...a) },
}));

describe("GET /api/cron/nightly", () => {
  beforeEach(() => {
    mockLoadCronEnv.mockReset();
    mockRunNightly.mockReset();
    mockLoadCronEnv.mockReturnValue({ CRON_SECRET: "cron-secret-padded-to-32-characters!!" });
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { GET } = await import("@/app/api/cron/nightly/route");
    const req = new Request("https://x/api/cron/nightly");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header is wrong", async () => {
    const { GET } = await import("@/app/api/cron/nightly/route");
    const req = new Request("https://x/api/cron/nightly", { headers: { authorization: "Bearer wrong" } });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("runs and returns summary on correct auth", async () => {
    mockRunNightly.mockResolvedValue({ runId: "r1", counts: { discovered: 1 } });
    const { GET } = await import("@/app/api/cron/nightly/route");
    const req = new Request("https://x/api/cron/nightly", {
      headers: { authorization: "Bearer cron-secret-padded-to-32-characters!!" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.summary.runId).toBe("r1");
  });

  it("returns 500 when runNightly throws", async () => {
    mockRunNightly.mockRejectedValue(new Error("boom"));
    const { GET } = await import("@/app/api/cron/nightly/route");
    const req = new Request("https://x/api/cron/nightly", {
      headers: { authorization: "Bearer cron-secret-padded-to-32-characters!!" },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/boom/);
  });
});

describe("POST /api/admin/trigger-run", () => {
  beforeEach(() => {
    mockIsAdmin.mockReset();
    mockRunNightly.mockReset();
  });

  it("returns 403 when not admin", async () => {
    mockIsAdmin.mockResolvedValue(false);
    const { POST } = await import("@/app/api/admin/trigger-run/route");
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("runs and returns summary when admin", async () => {
    mockIsAdmin.mockResolvedValue(true);
    mockRunNightly.mockResolvedValue({ runId: "r2", counts: {} });
    const { POST } = await import("@/app/api/admin/trigger-run/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.runId).toBe("r2");
  });
});

describe("GET /api/health", () => {
  beforeEach(() => {
    mockDbExecute.mockReset();
  });

  it("returns ok when DB query succeeds", async () => {
    mockDbExecute.mockResolvedValue([{ ok: 1 }]);
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ts).toBeDefined();
  });

  it("returns 500 when DB query throws", async () => {
    mockDbExecute.mockRejectedValue(new Error("conn lost"));
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/queue-url tests
// ---------------------------------------------------------------------------
// These tests use vi.resetModules() + vi.doMock() to get a fresh module
// registry per test, bypassing the hoisted top-level vi.mock("@/db").
// Each test sets up its own DB stub via vi.doMock before importing the route.

const mockAssessJobQueueUrl = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/lib/pipeline/rank", () => ({
  assessJob: (...args: unknown[]) => mockAssessJobQueueUrl(...args),
}));

vi.mock("@/lib/pipeline/dedupe", () => ({
  computeDedupeHash: () => "test-dedupe-hash",
}));

// Infinite-depth proxy: any property access returns another proxy.
// Used to stub drizzle schema table/column references so eq(schema.jobs.id, x)
// doesn't throw — it just returns a proxy that gets passed to our mock where().
function makeSchemaProxy(): Record<string, unknown> {
  return new Proxy({} as Record<string, unknown>, {
    get: (_t, _k) => makeSchemaProxy(),
  });
}

// Build a chainable drizzle select stub where each sequential select call
// returns a different result from the provided results array.
function makeDb(selectResults: unknown[][], insertResult: unknown[], insertedValues?: unknown[]) {
  let selectCallCount = 0;
  return {
    select: () => {
      const callIdx = selectCallCount++;
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(selectResults[callIdx] ?? []),
          }),
          limit: () => Promise.resolve(selectResults[callIdx] ?? []),
        }),
      };
    },
    insert: () => ({
      values: (vals: unknown) => {
        if (insertedValues) insertedValues.push(vals);
        return {
          returning: () => Promise.resolve(insertResult),
        };
      },
    }),
  };
}

const stubSchema = makeSchemaProxy();

describe("POST /api/queue-url", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAssessJobQueueUrl.mockReset();
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("t1 - rejects missing url field", async () => {
    vi.doMock("@/db", () => ({ db: makeDb([], []), schema: stubSchema }));
    const { POST } = await import("@/app/api/queue-url/route");
    const req = new Request("https://x/api/queue-url", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing required field: url/);
  });

  it("t2 - rejects LinkedIn URLs", async () => {
    vi.doMock("@/db", () => ({ db: makeDb([], []), schema: stubSchema }));
    const { POST } = await import("@/app/api/queue-url/route");
    const req = new Request("https://x/api/queue-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://www.linkedin.com/jobs/view/12345" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/LinkedIn/);
  });

  it("t3 - rejects non-http scheme", async () => {
    vi.doMock("@/db", () => ({ db: makeDb([], []), schema: stubSchema }));
    const { POST } = await import("@/app/api/queue-url/route");
    const req = new Request("https://x/api/queue-url", {
      method: "POST",
      body: JSON.stringify({ url: "ftp://example.com/job" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/http/);
  });

  it("t4 - rejects private hosts (SSRF)", async () => {
    vi.doMock("@/db", () => ({ db: makeDb([], []), schema: stubSchema }));
    const { POST } = await import("@/app/api/queue-url/route");
    const req = new Request("https://x/api/queue-url", {
      method: "POST",
      body: JSON.stringify({ url: "http://127.0.0.1/job" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("t5 - inserts queued row with hardFilterReason='queued'", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => "<html><body><h1>Software Engineer</h1><p>Company: Acme Corp. Great role.</p></body></html>",
    });

    const insertedValues: unknown[] = [];
    // selectResults: [0] = dedup miss (jobs), [1] = company found
    vi.doMock("@/db", () => ({
      db: makeDb([[], [{ id: "co-1" }]], [{ id: "job-id-new" }], insertedValues),
      schema: stubSchema,
    }));

    const { POST } = await import("@/app/api/queue-url/route");
    const req = new Request("https://x/api/queue-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/jobs/123" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.queued).toBe(true);
    expect(body.alreadyQueued).toBe(false);

    // Verify the insert received correct sentinel values
    const jobInsert = insertedValues.find(
      (v) => (v as Record<string, unknown>).source === "url_paste"
    ) as Record<string, unknown> | undefined;
    expect(jobInsert).toBeDefined();
    expect(jobInsert!.hardFilterReason).toBe("queued");
    expect(jobInsert!.tier).toBeNull();
    expect(jobInsert!.fitScore).toBeNull();
  });

  it("t6 - dedup returns existing jobId without re-inserting", async () => {
    const insertedValues: unknown[] = [];
    // selectResults: [0] = dedup HIT — existing job found
    vi.doMock("@/db", () => ({
      db: makeDb([[{ id: "existing-job-id" }]], [], insertedValues),
      schema: stubSchema,
    }));

    const { POST } = await import("@/app/api/queue-url/route");
    const req = new Request("https://x/api/queue-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/jobs/existing" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.alreadyQueued).toBe(true);
    expect(body.jobId).toBe("existing-job-id");
    // Ensure no insert was called (dedup short-circuit)
    expect(insertedValues).toHaveLength(0);
  });

  it("t7 - does NOT call assessJob", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => "<html><body><h1>Data Analyst</h1><p>Role at BigCo.</p></body></html>",
    });

    // selectResults: [0] = dedup miss, [1] = company found
    vi.doMock("@/db", () => ({
      db: makeDb([[], [{ id: "co-2" }]], [{ id: "new-job-2" }]),
      schema: stubSchema,
    }));

    const { POST } = await import("@/app/api/queue-url/route");
    const req = new Request("https://x/api/queue-url", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/jobs/analyst" }),
      headers: { "content-type": "application/json" },
    });
    await POST(req);
    expect(mockAssessJobQueueUrl).not.toHaveBeenCalled();
  });
});
