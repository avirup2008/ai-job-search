import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

const TEST_PASSWORD = "hunter2";
const CORRECT_HASH = createHash("sha256").update(TEST_PASSWORD).digest("hex");

describe("admin auth", () => {
  beforeEach(() => {
    cookieStore.get.mockReset();
    vi.stubEnv("DISHA_PASSWORD", TEST_PASSWORD);
  });

  it("isAdmin returns false when cookie missing", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const { isAdmin } = await import("@/lib/auth/admin");
    expect(await isAdmin()).toBe(false);
  });

  it("isAdmin returns false when DISHA_PASSWORD not set", async () => {
    vi.stubEnv("DISHA_PASSWORD", "");
    cookieStore.get.mockReturnValue({ value: CORRECT_HASH });
    const { isAdmin } = await import("@/lib/auth/admin");
    expect(await isAdmin()).toBe(false);
  });

  it("isAdmin returns true when disha_session cookie matches sha256(DISHA_PASSWORD)", async () => {
    cookieStore.get.mockReturnValue({ value: CORRECT_HASH });
    const { isAdmin } = await import("@/lib/auth/admin");
    expect(await isAdmin()).toBe(true);
  });

  it("isAdmin returns false when cookie value does not match", async () => {
    cookieStore.get.mockReturnValue({ value: "wrong-hash" });
    const { isAdmin } = await import("@/lib/auth/admin");
    expect(await isAdmin()).toBe(false);
  });
});
