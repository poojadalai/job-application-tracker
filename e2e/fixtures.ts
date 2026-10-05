import { randomUUID } from "node:crypto";
import { test as base, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";
import pg from "pg";
import type { Status } from "@/lib/applications";
import { testDatabaseUrl } from "../tests/test-db.mjs";

// The app under test is started with this secret (see playwright.config.ts),
// so cookies minted here are valid there and nowhere else.
export const E2E_AUTH_SECRET = "e2e-only-auth-secret-never-used-outside-tests";
// Auth.js uses this name on http:// URLs; it is also the encryption salt.
const SESSION_COOKIE = "authjs.session-token";

export type TestUser = { id: string; login: string };

// Signs a test user in without GitHub: we create the same encrypted JWT
// cookie Auth.js would set after OAuth, so the app runs its normal auth path.
export async function signIn(context: BrowserContext, user: TestUser) {
  const value = await encode({
    token: { sub: user.id, userId: user.id, name: user.login },
    secret: E2E_AUTH_SECRET,
    salt: SESSION_COOKIE,
  });
  await context.addCookies([
    { name: SESSION_COOKIE, value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
}

type Fixtures = {
  createUser: (login: string) => Promise<TestUser>;
  seedApplication: (
    user: TestUser,
    fields: { company: string; role: string; status?: Status },
  ) => Promise<string>;
  statusOf: (applicationId: string) => Promise<Status | undefined>;
};

// Fixture callbacks receive `provide` (Playwright calls it `use`) so the
// React hooks lint rule doesn't mistake it for React's use().
export const test = base.extend<Fixtures, { db: pg.Pool }>({
  db: [
    async ({}, provide) => {
      const pool = new pg.Pool({ connectionString: testDatabaseUrl() });
      await provide(pool);
      await pool.end();
    },
    { scope: "worker" },
  ],

  // Users are deleted after each test; their applications cascade.
  createUser: async ({ db }, provide) => {
    const ids: string[] = [];
    await provide(async (login) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO "User" ("id", "githubId", "login", "name") VALUES ($1, $2, $3, $3)`,
        [id, `e2e-${id}`, login],
      );
      ids.push(id);
      return { id, login };
    });
    await db.query(`DELETE FROM "User" WHERE "id" = ANY($1)`, [ids]);
  },

  seedApplication: async ({ db }, provide) => {
    await provide(async (user, { company, role, status = "Applied" }) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO "Application" ("id", "company", "role", "status", "updatedAt", "userId")
         VALUES ($1, $2, $3, $4::"Status", now(), $5)`,
        [id, company, role, status, user.id],
      );
      return id;
    });
  },

  statusOf: async ({ db }, provide) => {
    await provide(async (applicationId) => {
      const { rows } = await db.query<{ status: Status }>(
        `SELECT "status" FROM "Application" WHERE "id" = $1`,
        [applicationId],
      );
      return rows[0]?.status;
    });
  },
});

export { expect } from "@playwright/test";
