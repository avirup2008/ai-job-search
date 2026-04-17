import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---------------------------------------------------------------

const delCalls: Array<{ urls: string | string[]; at: number }> = [];
const dbDeleteCalls: Array<{ table: unknown; at: number }> = [];
let callOrderCounter = 0;

const mockDel = vi.fn(async (urls: string | string[]) => {
  delCalls.push({ urls, at: ++callOrderCounter });
});

// A minimal fake drizzle `db` with a pluggable query pipeline.
// Tests set `fakeRows` to drive what `selectPurgeCandidates` sees.
type FakeAppRow = {
  jobId: string;
  applicationId: string;
  status: string;
  lastEventAt: Date;
};
type FakeDocRow = {
  id: string;
  applicationId: string;
  blobUrlDocx: string | null;
  blobUrlPdf: string | null;
};

let fakeApps: FakeAppRow[] = [];
let fakeDocs: FakeDocRow[] = [];

// Drizzle `db.select(...).from(...).where?(...).?` returns an awaitable with rows.
// We model it as a thenable that resolves to the appropriate fake data based
// on the table passed to `.from()`.
function makeSelectChain(table: unknown) {
  const result = {
    from(_t: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const self: any = {
        where(_w: unknown) { return self; },
        then(resolve: (rows: unknown[]) => void) {
          // Identify which table was selected from
          // We stash a `__kind` marker on each fake table ref.
          const kind = (_t as { __kind?: string } | undefined)?.__kind;
          if (kind === "applications") {
            resolve(fakeApps.map((a) => ({
              jobId: a.jobId,
              applicationId: a.applicationId,
              status: a.status,
              lastEventAt: a.lastEventAt,
            })));
          } else if (kind === "documents") {
            // Filter by applicationIds if a where was applied — for simplicity,
            // return all and let the tests use scenarios where this is fine.
            resolve(fakeDocs.map((d) => ({
              id: d.id,
              applicationId: d.applicationId,
              blobUrlDocx: d.blobUrlDocx,
              blobUrlPdf: d.blobUrlPdf,
            })));
          } else {
            resolve([]);
          }
        },
      };
      return self;
    },
  };
  void table;
  return result;
}

const fakeDb = {
  select: (_cols?: unknown) => ({
    from(t: unknown) {
      return makeSelectChain(t).from(t);
    },
  }),
  delete: (table: unknown) => {
    const chain = {
      where(_w: unknown) {
        dbDeleteCalls.push({ table, at: ++callOrderCounter });
        return Promise.resolve();
      },
    };
    return chain;
  },
};

vi.mock("@vercel/blob", () => ({
  del: (urls: string | string[]) => mockDel(urls),
}));

vi.mock("@/db", () => {
  // Tag the schema tables so our fake select can distinguish them.
  const applicationsTable = { __kind: "applications" };
  const documentsTable = { __kind: "documents" };
  const jobsTable = { __kind: "jobs" };
  return {
    db: fakeDb,
    schema: {
      applications: applicationsTable,
      documents: documentsTable,
      jobs: jobsTable,
    },
  };
});

// drizzle-orm helpers are called but results are never inspected by the fake db.
vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    inArray: (..._a: unknown[]) => ({ __op: "inArray" }),
    lt: (..._a: unknown[]) => ({ __op: "lt" }),
    eq: (..._a: unknown[]) => ({ __op: "eq" }),
    and: (..._a: unknown[]) => ({ __op: "and" }),
  };
});

// --- Test helpers --------------------------------------------------------

const NOW = new Date("2026-04-17T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function resetFakes() {
  fakeApps = [];
  fakeDocs = [];
  delCalls.length = 0;
  dbDeleteCalls.length = 0;
  callOrderCounter = 0;
  mockDel.mockClear();
}

// --- Tests ---------------------------------------------------------------

describe("selectPurgeCandidates", () => {
  beforeEach(() => { resetFakes(); });

  it("Test 1: includes a job whose only application is rejected and idle 61d", async () => {
    fakeApps = [
      { jobId: "job-1", applicationId: "app-1", status: "rejected", lastEventAt: daysAgo(61) },
    ];
    const { selectPurgeCandidates } = await import("@/lib/retention/purge");
    const result = await selectPurgeCandidates(NOW);
    expect(result.jobIds).toContain("job-1");
    expect(result.applicationIds).toContain("app-1");
  });

  it("Test 2: excludes a job with status 'applied' even if idle 500d", async () => {
    fakeApps = [
      { jobId: "job-2", applicationId: "app-2", status: "applied", lastEventAt: daysAgo(500) },
    ];
    const { selectPurgeCandidates } = await import("@/lib/retention/purge");
    const result = await selectPurgeCandidates(NOW);
    expect(result.jobIds).not.toContain("job-2");
  });

  it("Test 3: excludes a mixed-status job that has any application in applied/interviewing/offered", async () => {
    fakeApps = [
      { jobId: "job-3", applicationId: "app-3a", status: "rejected", lastEventAt: daysAgo(200) },
      { jobId: "job-3", applicationId: "app-3b", status: "interviewing", lastEventAt: daysAgo(200) },
    ];
    const { selectPurgeCandidates } = await import("@/lib/retention/purge");
    const result = await selectPurgeCandidates(NOW);
    expect(result.jobIds).not.toContain("job-3");
  });

  it("Test 4: excludes a rejected job idle only 59d (inside the 60d window)", async () => {
    fakeApps = [
      { jobId: "job-4", applicationId: "app-4", status: "rejected", lastEventAt: daysAgo(59) },
    ];
    const { selectPurgeCandidates } = await import("@/lib/retention/purge");
    const result = await selectPurgeCandidates(NOW);
    expect(result.jobIds).not.toContain("job-4");
  });
});

describe("purgeOldJobs", () => {
  beforeEach(() => { resetFakes(); });

  it("Test 5: dryRun=true returns counts but calls zero del() and zero db.delete()", async () => {
    fakeApps = [
      { jobId: "job-5", applicationId: "app-5", status: "rejected", lastEventAt: daysAgo(100) },
    ];
    fakeDocs = [
      { id: "doc-5", applicationId: "app-5", blobUrlDocx: "https://blob/x.docx", blobUrlPdf: null },
    ];
    const { purgeOldJobs } = await import("@/lib/retention/purge");
    const result = await purgeOldJobs({ dryRun: true, now: NOW });

    expect(result.dryRun).toBe(true);
    expect(result.jobsDeleted).toBe(1);
    expect(result.applicationsDeleted).toBe(1);
    expect(result.documentsDeleted).toBe(1);
    expect(result.blobsDeleted).toBe(1);
    expect(mockDel).not.toHaveBeenCalled();
    expect(dbDeleteCalls.length).toBe(0);
  });

  it("Test 6: dryRun=false calls del() BEFORE db.delete(jobs)", async () => {
    fakeApps = [
      { jobId: "job-6", applicationId: "app-6", status: "rejected", lastEventAt: daysAgo(100) },
    ];
    fakeDocs = [
      { id: "doc-6a", applicationId: "app-6", blobUrlDocx: "https://blob/a.docx", blobUrlPdf: "https://blob/a.pdf" },
    ];
    const { purgeOldJobs } = await import("@/lib/retention/purge");
    const result = await purgeOldJobs({ dryRun: false, now: NOW });

    expect(result.dryRun).toBe(false);
    expect(mockDel).toHaveBeenCalledTimes(1);
    expect(dbDeleteCalls.length).toBeGreaterThanOrEqual(1);

    const firstDelAt = delCalls[0].at;
    const firstDbDeleteAt = dbDeleteCalls[0].at;
    expect(firstDelAt).toBeLessThan(firstDbDeleteAt);
  });

  it("Test 7: tolerates documents with null blob urls (no throw, no spurious del calls)", async () => {
    fakeApps = [
      { jobId: "job-7", applicationId: "app-7", status: "discarded", lastEventAt: daysAgo(100) },
    ];
    fakeDocs = [
      { id: "doc-7", applicationId: "app-7", blobUrlDocx: null, blobUrlPdf: null },
    ];
    const { purgeOldJobs } = await import("@/lib/retention/purge");
    const result = await purgeOldJobs({ dryRun: false, now: NOW });

    expect(result.documentsDeleted).toBe(1);
    expect(result.blobsDeleted).toBe(0);
    // When there are zero URLs, we should not call del() with an empty array either.
    // (Implementation may choose to skip the call entirely — both are acceptable,
    // but we assert the safer no-call behavior to avoid relying on del()'s empty-array handling.)
    expect(mockDel).not.toHaveBeenCalled();
  });
});
