import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Status } from "@/lib/applications";
import { getStats } from "@/lib/data";
import { prisma } from "@/lib/db";

// Only the session is faked; the aggregation queries run against the real
// test database, so these tests prove the userId filter holds in the SQL.
const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/session", () => ({
  requireUserId: async () => {
    if (!session.userId) throw new Error("Unauthorized");
    return session.userId;
  },
}));

// A fixed "now" (Wednesday), so "this week" is Monday 2026-10-05 to Sunday
// 2026-10-11 no matter when the tests run.
const NOW = new Date("2026-10-07T12:00:00Z");
const THIS_WEEK = new Date("2026-10-06T00:00:00Z");
const LAST_WEEK = new Date("2026-10-04T00:00:00Z");

async function createUser(login: string) {
  return prisma.user.create({
    data: { githubId: `test-${randomUUID()}`, login },
  });
}

async function seed(
  user: { id: string } | null,
  status: Status,
  appliedDate: Date | null,
) {
  return prisma.application.create({
    data: { company: "Acme", role: "Dev", status, appliedDate, userId: user?.id },
  });
}

function stageCounts(stats: Awaited<ReturnType<typeof getStats>>) {
  return Object.fromEntries(stats.byStage.map((s) => [s.status, s.count]));
}

let alice: { id: string };
let bob: { id: string };

beforeEach(async () => {
  alice = await createUser("alice");
  bob = await createUser("bob");
  session.userId = null;
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [alice.id, bob.id] } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("stats isolation", () => {
  it("counts only the signed-in user's applications", async () => {
    await seed(alice, "Applied", THIS_WEEK);
    await seed(alice, "Interview", THIS_WEEK);
    await seed(alice, "Rejected", LAST_WEEK);
    await seed(bob, "Offer", THIS_WEEK);
    await seed(bob, "Screening", null);

    session.userId = alice.id;
    const aliceStats = await getStats(NOW);
    expect(aliceStats).toMatchObject({ total: 3, thisWeek: 2, responses: 2 });
    expect(stageCounts(aliceStats)).toEqual({
      Applied: 1,
      Screening: 0,
      Interview: 1,
      Offer: 0,
      Rejected: 1,
    });

    session.userId = bob.id;
    const bobStats = await getStats(NOW);
    expect(bobStats).toMatchObject({ total: 2, thisWeek: 1, responses: 2, responseRate: 1 });
    expect(stageCounts(bobStats)).toEqual({
      Applied: 0,
      Screening: 1,
      Interview: 0,
      Offer: 1,
      Rejected: 0,
    });
  });

  it("ignores applications that have no owner", async () => {
    const orphan = await seed(null, "Offer", THIS_WEEK);
    try {
      session.userId = alice.id;
      expect(await getStats(NOW)).toMatchObject({
        total: 0,
        thisWeek: 0,
        responseRate: null,
      });
    } finally {
      await prisma.application.delete({ where: { id: orphan.id } });
    }
  });

  it("rejects the request when nobody is signed in", async () => {
    await seed(alice, "Applied", THIS_WEEK);
    await expect(getStats(NOW)).rejects.toThrow("Unauthorized");
  });
});
