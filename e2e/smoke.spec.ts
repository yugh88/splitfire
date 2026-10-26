import { expect, test } from "@playwright/test";

test("plans an example repo end to end", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /split the work/i })).toBeVisible();

  await page.getByRole("button", { name: /zustand/ }).click();
  const metrics = page.locator('[aria-label="Plan metrics"]:visible');
  await expect(metrics).toBeVisible({ timeout: 45_000 });
  await expect(metrics.getByText(/Serial .* → /)).toBeVisible();
  await expect(metrics.getByText("Collisions")).toBeVisible();

  await page.locator(".react-flow__node-task").first().click();
  await expect(page.getByText("Owns (exclusive)")).toBeVisible();

  await page.getByRole("tab", { name: /heatmap/i }).click();
  await expect(page.getByText("Repair log")).toBeVisible();
  await expect(page.getByText(/Graph check passed/)).toBeVisible();
});
