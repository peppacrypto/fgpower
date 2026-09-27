import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";

test("choose a ready-made program, start a workout, record a set, and finish", async ({ page }) => {
  const email = `workout-${Date.now()}@fgpower.dev`;
  await loginAsTestUser(page, email);
  await completeOnboarding(page);

  // Choose program: browse the library (every program, not just the profile's
  // picks) and open the flagship template.
  await page.goto("/app/programs");
  const clearFilters = page.getByRole("group", { name: "Filtros" }).getByRole("button", { name: "Limpar" });
  if (await clearFilters.isVisible()) await clearFilters.click();
  await page
    .locator('a[href="/app/programs/templates/fgpower-adaptation"]')
    .filter({ hasText: "Adaptação FGPOWER" })
    .first()
    .click();
  // Every exercise of the plan opens its technique page.
  await page.waitForURL(/\/app\/programs\/templates\//);
  await expect(page.getByRole("heading", { level: 1, name: /Adaptação FGPOWER/i })).toBeVisible();
  const planRows = page.locator("#estrutura li a");
  await expect(planRows.first()).toHaveAttribute("href", /^\/app\/exercises\/[^/]+$/);
  expect(await planRows.count()).toBeGreaterThan(5);

  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 15_000 }),
    // Plain activation (next to "Ativar e iniciar Sessão A") lands on Today.
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
  await expect(page.getByText(/^60\s?kg × 8$/)).toBeVisible();

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

test("a program without exercises can't be started, and says why", async ({ page }) => {
  await loginAsTestUser(page, `empty-program-${Date.now()}@fgpower.dev`);
  await completeOnboarding(page);

  await page.goto("/app/programs/new");
  await page.getByLabel("Nome do programa").fill("Programa vazio E2E");
  await Promise.all([
    page.waitForURL(/\/app\/programs\/.+\/edit/, { timeout: 15_000 }),
    page.getByRole("button", { name: "Continuar" }).click(),
  ]);
  const programUrl = page.url().replace(/\/edit$/, "");

  await page.goto(programUrl);
  await expect(page.getByRole("button", { name: "Iniciar este programa" })).toBeDisabled();
  await expect(page.getByText("Adicione ao menos um exercício para iniciar.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Editar programa" })).toHaveAttribute("href", /\/edit$/);

  // Today never shows the half-started program: with nothing running it recommends one.
  await page.goto("/app/today");
  await expect(page.getByTestId("recommended-panel")).toBeVisible();
  await expect(page.getByText("Programa vazio E2E")).toHaveCount(0);
});
