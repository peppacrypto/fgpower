import type { Page } from "@playwright/test";

/** Fills the onboarding wizard with defaults and submits it. */
export async function completeOnboarding(page: Page) {
  await page.goto("/app/today");
  if (!/\/onboarding/.test(page.url())) return;
  await page.getByLabel("Nome de exibição").fill("Teste E2E");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 15_000 }),
    page.getByRole("button", { name: "Concluir" }).click(),
  ]);
}
