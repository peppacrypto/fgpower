import { test, expect, devices } from "@playwright/test";
import {
  QUINTA,
  SEGUNDA,
  extraKgBoxes,
  finishAndSave,
  gotoMyProgram,
  headerPrescribedCount,
  newUserOnGd1,
  openFinishSheet,
  prescribedKgBoxes,
  programDayCard,
  recordSet,
  sessionIdFromUrl,
  startDayFromToday,
  todayDayRow,
  waitForWorkoutScreen,
  warmupKgBoxes,
} from "./workout-helpers";

/*
 * Regression suite for the "finished workout didn't save" report (GD 1,
 * Thursday) and for the set table: every prescribed set is an open row of
 * boxes, extras are visibly extra, typed values are never lost, a finished day
 * shows as done, a day can't be opened twice, and an empty workout can't be
 * "finished". Each test uses a fresh account.
 */

// The app is used on a phone at the gym: run at iPhone size (Chromium engine —
// only Chromium is installed for the suite).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use(iPhone);
test.describe.configure({ timeout: 120_000 });

/** "Séries do treino N / T" and other count rows in the finish sheet. */
const sheetRow = (dialog: import("@playwright/test").Locator, label: string) =>
  dialog.getByRole("listitem").filter({ hasText: label });

test("GD 1 Quinta opens one kg/reps box per prescribed set, plus warm-up rows", async ({ page }) => {
  await newUserOnGd1(page, "sets-open");
  await startDayFromToday(page, QUINTA);

  // First exercise of Quinta: 3 prescribed working sets, 2 warm-ups.
  await expect(page.getByText(/Exercício 1 de 6/)).toBeVisible();
  expect(await headerPrescribedCount(page)).toBe(3);
  await expect(page.getByText("Séries do treino · 3", { exact: true })).toBeVisible();

  await expect(prescribedKgBoxes(page)).toHaveCount(3);
  await expect(page.getByRole("textbox", { name: /^Série \d+ — repetições$/ })).toHaveCount(3);
  for (let n = 1; n <= 3; n++) {
    const kg = page.getByRole("textbox", { name: `Série ${n} — kg`, exact: true });
    await expect(kg).toBeVisible();
    await expect(kg).toBeEditable();
    await expect(kg).toHaveValue("");
    await expect(page.getByRole("textbox", { name: `Série ${n} — repetições`, exact: true })).toBeEditable();
    await expect(page.getByRole("button", { name: `Concluir série ${n}`, exact: true })).toBeVisible();
  }

  // Warm-ups are their own block, above the prescribed sets.
  await expect(page.getByRole("region", { name: "Aquecimento" })).toBeVisible();
  await expect(warmupKgBoxes(page)).toHaveCount(2);

  // No extra rows until the user asks for one; the button says it's beyond the prescription.
  await expect(page.getByRole("region", { name: "Séries extras" })).toHaveCount(0);
  await expect(extraKgBoxes(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Adicionar série extra/ })).toContainText("além das 3 do treino");

  // Every exercise of the day opens exactly as many boxes as its header prescribes.
  for (let i = 2; i <= 6; i++) {
    await page.getByRole("button", { name: "Próximo exercício", exact: true }).first().click();
    await expect(page.getByText(new RegExp(`Exercício ${i} de 6`))).toBeVisible();
    const n = await headerPrescribedCount(page);
    expect(n).toBeGreaterThan(0);
    await expect(prescribedKgBoxes(page)).toHaveCount(n);
    await expect(page.getByText(`Séries do treino · ${n}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Adicionar série extra/ })).toContainText(`além das ${n} do treino`);
  }
});

test("'Adicionar série extra' adds a row labelled as extra (E1) that can be removed", async ({ page }) => {
  await newUserOnGd1(page, "sets-extra");
  await startDayFromToday(page, QUINTA);

  const extras = page.getByRole("region", { name: "Séries extras" });
  await expect(extras).toHaveCount(0);

  await page.getByRole("button", { name: /Adicionar série extra/ }).click();
  await expect(extras).toBeVisible({ timeout: 15_000 });
  await expect(extras.getByText("além do prescrito")).toBeVisible();
  await expect(extras.getByText("E1", { exact: true })).toBeVisible();
  await expect(extras.getByRole("textbox", { name: "Série extra 1 — kg", exact: true })).toBeEditable();
  await expect(extras.getByRole("button", { name: "Remover extra 1" })).toBeVisible();
  // The prescription is untouched: still exactly the 3 prescribed rows, none of them extra.
  const prescribed = page.getByRole("region", { name: "Séries prescritas" });
  await expect(prescribedKgBoxes(page)).toHaveCount(3);
  await expect(prescribed.getByRole("textbox", { name: /extra/ })).toHaveCount(0);
  await expect(page.getByText("Séries do treino · 3", { exact: true })).toBeVisible();

  // The extra row lives on the server: it survives a reload.
  await page.reload();
  await waitForWorkoutScreen(page);
  await expect(extraKgBoxes(page)).toHaveCount(1);

  // "Remover extra 1" removes it (and it stays removed).
  await extras.getByRole("button", { name: "Remover extra 1" }).click();
  await expect(extras).toHaveCount(0, { timeout: 15_000 });
  await expect(extraKgBoxes(page)).toHaveCount(0);
  await page.reload();
  await waitForWorkoutScreen(page);
  await expect(extraKgBoxes(page)).toHaveCount(0);
  await expect(prescribedKgBoxes(page)).toHaveCount(3);

  // A recorded extra is counted — and shown — as extra, never as a prescribed set.
  await recordSet(page, 1, "40", "10");
  await page.getByRole("button", { name: /Adicionar série extra/ }).click();
  const extraKg = page.getByRole("textbox", { name: "Série extra 1 — kg", exact: true });
  await expect(extraKg).toBeVisible({ timeout: 15_000 });
  await extraKg.fill("30");
  await page.getByRole("textbox", { name: "Série extra 1 — repetições", exact: true }).fill("15");
  await page.getByRole("button", { name: "Concluir série extra 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Série extra 1 feita — toque para desfazer", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const dialog = await openFinishSheet(page);
  await expect(sheetRow(dialog, "Séries do treino")).toContainText(/1\s*\/\s*14/);
  await expect(sheetRow(dialog, "Séries extras")).toContainText("+1");
  await Promise.all([
    page.waitForURL(/\/summary/, { timeout: 30_000 }),
    dialog.getByRole("button", { name: "Finalizar e salvar" }).click(),
  ]);
  await expect(page.getByText("Treino concluído")).toBeVisible();
  await expect(page.getByText(/2 séries de trabalho/)).toBeVisible();
  await expect(page.locator("span").filter({ hasText: /^extra\s*30kg × 15$/ })).toBeVisible();
  await expect(page.locator("span").filter({ hasText: /^40kg × 10$/ })).toBeVisible();
});

test("typed values without ✓ survive a reload and are saved and counted on finish", async ({ page, browser, baseURL }) => {
  await newUserOnGd1(page, "sets-typed");
  const sessionId = await startDayFromToday(page, QUINTA);

  // Row 1: typed, then the user moves on to the next box (autosave on leaving the row).
  await page.getByRole("textbox", { name: "Série 1 — kg", exact: true }).fill("42,5");
  await page.getByRole("textbox", { name: "Série 1 — repetições", exact: true }).fill("10");
  const autosave = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes(`/app/workout/${sessionId}`),
    { timeout: 15_000 },
  );
  await page.getByRole("textbox", { name: "Série 2 — kg", exact: true }).click();
  await autosave;

  // Row 2: typed and never left — only the local copy has it.
  await page.getByRole("textbox", { name: "Série 2 — kg", exact: true }).fill("45");
  await page.getByRole("textbox", { name: "Série 2 — repetições", exact: true }).fill("8");

  await page.reload();
  await waitForWorkoutScreen(page);
  await expect(page.getByRole("textbox", { name: "Série 1 — kg", exact: true })).toHaveValue("42,5");
  await expect(page.getByRole("textbox", { name: "Série 1 — repetições", exact: true })).toHaveValue("10");
  await expect(page.getByRole("textbox", { name: "Série 2 — kg", exact: true })).toHaveValue("45");
  await expect(page.getByRole("textbox", { name: "Série 2 — repetições", exact: true })).toHaveValue("8");
  // Still not confirmed with ✓.
  await expect(page.getByRole("button", { name: "Concluir série 1", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Concluir série 2", exact: true })).toBeVisible();

  // The autosaved row reached the server: another device (no local copy) sees it.
  const other = await browser.newContext({
    baseURL,
    storageState: { cookies: await page.context().cookies(), origins: [] },
  });
  try {
    const otherPage = await other.newPage();
    await otherPage.goto(`/app/workout/${sessionId}`);
    await waitForWorkoutScreen(otherPage);
    await expect(otherPage.getByRole("textbox", { name: "Série 1 — kg", exact: true })).toHaveValue("42,5");
    await expect(otherPage.getByRole("textbox", { name: "Série 1 — repetições", exact: true })).toHaveValue("10");
  } finally {
    await other.close();
  }

  // Finishing saves and counts both typed rows.
  const dialog = await openFinishSheet(page);
  await expect(dialog.getByRole("heading", { name: "Finalizar e salvar?" })).toBeVisible();
  await expect(sheetRow(dialog, "Séries do treino")).toContainText(/2\s*\/\s*14/);
  await expect(dialog).toContainText("2 séries preenchidas sem ✓ também serão salvas.");
  await Promise.all([
    page.waitForURL(`**/app/workout/${sessionId}/summary`, { timeout: 30_000 }),
    dialog.getByRole("button", { name: "Finalizar e salvar" }).click(),
  ]);
  await expect(page.getByText("Treino concluído")).toBeVisible();
  await expect(page.getByText(/2 séries de trabalho/)).toBeVisible();
  await expect(page.getByText("42,5kg × 10", { exact: true })).toBeVisible();
  await expect(page.getByText("45kg × 8", { exact: true })).toBeVisible();
});

test("after finishing, Today marks the day done, 'Ver' opens its summary, and nothing stays in progress", async ({
  page,
}) => {
  await newUserOnGd1(page, "sets-done");
  const sessionId = await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "50", "9");
  await finishAndSave(page);
  expect(page.url()).toContain(`/app/workout/${sessionId}/summary`);

  await page.goto("/app/today");
  await expect(page.getByText("Treino em andamento", { exact: true })).toHaveCount(0);
  const row = todayDayRow(page, QUINTA);
  await expect(row).toContainText("feito esta semana");
  await expect(row.getByRole("button", { name: "Iniciar", exact: true })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Refazer" })).toBeVisible();
  // The hero no longer suggests Quinta.
  await expect(page.getByRole("heading", { level: 2, name: QUINTA })).toHaveCount(0);

  await Promise.all([
    page.waitForURL(`**/app/workout/${sessionId}/summary`, { timeout: 30_000 }),
    row.getByRole("link", { name: "Ver", exact: true }).click(),
  ]);
  await expect(page.getByText("Treino concluído")).toBeVisible();
  await expect(page.getByText("50kg × 9", { exact: true })).toBeVisible();

  // Reopening the workout itself lands on the saved result — never a blank "Finalizar" screen.
  await page.goto(`/app/workout/${sessionId}`);
  await page.waitForURL(`**/app/workout/${sessionId}/summary`, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Finalizar", exact: true })).toHaveCount(0);

  // The program page agrees.
  await gotoMyProgram(page);
  const card = programDayCard(page, QUINTA);
  await expect(card).toContainText("feito esta semana");
  await expect(card.getByRole("link", { name: "Ver", exact: true })).toHaveAttribute(
    "href",
    `/app/workout/${sessionId}/summary`,
  );
});

test("'Refazer' asks first, then opens a new session that shows last time's loads instead of resetting them", async ({ page }) => {
  await newUserOnGd1(page, "sets-redo");
  const first = await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "50", "9");
  await finishAndSave(page);

  await page.goto("/app/today");
  const row = todayDayRow(page, QUINTA);
  // One stray tap next to "Ver" must not open a blank copy of the day.
  await row.getByRole("button", { name: "Refazer" }).click();
  await expect(row.getByText("O treino salvo continua salvo")).toBeVisible();
  await row.getByRole("button", { name: "Não" }).click();
  await expect(row.getByRole("button", { name: "Refazer" })).toBeVisible();
  await row.getByRole("button", { name: "Refazer" }).click();
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    row.getByRole("button", { name: "Sim, treinar de novo" }).click(),
  ]);
  await waitForWorkoutScreen(page);
  const second = sessionIdFromUrl(page.url());
  expect(second).not.toBe(first);

  await expect(page.getByText("Último treino", { exact: true })).toBeVisible();
  await expect(page.getByText("50kg × 9", { exact: true })).toBeVisible();
  // The empty box suggests last time's numbers.
  await expect(page.getByRole("textbox", { name: "Série 1 — kg", exact: true })).toHaveAttribute("placeholder", "50");
  await expect(page.getByRole("textbox", { name: "Série 1 — repetições", exact: true })).toHaveAttribute(
    "placeholder",
    "9",
  );
});

test("starting the same day again while it is open resumes the same session", async ({ page, context }) => {
  await newUserOnGd1(page, "sets-resume");

  // A second tab, opened on the program page before the workout starts, keeps a stale "Iniciar".
  const staleTab = await context.newPage();
  await gotoMyProgram(staleTab);
  await expect(programDayCard(staleTab, QUINTA).getByRole("button", { name: "Iniciar", exact: true })).toBeEnabled();

  const sessionId = await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "12");

  // The stale "Iniciar" resumes the open session — never a second, empty copy.
  await Promise.all([
    staleTab.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    programDayCard(staleTab, QUINTA).getByRole("button", { name: "Iniciar", exact: true }).click(),
  ]);
  await waitForWorkoutScreen(staleTab);
  expect(sessionIdFromUrl(staleTab.url())).toBe(sessionId);
  await expect(
    staleTab.getByRole("button", { name: "Série 1 feita — toque para desfazer", exact: true }),
  ).toBeVisible();
  await expect(staleTab.getByRole("textbox", { name: "Série 1 — kg", exact: true })).toHaveValue("40");

  // A fresh program page: Quinta is in progress with "Continuar"; other days are locked.
  await gotoMyProgram(page);
  const card = programDayCard(page, QUINTA);
  await expect(card).toContainText("em andamento");
  await expect(card.getByRole("button", { name: "Iniciar", exact: true })).toHaveCount(0);
  await expect(programDayCard(page, SEGUNDA).getByRole("button", { name: "Iniciar", exact: true })).toBeDisabled();
  await Promise.all([
    page.waitForURL(`**/app/workout/${sessionId}`, { timeout: 30_000 }),
    card.getByRole("link", { name: "Continuar" }).click(),
  ]);
  await waitForWorkoutScreen(page);

  // Today: exactly one workout in progress, and it is this one.
  await page.goto("/app/today");
  await expect(page.getByText("Treino em andamento", { exact: true })).toHaveCount(1);
  await expect(todayDayRow(page, QUINTA)).toContainText("em andamento");
  await expect(page.locator(`a[href="/app/workout/${sessionId}"]`).first()).toBeVisible();
});

test("two simultaneous starts of the same day open a single session", async ({ page, context }) => {
  await newUserOnGd1(page, "sets-race");
  const other = await context.newPage();
  await page.goto("/app/today");
  await other.goto("/app/today");

  const start = (p: typeof page) =>
    Promise.all([
      p.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
      todayDayRow(p, QUINTA).getByRole("button", { name: "Iniciar", exact: true }).click(),
    ]);
  await Promise.all([start(page), start(other)]);
  expect(sessionIdFromUrl(other.url())).toBe(sessionIdFromUrl(page.url()));

  await page.goto("/app/today");
  await expect(page.getByText("Treino em andamento", { exact: true })).toHaveCount(1);
});

test("starting another day while a workout with sets is open returns to that workout", async ({ page, context }) => {
  await newUserOnGd1(page, "sets-other-day");
  const staleTab = await context.newPage();
  await staleTab.goto("/app/today");
  await expect(todayDayRow(staleTab, SEGUNDA).getByRole("button", { name: "Iniciar", exact: true })).toBeEnabled();

  const sessionId = await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "12");

  await Promise.all([
    staleTab.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    todayDayRow(staleTab, SEGUNDA).getByRole("button", { name: "Iniciar", exact: true }).click(),
  ]);
  expect(sessionIdFromUrl(staleTab.url())).toBe(sessionId);
  expect(staleTab.url()).toContain("aviso=em-andamento");
  await expect(staleTab.getByText("Este treino ainda está em andamento.")).toBeVisible({ timeout: 30_000 });

  await page.goto("/app/today");
  await expect(page.getByText("Treino em andamento", { exact: true })).toHaveCount(1);
});

test("finishing with no sets offers discarding instead of saving an empty workout", async ({ page }) => {
  await newUserOnGd1(page, "sets-empty");
  const sessionId = await startDayFromToday(page, QUINTA);

  const dialog = await openFinishSheet(page);
  await expect(dialog.getByRole("heading", { name: "Nenhuma série registrada" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Finalizar e salvar" })).toHaveCount(0);

  await dialog.getByRole("button", { name: "Descartar treino" }).click();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    dialog.getByRole("button", { name: "Sim, descartar" }).click(),
  ]);
  await expect(page.getByText("Treino em andamento", { exact: true })).toHaveCount(0);
  const row = todayDayRow(page, QUINTA);
  await expect(row).not.toContainText("feito esta semana");
  await expect(row).not.toContainText("em andamento");
  await expect(row.getByRole("button", { name: "Iniciar", exact: true })).toBeEnabled();

  // The discarded workout can't be reopened, and it never counts as done.
  await page.goto(`/app/workout/${sessionId}`);
  await page.waitForURL(/\/app\/today/, { timeout: 30_000 });
  await page.goto("/app/history");
  await expect(page.getByText(QUINTA)).toHaveCount(0);
});
