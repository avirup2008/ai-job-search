import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: (_n: number) => mockSelect() }) }) }),
    insert: () => ({
      values: (_v: unknown) => ({
        onConflictDoUpdate: (_c: unknown) => mockInsert(),
      }),
    }),
  },
  schema: { researchCache: { scopeKey: "scope_key" } },
}));

vi.mock("drizzle-orm", () => ({ eq: () => "eq", sql: () => "sql" }));

describe("research cache", () => {
  beforeEach(() => { mockSelect.mockReset(); mockInsert.mockReset(); });

  it("readCached returns null on cache miss", async () => {
    mockSelect.mockResolvedValue([]);
    const { readCached } = await import("@/lib/research/cache");
    const res = await readCached("Acme Corp");
    expect(res).toBeNull();
  });

  it("readCached returns null when expired", async () => {
    const past = new Date(Date.now() - 1000);
    mockSelect.mockResolvedValue([{ content: { company: "X" }, expiresAt: past }]);
    const { readCached } = await import("@/lib/research/cache");
    expect(await readCached("Acme")).toBeNull();
  });

  it("readCached returns content when fresh", async () => {
    const future = new Date(Date.now() + 1000 * 3600);
    const dossier = { company: "Fresh Co" };
    mockSelect.mockResolvedValue([{ content: dossier, expiresAt: future }]);
    const { readCached } = await import("@/lib/research/cache");
    expect(await readCached("Fresh Co")).toEqual(dossier);
  });

  it("writeCached invokes insert with upsert", async () => {
    mockInsert.mockResolvedValue(undefined);
    const { writeCached } = await import("@/lib/research/cache");
    await writeCached("Acme", { company: "Acme", narrative: "x" } as never);
    expect(mockInsert).toHaveBeenCalled();
  });
});
