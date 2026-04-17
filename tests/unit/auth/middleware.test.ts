import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import nodeCrypto from "node:crypto";

// Compute the expected hex using Node's crypto — this is what the middleware's
// Web Crypto stub will return.
const TEST_PASSWORD = "test-password";
const expectedHex = nodeCrypto
  .createHash("sha256")
  .update(TEST_PASSWORD)
  .digest("hex");

// Convert the hex string to a Uint8Array so we can return it from the stub.
function hexToUint8Array(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}

// Stub globalThis.crypto.subtle.digest before the middleware module is imported.
// The middleware calls: crypto.subtle.digest("SHA-256", encoded)
// and converts the result ArrayBuffer to hex. We return the Uint8Array of
// expectedHex's bytes so the middleware computes the same hex string.
const digestSpy = vi.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(
  async (_algorithm: AlgorithmIdentifier, _data: BufferSource) => {
    const u8 = hexToUint8Array(expectedHex);
    return u8.buffer as ArrayBuffer;
  },
);

describe("middleware — unauthenticated page routes redirect to /", () => {
  let middleware: typeof import("@/middleware").middleware;

  beforeEach(async () => {
    process.env.DISHA_PASSWORD = TEST_PASSWORD;
    digestSpy.mockClear();
    // Fresh import each time since vi.mock is not used here
    vi.resetModules();
    const mod = await import("@/middleware");
    middleware = mod.middleware;
  });

  afterEach(() => {
    delete process.env.DISHA_PASSWORD;
  });

  async function makeRequest(path: string, cookie?: string) {
    const { NextRequest } = await import("next/server");
    const headers: Record<string, string> = {};
    if (cookie) headers["cookie"] = cookie;
    return new NextRequest(`https://app.test${path}`, { headers });
  }

  it("unauthenticated /inbox → redirects to /", async () => {
    const req = await makeRequest("/inbox");
    const res = await middleware(req);
    expect([301, 302, 307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toMatch(/\/$/);
  });

  it("unauthenticated /pipeline → redirects to /", async () => {
    const req = await makeRequest("/pipeline");
    const res = await middleware(req);
    expect([301, 302, 307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toMatch(/\/$/);
  });

  it("unauthenticated /analytics → redirects to /", async () => {
    const req = await makeRequest("/analytics");
    const res = await middleware(req);
    expect([301, 302, 307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toMatch(/\/$/);
  });

  it("unauthenticated /profile → redirects to /", async () => {
    const req = await makeRequest("/profile");
    const res = await middleware(req);
    expect([301, 302, 307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toMatch(/\/$/);
  });

  it("unauthenticated /budget → redirects to /", async () => {
    const req = await makeRequest("/budget");
    const res = await middleware(req);
    expect([301, 302, 307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toMatch(/\/$/);
  });

  it("unauthenticated /paste → redirects to /", async () => {
    const req = await makeRequest("/paste");
    const res = await middleware(req);
    expect([301, 302, 307, 308]).toContain(res.status);
    expect(res.headers.get("location")).toMatch(/\/$/);
  });
});

describe("middleware — unauthenticated API routes return 401", () => {
  let middleware: typeof import("@/middleware").middleware;

  beforeEach(async () => {
    process.env.DISHA_PASSWORD = TEST_PASSWORD;
    digestSpy.mockClear();
    vi.resetModules();
    const mod = await import("@/middleware");
    middleware = mod.middleware;
  });

  afterEach(() => {
    delete process.env.DISHA_PASSWORD;
  });

  async function makeRequest(path: string) {
    const { NextRequest } = await import("next/server");
    return new NextRequest(`https://app.test${path}`);
  }

  it("unauthenticated /api/generate/cv → 401 with error:unauthorized", async () => {
    const req = await makeRequest("/api/generate/cv");
    const res = await middleware(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("unauthenticated /api/download-pack/abc → 401", async () => {
    const req = await makeRequest("/api/download-pack/abc");
    const res = await middleware(req);
    expect(res.status).toBe(401);
  });

  it("unauthenticated /api/paste-role → 401", async () => {
    const req = await makeRequest("/api/paste-role");
    const res = await middleware(req);
    expect(res.status).toBe(401);
  });
});

describe("middleware — authenticated request passes through", () => {
  let middleware: typeof import("@/middleware").middleware;

  beforeEach(async () => {
    process.env.DISHA_PASSWORD = TEST_PASSWORD;
    digestSpy.mockClear();
    vi.resetModules();
    const mod = await import("@/middleware");
    middleware = mod.middleware;
  });

  afterEach(() => {
    delete process.env.DISHA_PASSWORD;
  });

  it("valid disha_session cookie on /inbox → 200 (NextResponse.next)", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("https://app.test/inbox", {
      headers: { cookie: `disha_session=${expectedHex}` },
    });
    const res = await middleware(req);
    // NextResponse.next() returns 200 in test environment
    expect(res.status).toBe(200);
  });
});
