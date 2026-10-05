"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { parseInput, parseStatus } from "@/lib/validation";
import type { ApplicationInput, Status } from "@/lib/applications";

// Every write is filtered by the signed-in user's ID, so an ID belonging to
// someone else matches nothing and fails like a missing record.
function assertFound({ count }: { count: number }) {
  if (count === 0) throw new Error("Application not found");
}

export async function createApplication(input: ApplicationInput) {
  const userId = await requireUserId();
  await prisma.application.create({ data: { ...parseInput(input), userId } });
  refresh();
}

export async function updateApplication(id: string, input: ApplicationInput) {
  const userId = await requireUserId();
  assertFound(
    await prisma.application.updateMany({
      where: { id: String(id), userId },
      data: parseInput(input),
    }),
  );
  refresh();
}

export async function updateApplicationStatus(id: string, status: Status) {
  const userId = await requireUserId();
  assertFound(
    await prisma.application.updateMany({
      where: { id: String(id), userId },
      data: { status: parseStatus(status) },
    }),
  );
  refresh();
}

export async function deleteApplication(id: string) {
  const userId = await requireUserId();
  assertFound(
    await prisma.application.deleteMany({ where: { id: String(id), userId } }),
  );
  refresh();
}
