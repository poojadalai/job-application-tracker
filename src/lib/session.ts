import { auth } from "@/auth";

// Returns the signed-in user's ID, or throws. Call this before every
// Application query so data is always scoped to its owner.
export async function requireUserId() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  return id;
}
