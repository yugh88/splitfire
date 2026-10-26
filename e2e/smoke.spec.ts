import { expect, test } from "@playwright/test";

test("plans an example repo end to end", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /splitfire/i })).toBeVisible();

  await page.getByRole("button", { name: /zustand/ }).click();
  await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Speedup")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/Serial .* → .* with \d+ agents?/)).toBeVisible();

  await page.getByLabel("Toggle collision heatmap").click();
  await page.locator(".react-flow__node").first().click();
  await expect(page.getByText("Owns (exclusive)")).toBeVisible();
});
