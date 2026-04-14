import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

vi.mock("@/lib/env", () => ({
  loadAdminEnv: () => ({ ADMIN_SECRET: "x".repeat(32) }),
}));

describe("admin auth", () => {
  beforeEach(() => {
    cookieStore.get.mockReset();
    cookieStore.set.mockReset();
    cookieStore.delete.mockReset();
  });

  it("isAdmin returns false when cookie missing", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const { isAdmin } = await import("@/lib/auth/admin");
    expect(await isAdmin()).toBe(false);
  });

  it("isAdmin returns true when cookie matches ADMIN_SECRET", async () => {
    cookieStore.get.mockReturnValue({ value: "x".repeat(32) });
    const { isAdmin } = await import("@/lib/auth/admin");
    expect(await isAdmin()).toBe(true);
  });

  it("setAdminCookie returns false on wrong secret", async () => {
    const { setAdminCookie } = await import("@/lib/auth/admin");
    expect(await setAdminCookie("wrong")).toBe(false);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("setAdminCookie sets the cookie on correct secret", async () => {
    const { setAdminCookie } = await import("@/lib/auth/admin");
    const ok = await setAdminCookie("x".repeat(32));
    expect(ok).toBe(true);
    expect(cookieStore.set).toHaveBeenCalledWith(
      "aijs_admin",
      "x".repeat(32),
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax" }),
    );
  });
});
