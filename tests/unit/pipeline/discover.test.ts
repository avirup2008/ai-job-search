import { describe, it, expect, vi } from "vitest";
import type { JobSource, RawJob } from "@/lib/sources/types";

// Mock the registry to inject deterministic test sources
vi.mock("@/lib/sources", () => {
  const fakeOk: JobSource = {
    name: "fake-ok",
    async fetch(): Promise<RawJob[]> {
      return [
        {
          source: "fake-ok",
          sourceExternalId: "1",
          sourceUrl: "https://x/1",
          title: "Marketing Automation Manager",
          jdText: "HubSpot role",
          companyName: "Test Co",
          companyDomain: null,
          location: "Amsterdam",
          postedAt: new Date(),
        },
      ];
    },
  };
  const fakeFail: JobSource = {
    name: "fake-fail",
    async fetch(): Promise<RawJob[]> {
      throw new Error("simulated upstream failure");
    },
  };
  const fakeEmpty: JobSource = {
    name: "fake-empty",
    async fetch(): Promise<RawJob[]> { return []; },
  };
  return { allSources: () => [fakeOk, fakeFail, fakeEmpty] };
});

describe("discover", () => {
  it("fans out all sources in parallel and returns combined jobs", async () => {
    const { discover } = await import("@/lib/pipeline/discover");
    const result = await discover();
    expect(result.jobs.length).toBe(1);
    expect(result.jobs[0].source).toBe("fake-ok");
  });

  it("records per-source counts, including zero and failure", async () => {
    const { discover } = await import("@/lib/pipeline/discover");
    const result = await discover();
    expect(result.perSource).toEqual({ "fake-ok": 1, "fake-fail": 0, "fake-empty": 0 });
  });

  it("captures per-source errors without failing the whole run", async () => {
    const { discover } = await import("@/lib/pipeline/discover");
    const result = await discover();
    expect(result.errors).toHaveProperty("fake-fail");
    expect(result.errors["fake-fail"]).toMatch(/simulated upstream failure/);
    expect(result.errors).not.toHaveProperty("fake-ok");
    expect(result.errors).not.toHaveProperty("fake-empty");
  });

  it("completes even when some sources throw", async () => {
    const { discover } = await import("@/lib/pipeline/discover");
    const r = await discover();
    expect(r.jobs).toBeDefined();
    expect(r.perSource).toBeDefined();
    expect(r.errors).toBeDefined();
  });
});

describe("discover timeout", () => {
  it("resolves timed-out sources to [] and records error", async () => {
    vi.resetModules();
    vi.doMock("@/lib/sources", () => ({
      allSources: () => [
        {
          name: "fast",
          fetch: async () => [
            {
              source: "fast",
              sourceExternalId: "1",
              sourceUrl: "http://a.com",
              title: "Fast Job",
              jdText: "",
              companyName: null,
              companyDomain: null,
              location: null,
              postedAt: null,
            },
          ],
        },
        {
          name: "slow",
          // never resolves — simulates a hung Apify actor
          fetch: () => new Promise(() => {}),
        },
      ],
    }));

    const { discover } = await import("@/lib/pipeline/discover");
    const result = await discover({ sourceTimeoutMs: 50 });

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].source).toBe("fast");
    expect(result.errors["slow"]).toMatch(/timeout/i);
    expect(result.perSource["slow"]).toBe(0);
    expect(result.perSource["fast"]).toBe(1);

  });
});
