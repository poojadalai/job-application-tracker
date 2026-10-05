import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createApplication,
  deleteApplication,
  updateApplication,
  updateApplicationStatus,
} from "@/app/actions";
import type { ApplicationInput } from "@/lib/applications";
import { listApplications } from "@/lib/data";
import { prisma } from "@/lib/db";

// Only the session is faked: the actions, the queries and the database are
// real, so these tests prove the userId filters in the SQL actually hold.
const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/session", () => ({
  requireUserId: async () => {
    if (!session.userId) throw new Error("Unauthorized");
    return session.userId;
  },
}));
// refresh() needs a Next.js request context, which tests don't have.
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

function input(overrides: Partial<ApplicationInput> = {}): ApplicationInput {
  return {
    company: "Acme",
    role: "Frontend Developer",
    status: "Applied",
    appliedDate: "2026-10-01",
    jobDescription: "",
    nextStep: "",
    link: "",
    notes: "",
    ...overrides,
  };
}

async function createUser(login: string) {
  return prisma.user.create({
    data: { githubId: `test-${randomUUID()}`, login },
  });
}

let alice: { id: string };
let bob: { id: string };

// Each test creates its own users and deletes them afterwards (applications
// cascade), so the tests never touch rows they didn't create.
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

function signInAs(user: { id: string }) {
  session.userId = user.id;
}

async function createAs(user: { id: string }, overrides = {}) {
  signInAs(user);
  await createApplication(input(overrides));
  const app = await prisma.application.findFirstOrThrow({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  session.userId = null;
  return app;
}

describe("per-user data isolation", () => {
  it("assigns new applications to the signed-in user, ignoring any userId in the input", async () => {
    signInAs(alice);
    await createApplication({ ...input(), userId: bob.id } as ApplicationInput);

    expect(await prisma.application.count({ where: { userId: alice.id } })).toBe(1);
    expect(await prisma.application.count({ where: { userId: bob.id } })).toBe(0);
  });

  it("lists only the signed-in user's applications", async () => {
    await createAs(alice, { company: "Alice Co" });
    await createAs(bob, { company: "Bob Co" });

    signInAs(alice);
    expect((await listApplications()).map((a) => a.company)).toEqual(["Alice Co"]);

    signInAs(bob);
    expect((await listApplications()).map((a) => a.company)).toEqual(["Bob Co"]);
  });

  it("does not show applications that have no owner", async () => {
    const orphan = await prisma.application.create({
      data: { company: "Orphan", role: "Unowned" },
    });
    try {
      signInAs(alice);
      expect(await listApplications()).toEqual([]);
    } finally {
      await prisma.application.delete({ where: { id: orphan.id } });
    }
  });

  it("does not let another user edit an application", async () => {
    const app = await createAs(alice);

    signInAs(bob);
    await expect(
      updateApplication(app.id, input({ company: "Hijacked" })),
    ).rejects.toThrow("Application not found");

    const after = await prisma.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(after.company).toBe("Acme");
    expect(after.userId).toBe(alice.id);
  });

  it("does not let another user change the status", async () => {
    const app = await createAs(alice);

    signInAs(bob);
    await expect(updateApplicationStatus(app.id, "Rejected")).rejects.toThrow(
      "Application not found",
    );

    const after = await prisma.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(after.status).toBe("Applied");
  });

  it("does not let another user delete an application", async () => {
    const app = await createAs(alice);

    signInAs(bob);
    await expect(deleteApplication(app.id)).rejects.toThrow("Application not found");

    expect(await prisma.application.count({ where: { id: app.id } })).toBe(1);
  });

  it("lets the owner edit, move and delete their own application", async () => {
    const app = await createAs(alice);
    signInAs(alice);

    await updateApplication(app.id, input({ company: "Acme Corp", nextStep: "Call" }));
    await updateApplicationStatus(app.id, "Interview");
    const after = await prisma.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(after).toMatchObject({ company: "Acme Corp", nextStep: "Call", status: "Interview" });

    await deleteApplication(app.id);
    expect(await prisma.application.count({ where: { id: app.id } })).toBe(0);
  });

  it("rejects every action when nobody is signed in", async () => {
    const app = await createAs(alice);

    await expect(listApplications()).rejects.toThrow("Unauthorized");
    await expect(createApplication(input())).rejects.toThrow("Unauthorized");
    await expect(updateApplication(app.id, input())).rejects.toThrow("Unauthorized");
    await expect(updateApplicationStatus(app.id, "Offer")).rejects.toThrow("Unauthorized");
    await expect(deleteApplication(app.id)).rejects.toThrow("Unauthorized");

    expect(await prisma.application.count({ where: { userId: alice.id } })).toBe(1);
  });

  it("rejects invalid input before writing anything", async () => {
    signInAs(alice);
    await expect(
      createApplication(input({ status: "Hired" as ApplicationInput["status"] })),
    ).rejects.toThrow("Invalid status");
    await expect(createApplication(input({ company: "   " }))).rejects.toThrow(
      "Company and role are required",
    );

    expect(await prisma.application.count({ where: { userId: alice.id } })).toBe(0);
  });
});
