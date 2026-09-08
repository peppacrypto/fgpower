import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";

test("choose a ready-made program, start a workout, record a set, and finish", async ({ page }) => {
  const email = `workout-${Date.now()}@fgpower.dev`;
  await loginAsTestUser(page, email);
  await completeOnboarding(page);

  // Choose program: browse the library and start the flagship template.
  await page.goto("/app/programs");
  await page.getByText("Adaptação FGPOWER").first().click();
  await expect(page.getByRole("heading", { name: /Adaptação FGPOWER/i })).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 15_000 }),
    page.getByRole("button", { name: "Iniciar programa" }).click(),
  ]);

  // Start workout from Today.
  await expect(page.getByText("Sessão A")).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 15_000 }),
    page.getByRole("button", { name: "Iniciar treino" }).click(),
  ]);

  // Record the first working set.
  await expect(page.getByText("Exercício 1 de")).toBeVisible();
  const weightInput = page.locator('input[inputmode="decimal"]').first();
  await weightInput.fill("60");
  const repsInput = page.locator('input[inputmode="decimal"]').nth(1);
  await repsInput.fill("8");
  await page.getByRole("button", { name: "Concluir série" }).click();
  await expect(page.getByText("Descanso")).toBeVisible();

  // Finish the workout (allowed even with sets remaining — a real user may cut a session short).
  await Promise.all([
    page.waitForURL(/\/summary/, { timeout: 15_000 }),
    page.getByRole("button", { name: "Finalizar" }).click(),
  ]);
  await expect(page.getByText("Treino concluído")).toBeVisible();

  // History shows the completed session.
  await page.goto("/app/history");
  await expect(page.getByText("Sessão A")).toBeVisible();
});

test("create a custom program and save it", async ({ page }) => {
  const email = `custom-${Date.now()}@fgpower.dev`;
  await loginAsTestUser(page, email);
  await completeOnboarding(page);

  await page.goto("/app/programs/new");
  await page.getByLabel("Nome do programa").fill("Meu Programa E2E");
  await Promise.all([
    page.waitForURL(/\/app\/programs\/.+\/edit/, { timeout: 15_000 }),
    page.getByRole("button", { name: "Continuar" }).click(),
  ]);

  await page.getByRole("button", { name: "Adicionar exercício" }).click();
  await page.getByPlaceholder("Buscar exercício…").fill("supino");
  await page.waitForTimeout(500);
  await page.locator('dialog button:has-text("Supino")').first().click();

  await expect(page.locator("text=Supino").first()).toBeVisible();
  await page.getByRole("button", { name: "Salvar programa" }).click();
  await expect(page.getByRole("button", { name: /Salvo/ })).toBeVisible({ timeout: 10_000 });
});
