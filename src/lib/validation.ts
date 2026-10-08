import {
  STATUSES,
  capitalizeFirst,
  type ApplicationInput,
  type Status,
} from "@/lib/applications";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseStatus(value: unknown): Status {
  if (!STATUSES.includes(value as Status)) throw new Error("Invalid status");
  return value as Status;
}

export function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid date");
  return new Date(`${value}T00:00:00Z`);
}

// Server Actions are public endpoints, so every field is re-validated here.
export function parseInput(input: ApplicationInput) {
  const company = capitalizeFirst(text(input.company, 200));
  const role = capitalizeFirst(text(input.role, 200));
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
