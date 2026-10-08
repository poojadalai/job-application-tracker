"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/db";
import { extractJobPosting, type JobPostingResult } from "@/lib/job-posting";
import { fetchPublicHtml, parsePublicUrl } from "@/lib/safe-fetch";
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

// Reads company, role and description from a job posting link. Returns a
// result instead of throwing, because errors thrown from Server Actions reach
// the client without their message in production.
export async function fetchJobPosting(link: string): Promise<JobPostingResult> {
  await requireUserId();
  try {
    parsePublicUrl(String(link).slice(0, 2000));
  } catch {
    return { ok: false, reason: "invalid-link" };
  }
  try {
    const details = extractJobPosting(await fetchPublicHtml(String(link)));
    if (!details.company && !details.role && !details.jobDescription) {
      return { ok: false, reason: "unreadable" };
    }
    return { ok: true, ...details };
  } catch {
    // Blocked addresses, timeouts, HTTP errors, login walls and non-HTML
    // pages all mean the same thing to the user: fill in manually.
    return { ok: false, reason: "unreadable" };
  }
}
