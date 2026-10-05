import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { auth } from "@/auth";
import { requireUserId } from "@/lib/session";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
// auth() is overloaded (it also wraps middleware), so type the mock as the
// session-returning form only.
const mockAuth = auth as unknown as Mock<
  () => Promise<{ user?: { id?: string } } | null>
>;

describe("requireUserId", () => {
  beforeEach(() => mockAuth.mockReset());

  it("returns the signed-in user's id", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    await expect(requireUserId()).resolves.toBe("user-1");
  });

  it("throws when there is no session", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireUserId()).rejects.toThrow("Unauthorized");
  });

  it("throws when the session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} });
    await expect(requireUserId()).rejects.toThrow("Unauthorized");
  });
});
