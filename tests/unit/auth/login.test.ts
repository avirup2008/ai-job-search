import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// These route handlers use node:crypto directly — no Web Crypto stub needed.

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    process.env.DISHA_PASSWORD = "correct-pass";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DISHA_PASSWORD;
  });

  function makeLoginRequest(body: unknown) {
    return new Request("https://app.test/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  it("correct password → 200, Set-Cookie contains disha_session, cookie is HttpOnly", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeLoginRequest({ password: "correct-pass" }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("disha_session=");
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  it("wrong password → 401, body has error:incorrect password, no disha_session cookie set", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeLoginRequest({ password: "wrong-pass" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("incorrect password");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).not.toContain("disha_session=");
  });

  it("missing body / invalid JSON → 400", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const req = new Request("https://app.test/api/auth/login", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  it("logout → redirect response that clears disha_session cookie", async () => {
    vi.resetModules();
    const { POST } = await import("@/app/api/auth/logout/route");
    const req = new Request("https://app.test/api/auth/logout", {
      method: "POST",
    });
    const res = await POST(req as Parameters<typeof POST>[0]);
    // logout returns a redirect
    expect([301, 302, 307, 308]).toContain(res.status);
    const setCookie = res.headers.get("set-cookie") ?? "";
    // Cookie should be cleared: empty value or maxAge=0
    expect(
      setCookie.includes("disha_session=;") ||
      setCookie.includes("disha_session=,") ||
      setCookie.includes("max-age=0") ||
      setCookie.includes("Max-Age=0"),
    ).toBe(true);
  });
});
