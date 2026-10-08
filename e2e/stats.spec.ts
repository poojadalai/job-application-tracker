import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./fixtures";

const summary = (page: Page, label: string) =>
  page.getByRole("list", { name: "Summary" }).getByRole("listitem").filter({ hasText: label });

const stage = (page: Page, status: string) =>
  page
    .getByRole("list", { name: "Applications by current stage" })
    .getByRole("listitem")
    .filter({ hasText: status });

test("a signed-out visitor is sent to the sign-in screen", async ({ page }) => {
  await page.goto("/stats");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
});

test("shows an empty state for a new user", async ({ page, createUser }) => {
  await signIn(page.context(), await createUser("e2e-stats-empty"));
  await page.goto("/stats");

  await expect(summary(page, "This week")).toContainText("0");
  await expect(summary(page, "Response rate")).toContainText("—");
  await expect(page.getByText("No applications yet.")).toBeVisible();
});

test("updates after adding and moving an application", async ({ page, createUser }) => {
  await signIn(page.context(), await createUser("e2e-stats"));
  await page.goto("/");

  // Add one through the dialog; its applied date defaults to today.
  await page.getByRole("button", { name: "Add application" }).click();
  await page.getByLabel(/Company/).fill("Hooli");
  await page.getByLabel(/Role/).fill("Frontend Developer");
  await page.getByRole("button", { name: "Save application" }).click();
  await expect(page.getByRole("region", { name: "Applied column" }).getByText("Hooli")).toBeVisible();

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Stats" }).click();
  await expect(page).toHaveURL("/stats");
  await expect(summary(page, "This week")).toContainText("1");
  await expect(summary(page, "Response rate")).toContainText("0%");
  await expect(stage(page, "Applied")).toContainText("1 (100%)");

  // Move it to Interview from the list view.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Board" }).click();
  await page.getByRole("button", { name: "list", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "Hooli" })
    .getByLabel("Status")
    .selectOption("Interview");

  // The status change is optimistic, so reload /stats until the server has
  // saved it rather than racing the Server Action.
  await expect(async () => {
    await page.goto("/stats");
    await expect(stage(page, "Interview")).toContainText("1 (100%)", { timeout: 1000 });
  }).toPass();
  await expect(summary(page, "Response rate")).toContainText("100%");
  await expect(stage(page, "Applied")).toContainText("0 (0%)");
});
