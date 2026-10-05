import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH_SECRET } from "./e2e/fixtures";
import { testDatabaseUrl } from "./tests/test-db.mjs";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  // One worker: tests share the test database and a single server.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI has already run `next build` in an earlier step.
    command: process.env.CI
      ? `npx next start -p ${PORT}`
      : `npx next build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
    // These override .env, so the app never sees the real database or secrets.
    env: {
      DATABASE_URL: testDatabaseUrl(),
      AUTH_SECRET: E2E_AUTH_SECRET,
      AUTH_GITHUB_ID: "e2e-placeholder",
      AUTH_GITHUB_SECRET: "e2e-placeholder",
      AUTH_TRUST_HOST: "true",
      CLAIM_UNOWNED_GITHUB_LOGIN: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
