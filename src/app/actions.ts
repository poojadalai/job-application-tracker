"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import {
  STATUSES,
  type ApplicationInput,
  type Status,
} from "@/lib/applications";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseStatus(value: unknown): Status {
  if (!STATUSES.includes(value as Status)) throw new Error("Invalid status");
  return value as Status;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid date");
  return new Date(`${value}T00:00:00Z`);
}

// Server Actions are public endpoints, so every field is re-validated here.
function parseInput(input: ApplicationInput) {
  const company = text(input.company, 200);
  const role = text(input.role, 200);
  if (!company || !role) throw new Error("Company and role are required");
  return {
    company,
    role,
    status: parseStatus(input.status),
    appliedDate: parseDate(input.appliedDate),
    jobDescription: text(input.jobDescription, 20000),
    nextStep: text(input.nextStep, 200),
    link: text(input.link, 2000),
    notes: text(input.notes, 10000),
  };
}

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
