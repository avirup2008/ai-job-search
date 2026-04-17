import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";

/**
 * Mirror of isAuthenticated() in src/app/page.tsx
 *
 * The function is not exported from page.tsx, so we replicate the exact guard
 * logic here as a pure-function test. This ensures the invariant holds:
 * malformed cookies must not throw and must return false.
 */
function isAuthenticated(cookieVal: string | undefined): boolean {
  const pw = process.env.DISHA_PASSWORD;
  if (!pw) return false;
  if (!cookieVal) return false;
  const expected = crypto.createHash("sha256").update(pw).digest("hex");
  if (cookieVal.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(cookieVal), Buffer.from(expected));
}

describe("isAuthenticated() — edge cases", () => {
  beforeEach(() => {
    process.env.DISHA_PASSWORD = "test-secret";
  });

  afterEach(() => {
    delete process.env.DISHA_PASSWORD;
  });

  it("cookie with wrong length returns false without throwing", () => {
    // SHA-256 hex is 64 chars; a short cookie must be rejected before timingSafeEqual
    expect(() => isAuthenticated("short")).not.toThrow();
    expect(isAuthenticated("short")).toBe(false);
  });

  it("cookie with garbage bytes at correct length (64 chars) does not throw", () => {
    // 64 chars of non-valid-hex garbage (but same byte length as expected)
    const garbage = "x".repeat(64);
    expect(() => isAuthenticated(garbage)).not.toThrow();
    // "x".repeat(64) will not match the sha256 of "test-secret"
    expect(isAuthenticated(garbage)).toBe(false);
  });

  it("missing DISHA_PASSWORD env returns false", () => {
    delete process.env.DISHA_PASSWORD;
    const anyValue = "a".repeat(64);
    expect(isAuthenticated(anyValue)).toBe(false);
  });

  it("valid cookie (sha256 of password) returns true", () => {
    const validToken = crypto
      .createHash("sha256")
      .update("test-secret")
      .digest("hex");
    expect(isAuthenticated(validToken)).toBe(true);
  });

  it("undefined cookie returns false without throwing", () => {
    expect(() => isAuthenticated(undefined)).not.toThrow();
    expect(isAuthenticated(undefined)).toBe(false);
  });
});
