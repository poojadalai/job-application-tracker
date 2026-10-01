import { connection } from "next/server";
import { prisma } from "@/lib/db";
import type { Application } from "@/lib/applications";

export async function listApplications(): Promise<Application[]> {
  // Read from the database on every request instead of at build time.
  await connection();
  const rows = await prisma.application.findMany({
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
