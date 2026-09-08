import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";

test("authenticated new user is guided through onboarding", async ({ page }) => {
  const email = `onboarding-${Date.now()}@fgpower.dev`;
  await loginAsTestUser(page, email);

  await page.goto("/app/today");
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByLabel("Nome de exibição").fill("Teste E2E");
  await page.getByRole("button", { name: "Continuar" }).click();

  // Step 2: goal — accept the default selection.
  await expect(page.getByRole("heading", { name: /principal objetivo/i })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  // Step 3: experience + frequency — accept defaults.
  await expect(page.getByRole("heading", { name: /experiência com treino/i })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  // Step 4: equipment — submit. This triggers a server action + redirect,
  // so wait for the navigation concurrently to avoid a race where the
  // button is replaced/detached mid-click.
  await expect(page.getByRole("heading", { name: /onde você vai treinar/i })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 15_000 }),
    page.getByRole("button", { name: "Concluir" }).click(),
  ]);

  await expect(page).toHaveURL(/\/app\/today/);
  await expect(page.getByText(/teste/i).first()).toBeVisible();
});
