import { expect, test } from "@playwright/test";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("plans an example repo, exports it and opens the share link", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /split the work/i })).toBeVisible();

  await page.getByRole("button", { name: /zustand/ }).click();
  const metrics = page.locator('[aria-label="Plan metrics"]:visible');
  await expect(metrics).toBeVisible({ timeout: 45_000 });
  await expect(metrics.getByText(/Serial .* → /)).toBeVisible();
  await expect(metrics.getByText("Collisions")).toBeVisible();

  await page.locator(".react-flow__node-task").first().click();
  await expect(page.getByText("Owns (exclusive)")).toBeVisible();
  await page.getByRole("button", { name: /copy alan prompt/i }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("## Files you own");

  await page.getByRole("tab", { name: /heatmap/i }).click();
  await expect(page.getByText("Repair log")).toBeVisible();
  await expect(page.getByText(/Graph check passed/)).toBeVisible();

  await page.getByRole("button", { name: /^share$/i }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/p\/[a-f0-9]{16}$/);
  const shared = await context.newPage();
  await shared.goto(link);
  await expect(shared.locator('[aria-label="Plan metrics"]:visible')).toBeVisible();
  await expect(shared.getByRole("button", { name: /export to alan/i })).toBeVisible();
});
