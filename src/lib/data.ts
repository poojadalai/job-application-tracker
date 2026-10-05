import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import type { Application } from "@/lib/applications";
import { computeStats, weekRange, type Stats } from "@/lib/stats";

export async function listApplications(): Promise<Application[]> {
  const userId = await requireUserId();
  const rows = await prisma.application.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    company: row.company,
    role: row.role,
    status: row.status,
    appliedDate: row.appliedDate?.toISOString().slice(0, 10) ?? "",
    jobDescription: row.jobDescription,
    nextStep: row.nextStep,
    link: row.link,
    notes: row.notes,
  }));
}

// Both queries filter by the signed-in user's ID, and the counting happens in
// Postgres, so only numbers (never another user's rows) reach the page.
export async function getStats(now = new Date()): Promise<Stats> {
  const userId = await requireUserId();
  const { start, end } = weekRange(now);
  const [groups, thisWeek] = await Promise.all([
    prisma.application.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.application.count({
      where: { userId, appliedDate: { gte: start, lt: end } },
    }),
  ]);
  const counts = Object.fromEntries(
    groups.map((group) => [group.status, group._count._all]),
  );
  return computeStats(counts, thisWeek);
}
