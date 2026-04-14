import { describe, it, expect, vi, beforeEach } from "vitest";

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
