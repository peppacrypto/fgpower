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
    // "Ativar programa" appears in both the masthead and the sticky start bar.
    page.getByRole("button", { name: "Ativar programa" }).first().click(),
  ]);

  // Start workout from Today (the suggested-next card; the program's other days
  // are also listed below it, so scope to the heading).
  await expect(page.getByRole("heading", { name: "Sessão A" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    page.getByRole("button", { name: "Iniciar treino" }).click(),
  ]);

  // Record the first working set: every prescribed set is an open row of
  // boxes (kg · reps · RIR · ✓) — fill set 1 and confirm it with ✓.
  await expect(page.getByText("Exercício 1 de")).toBeVisible();
  await page.getByLabel("Série 1 — kg", { exact: true }).fill("60");
  await page.getByLabel("Série 1 — repetições", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Série 1 feita — toque para desfazer", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  // Confirming a working set starts the rest timer.
  await expect(page.getByRole("button", { name: "Pular descanso" })).toBeVisible();

  // Finish the workout (allowed even with sets remaining — a real user may cut a
  // session short). The header "Finalizar" opens an explicit confirmation
  // sheet that says what will be saved; "Finalizar e salvar" ends the session.
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Finalizar e salvar?" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/summary/, { timeout: 30_000 }),
    sheet.getByRole("button", { name: "Finalizar e salvar" }).click(),
  ]);
  await expect(page.getByText("Treino concluído")).toBeVisible();
  await expect(page.getByText("60kg × 8", { exact: true })).toBeVisible();

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
