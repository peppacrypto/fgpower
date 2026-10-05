import type { Page } from "@playwright/test";

/** Fills the onboarding wizard with defaults and submits it. */
export async function completeOnboarding(page: Page) {
  await page.goto("/app/today");
  if (!/\/onboarding/.test(page.url())) return;
  await page.getByLabel("Nome de exibição").fill("Teste E2E");
  // A-049: attested 18+ is required to leave step 1.
  await page.locator("#confirm-adult").check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  // A-008: the health-data consent gates the final submit.
  await page.locator('input[name="healthConsent"]').check();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 15_000 }),
    page.getByRole("button", { name: "Ver meu plano" }).click(),
  ]);
}
