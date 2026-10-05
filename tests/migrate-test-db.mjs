// Applies Prisma migrations to the test database only (never .env's DATABASE_URL).
import { execSync } from "node:child_process";
import { testDatabaseUrl } from "./test-db.mjs";

const url = testDatabaseUrl();
console.log(`Applying migrations to the test database at ${new URL(url).hostname}`);
execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
