import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import type { Application } from "@/lib/applications";

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
