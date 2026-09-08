import { test, expect } from "@playwright/test";

test("landing page loads and links to login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /treine com um motivo/i })).toBeVisible();
  await page.getByRole("link", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /entrar na fgpower/i })).toBeVisible();
});

test("visiting a protected route while logged out redirects to login", async ({ page }) => {
  await page.goto("/app/today");
  await expect(page).toHaveURL(/\/login/);
});
