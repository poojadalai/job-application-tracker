// Resolves the database URL for integration and e2e tests, and refuses to
// return anything that could be the app's real database.
import { existsSync, readFileSync } from "node:fs";
import { config, parse } from "dotenv";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

// Neon's pooled and direct hosts differ only by "-pooler" in the first label,
// so compare endpoints rather than raw hostnames.
function endpoint(url) {
  const [first, ...rest] = new URL(url).hostname.split(".");
  return [first.replace(/-pooler$/, ""), ...rest].join(".");
}

/** @returns {string} */
export function testDatabaseUrl() {
  // Local runs keep TEST_DATABASE_URL in .env.test.local (gitignored).
  // CI sets it directly, and an existing variable always wins.
  config({ path: ".env.test.local", quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Add it to .env.test.local (see README, Testing).",
    );
  }

  const host = new URL(url).hostname;
  if (LOCAL_HOSTS.has(host)) return url;
  if (process.env.CI) {
    throw new Error(
      `In CI, tests only run against the local Postgres service, not ${host}.`,
    );
  }

  const appEnv = existsSync(".env") ? parse(readFileSync(".env")) : {};
  if (appEnv.DATABASE_URL && endpoint(appEnv.DATABASE_URL) === endpoint(url)) {
    throw new Error(
      `TEST_DATABASE_URL points at the same database as DATABASE_URL in .env (${host}). Use a separate Neon test branch.`,
    );
  }
  return url;
}
