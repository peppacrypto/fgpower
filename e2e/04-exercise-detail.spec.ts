import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";

test("browse the exercise library and open an exercise detail page", async ({ page }) => {
  const email = `exercise-${Date.now()}@fgpower.dev`;
  await loginAsTestUser(page, email);
  await completeOnboarding(page);

  await page.goto("/app/exercises");
  await page.getByPlaceholder(/Buscar exercício/).fill("supino");
  await page.waitForTimeout(500);

  const firstCard = page.locator('a[href^="/app/exercises/"]').first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();

  await expect(page.getByRole("heading", { name: "Como executar" })).toBeVisible();
  await expect(page.getByText("Músculos primários")).toBeVisible();
});

test("science principle page shows cited evidence", async ({ page }) => {
  const email = `science-${Date.now()}@fgpower.dev`;
  await loginAsTestUser(page, email);
  await completeOnboarding(page);

  await page.goto("/app/science");
  await page.getByText("Repetições em Reserva").click();
  await expect(page.getByRole("heading", { name: "Repetições em Reserva (RIR)" })).toBeVisible();
  await expect(page.getByText("Referências")).toBeVisible();
});
