import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import { prisma } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

// GitHub credentials come from AUTH_GITHUB_ID / AUTH_GITHUB_SECRET and the
// session secret from AUTH_SECRET; Auth.js reads them from the environment.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Only runs with a profile on sign-in: record the user and remember
      // our database ID in the session token.
      if (account?.provider === "github" && profile) {
        const githubId = String(profile.id);
        const details = {
          login: String(profile.login),
          email: profile.email ?? null,
          name: profile.name ?? null,
          image:
            typeof profile.avatar_url === "string" ? profile.avatar_url : null,
        };
        const user = await prisma.user.upsert({
          where: { githubId },
          update: details,
          create: { githubId, ...details },
        });
        await claimUnownedApplications(user.id, details.login);
        token.userId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.userId === "string") session.user.id = token.userId;
      return session;
    },
  },
});

// Applications created before sign-in existed have no owner. They go to the
// single GitHub account named in CLAIM_UNOWNED_GITHUB_LOGIN, if set.
async function claimUnownedApplications(userId: string, login: string) {
  const owner = process.env.CLAIM_UNOWNED_GITHUB_LOGIN;
  if (!owner || owner.toLowerCase() !== login.toLowerCase()) return;
  await prisma.application.updateMany({
    where: { userId: null },
    data: { userId },
  });
}
