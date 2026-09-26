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

// W-041: people search the way they talk — words apart, in any order, plural
// or singular. Every word must match somewhere in the name.
test("multi-word exercise search matches words in any order", async ({ page }) => {
  await loginAsTestUser(page, `exercise-search-${Date.now()}@fgpower.dev`);
  await completeOnboarding(page);

  const cards = page.locator('a[href^="/app/exercises/"]');
  for (const q of ["supino halter", "halteres supino"]) {
    await page.goto(`/app/exercises?q=${encodeURIComponent(q)}`);
    await expect(page.getByText("Nenhum exercício encontrado")).toHaveCount(0);
    await expect(cards.filter({ hasText: "Supino Inclinado com Halteres" }).first()).toBeVisible();
    // Every hit carries both words.
    for (const text of await cards.allInnerTexts()) {
      expect(text.toLowerCase()).toMatch(/supino/);
      expect(text.toLowerCase()).toMatch(/halter/);
    }
  }

  // Typing in the search box (the path real users take) gives the same result.
  await page.goto("/app/exercises");
  await page.getByPlaceholder(/Buscar exercício/).fill("elevação laterais");
  await expect(cards.filter({ hasText: /Elevação Lateral/ }).first()).toBeVisible();

  // Words that never appear together still find nothing.
  await page.goto(`/app/exercises?q=${encodeURIComponent("supino agachamento")}`);
  await expect(page.getByText("Nenhum exercício encontrado")).toBeVisible();
});
