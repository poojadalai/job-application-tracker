import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./fixtures";

const column = (page: Page, status: string) =>
  page.getByRole("region", { name: `${status} column` });

test("a signed-out visitor only sees the sign-in screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add application" })).toHaveCount(0);
});

test("adds an application and keeps it after a reload", async ({ page, createUser }) => {
  await signIn(page.context(), await createUser("e2e-adder"));
  await page.goto("/");

  // The board comes first; the form only appears in a dialog.
  const dialog = page.getByRole("dialog", { name: "Add application" });
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Add application" }).click();
  await expect(dialog).toBeVisible();
  await page.getByLabel(/Company/).fill("Initech");
  await page.getByLabel(/Role/).fill("QA Engineer");
  await page.getByLabel("Next step").fill("Recruiter call");
  await page.getByRole("button", { name: "Save application" }).click();
  await expect(dialog).toBeHidden();

  await expect(column(page, "Applied").getByText("Initech")).toBeVisible();
  await page.reload();
  await expect(column(page, "Applied").getByText("Initech")).toBeVisible();
  await expect(column(page, "Applied").getByText("Next: Recruiter call")).toBeVisible();
});

test("moves a card to another column with the keyboard", async ({
  page,
  createUser,
  seedApplication,
  statusOf,
}) => {
  const user = await createUser("e2e-mover");
  const id = await seedApplication(user, { company: "Globex", role: "Backend Developer" });
  await signIn(page.context(), user);
  await page.goto("/");

  // dnd-kit's keyboard sensor: Space picks up, arrows move a column, Space drops.
  // Its live region holds only the latest announcement, so wait for each
  // "over the X column" state (which stays until the next move) rather than
  // the "Picked up" message, which is replaced almost immediately.
  const announcer = page.getByRole("status");
  await page.getByRole("button", { name: /Backend Developer at Globex/ }).focus();
  await page.keyboard.press("Space");
  await expect(announcer).toContainText("over the Applied column");
  await page.keyboard.press("ArrowRight");
  await expect(announcer).toContainText("over the Screening column");
  await page.keyboard.press("ArrowRight");
  await expect(announcer).toContainText("over the Interview column");
  await page.keyboard.press("Space");

  await expect(column(page, "Interview").getByText("Globex")).toBeVisible();
  await expect.poll(() => statusOf(id)).toBe("Interview");
  await page.reload();
  await expect(column(page, "Interview").getByText("Globex")).toBeVisible();
});

test("edits and then deletes an application", async ({ page, createUser, seedApplication }) => {
  const user = await createUser("e2e-editor");
  await seedApplication(user, { company: "Umbrella", role: "Data Analyst" });
  await signIn(page.context(), user);
  await page.goto("/");

  const card = column(page, "Applied").getByRole("listitem").filter({ hasText: "Umbrella" });
  await card.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit application" })).toBeVisible();
  await page.getByLabel(/Role/).fill("Senior Data Analyst");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(card).toContainText("Senior Data Analyst");

  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Delete" }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Umbrella")).toHaveCount(0);
});

test("a user never sees another user's applications", async ({
  browser,
  page,
  createUser,
  seedApplication,
}) => {
  const alice = await createUser("e2e-alice");
  const bob = await createUser("e2e-bob");
  await seedApplication(alice, { company: "Alice Secret Co", role: "Engineer" });

  await signIn(page.context(), bob);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "All applications (0)" })).toBeVisible();
  await expect(page.getByText("Alice Secret Co")).toHaveCount(0);

  const aliceContext = await browser.newContext();
  await signIn(aliceContext, alice);
  const alicePage = await aliceContext.newPage();
  await alicePage.goto("/");
  await expect(column(alicePage, "Applied").getByText("Alice Secret Co")).toBeVisible();
  await aliceContext.close();
});
