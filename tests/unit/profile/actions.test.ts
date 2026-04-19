import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────

const updates: Array<{ set: unknown; where: unknown }> = [];

const fakeDb = {
  select: () => ({
    from: () => ({
      limit: () => Promise.resolve([
        {
          id: "profile-1",
          roles: [],
          achievements: [],
          toolStack: {},
          constraints: {},
          preferences: {},
          education: { degrees: [], certifications: [] },
          stories: [],
        },
      ]),
    }),
  }),
  update: (_table: unknown) => ({
    set: (data: unknown) => ({
      where: (where: unknown) => {
        updates.push({ set: data, where });
        return Promise.resolve();
      },
    }),
  }),
};

vi.mock("@/db", () => ({
  db: fakeDb,
  schema: {
    profile: { id: "id" },
  },
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return { ...actual, eq: (..._a: unknown[]) => ({ __op: "eq" }) };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/profile/rescore", () => ({
  rescoreMatchedJobs: vi.fn().mockResolvedValue({ updated: 0, costEur: 0 }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function lastUpdate() {
  return updates[updates.length - 1]?.set as Record<string, unknown>;
}

beforeEach(() => {
  updates.length = 0;
});

// ── updateRoles ────────────────────────────────────────────────────────────

describe("updateRoles", () => {
  it("persists the roles array to the DB", async () => {
    const { updateRoles } = await import("@/app/(app)/profile/actions");
    const roles = [
      { company: "Acme", title: "Head of Marketing", dates: "2020–2024", achievements: ["Grew pipeline 3×"] },
    ];
    await updateRoles(roles);
    expect(lastUpdate().roles).toEqual(roles);
  });

  it("persists an empty array when all roles are removed", async () => {
    const { updateRoles } = await import("@/app/(app)/profile/actions");
    await updateRoles([]);
    expect(lastUpdate().roles).toEqual([]);
  });

  it("sets updatedAt on every save", async () => {
    const { updateRoles } = await import("@/app/(app)/profile/actions");
    const before = Date.now();
    await updateRoles([{ company: "X", title: "Y", dates: "2023", achievements: [] }]);
    const updatedAt = lastUpdate().updatedAt as Date;
    expect(updatedAt).toBeInstanceOf(Date);
    expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});

// ── updateEducation ────────────────────────────────────────────────────────

describe("updateEducation", () => {
  it("persists degrees and certifications to the DB", async () => {
    const { updateEducation } = await import("@/app/(app)/profile/actions");
    const data = {
      degrees: [{ degree: "MA Political Science", institution: "University of Delhi", year: "2012" }],
      certifications: [{ name: "HubSpot Marketing Hub" }],
    };
    await updateEducation(data);
    const saved = lastUpdate().education as typeof data;
    expect(saved.degrees).toHaveLength(1);
    expect(saved.degrees[0].degree).toBe("MA Political Science");
    expect(saved.certifications[0].name).toBe("HubSpot Marketing Hub");
  });

  it("persists empty arrays when education is cleared", async () => {
    const { updateEducation } = await import("@/app/(app)/profile/actions");
    await updateEducation({ degrees: [], certifications: [] });
    const saved = lastUpdate().education as { degrees: unknown[]; certifications: unknown[] };
    expect(saved.degrees).toHaveLength(0);
    expect(saved.certifications).toHaveLength(0);
  });

  it("preserves optional status field on certifications", async () => {
    const { updateEducation } = await import("@/app/(app)/profile/actions");
    const data = {
      degrees: [],
      certifications: [{ name: "Google Ads", status: "in progress" }],
    };
    await updateEducation(data);
    const saved = lastUpdate().education as typeof data;
    expect(saved.certifications[0].status).toBe("in progress");
  });
});
