import { execSync } from "node:child_process";
import { test, expect, devices, type Page } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";
import { SEGUNDA, finishAndSave, newUserOnGd1, recordSet, startDayFromToday, uniqueEmail } from "./workout-helpers";

/**
 * Program builder on a phone (Batch 1: W-005, W-037, W-038, W-107, W-113;
 * Batch 2: W-114). Each test uses a fresh account and a fresh program.
 */

/** Runs SQL on the local dev database (docker compose's fgpower-postgres). */
function sql(query: string): string {
  return execSync(`docker exec -i fgpower-postgres sh -c 'psql -U "$POSTGRES_USER" -d fgpower -At -v ON_ERROR_STOP=1'`, {
    encoding: "utf8",
    input: query,
  }).trim();
}
const hasDb = (() => {
  try {
    return sql("SELECT 1") === "1";
  } catch {
    return false;
  }
})();

// Drop defaultBrowserType (WebKit): only Chromium is installed for the suite.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use(iPhone);
test.describe.configure({ timeout: 90_000 });

async function newCustomProgram(page: Page, label: string, name = "Meu PPL") {
  await loginAsTestUser(page, uniqueEmail(label));
  await completeOnboarding(page);
  await page.goto("/app/programs/new");
  await page.getByLabel("Nome do programa").fill(name);
  await Promise.all([
    page.waitForURL(/\/app\/programs\/[^/]+\/edit$/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Continuar" }).click(),
  ]);
  return page.url().match(/\/app\/programs\/([^/]+)\/edit$/)![1];
}

async function addExercise(page: Page, query: string) {
  await page.getByRole("button", { name: "Adicionar exercício" }).click();
  const dialog = page.locator("dialog[open]");
  await dialog.getByRole("searchbox", { name: "Buscar exercício" }).fill(query);
  const first = dialog.locator("button.reg-frame").filter({ hasText: new RegExp(query, "i") }).first();
  await expect(first).toBeVisible({ timeout: 15_000 });
  await first.click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}

const rows = (page: Page) => page.locator("[data-row-id]");
const field = (page: Page, row: number, name: string) => rows(page).nth(row).locator(`input[data-field="${name}"]`);
const rowNames = async (page: Page) =>
  (await rows(page).locator("p.font-semibold").allTextContents()).map((s) => s.trim());

async function save(page: Page) {
  await page.getByRole("button", { name: /Salvar programa|Salvo/ }).click();
  await expect(page.getByRole("button", { name: "Salvo" })).toBeVisible({ timeout: 15_000 });
}

test("clearing a number never becomes 0 and saving never hits the error page", async ({ page }) => {
  await newCustomProgram(page, "builder-zero");
  await addExercise(page, "supino");
  await addExercise(page, "remada");

  const sets = field(page, 0, "sets");
  await sets.fill("");
  await expect(sets).toHaveValue(""); // raw text kept while typing
  // Tap Salvar straight away: the box settles on the previous value.
  await save(page);
  await expect(sets).toHaveValue("3");
  await expect(page.getByText("Algo saiu do prumo")).toHaveCount(0);

  // Out of range is clamped on blur, with a visible note.
  await sets.fill("99");
  await sets.blur();
  await expect(sets).toHaveValue("30");
  await expect(rows(page).first().getByText("Séries: máximo 30")).toBeVisible();

  await save(page);
  await page.reload();
  await expect(field(page, 0, "sets")).toHaveValue("30");
  await expect(rows(page)).toHaveCount(2);
});

test("an inverted rep range is fixed on blur and flagged", async ({ page }) => {
  await newCustomProgram(page, "builder-range");
  await addExercise(page, "supino");

  await field(page, 0, "repMin").fill("15");
  await field(page, 0, "repMin").blur();
  await expect(field(page, 0, "repMax")).toHaveValue("15");
  await expect(rows(page).first().getByText("Faixa ajustada: 15–15 · mín ≤ máx")).toBeVisible();

  // Typing the max next gives the intended range.
  await field(page, 0, "repMax").fill("20");
  await field(page, 0, "repMax").blur();
  await expect(field(page, 0, "repMin")).toHaveValue("15");
  await expect(field(page, 0, "repMax")).toHaveValue("20");

  await save(page);
  await page.reload();
  await expect(field(page, 0, "repMin")).toHaveValue("15");
  await expect(field(page, 0, "repMax")).toHaveValue("20");
});

test("the program name is required and saved trimmed", async ({ page }) => {
  await newCustomProgram(page, "builder-name", "Original");
  const name = page.getByRole("textbox", { name: "Nome do programa" });

  await name.fill("   ");
  await page.getByRole("button", { name: "Salvar programa" }).click();
  await expect(page.getByText("Dê um nome ao programa.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvo" })).toHaveCount(0);

  await name.fill("  Novo nome  ");
  await save(page);
  await expect(name).toHaveValue("Novo nome");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Nome do programa" })).toHaveValue("Novo nome");
});

test("leaving with unsaved changes asks first, and a reload offers the draft back", async ({ page }) => {
  const programId = await newCustomProgram(page, "builder-leave");
  await addExercise(page, "supino");

  // A nav tap opens the sheet instead of leaving.
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await nav.getByRole("link", { name: "Exercícios" }).click();
  const sheet = page.getByRole("alertdialog", { name: "Sair sem salvar?" });
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/\/edit$/);
  await sheet.getByRole("button", { name: "Continuar editando" }).click();
  await expect(sheet).toHaveCount(0);

  // A reload (the browser asks first) brings a restore offer.
  page.once("dialog", (d) => d.accept());
  await page.reload();
  await expect(rows(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Restaurar alterações não salvas" }).click();
  await expect(rows(page)).toHaveCount(1);

  // "Salvar e sair" saves, then follows the link.
  await page.getByRole("link", { name: "Programa" }).first().click();
  await sheet.getByRole("button", { name: "Salvar e sair" }).click();
  await page.waitForURL(new RegExp(`/app/programs/${programId}$`), { timeout: 30_000 });

  // Discarding leaves without saving and without a leftover draft.
  await page.goto(`/app/programs/${programId}/edit`);
  await expect(page.getByRole("button", { name: "Restaurar alterações não salvas" })).toHaveCount(0);
  await addExercise(page, "remada");
  await nav.getByRole("link", { name: "Exercícios" }).click();
  await sheet.getByRole("button", { name: "Descartar e sair" }).click();
  await page.waitForURL(/\/app\/exercises/, { timeout: 30_000 });
  await page.goto(`/app/programs/${programId}/edit`);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Restaurar alterações não salvas" })).toHaveCount(0);
});

test("exercises reorder with the arrows and with a touch drag on the grip", async ({ page, context }) => {
  await newCustomProgram(page, "builder-order");
  await addExercise(page, "supino");
  await addExercise(page, "remada");
  await addExercise(page, "agachamento");
  const [a, b, c] = await rowNames(page);

  await rows(page).first().getByRole("button", { name: /para baixo$/ }).tap();
  expect(await rowNames(page)).toEqual([b, a, c]);
  await rows(page).last().getByRole("button", { name: /para cima$/ }).tap();
  expect(await rowNames(page)).toEqual([b, c, a]);

  // Long-press the first grip and drag it below the second row (CDP touch;
  // both grips must be on screen, above the sticky save bar).
  const grips = page.getByRole("button", { name: "Arrastar para reordenar" });
  await expect(grips.first()).toHaveCSS("touch-action", "none");
  await rows(page).first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16));
  const from = (await grips.first().boundingBox())!;
  const to = (await grips.nth(1).boundingBox())!;
  const x = from.x + from.width / 2;
  const y0 = from.y + from.height / 2;
  const y1 = to.y + to.height / 2 + 20;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  await page.waitForTimeout(400);
  for (let i = 1; i <= 15; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / 15 }] });
    await page.waitForTimeout(40);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => rowNames(page)).toEqual([c, b, a]);

  await save(page);
  await page.reload();
  expect(await rowNames(page)).toEqual([c, b, a]);
});

const readStoredDraft = (page: Page, programId: string) =>
  page.evaluate((id) => {
    const raw = localStorage.getItem(`fg:program-draft:${id}`);
    return raw ? (JSON.parse(raw) as { program: { days: { exercises: { exerciseName?: string }[] }[] } }) : null;
  }, programId);

test("dismissing an old draft keeps the local copy of the edits made since", async ({ page }) => {
  const programId = await newCustomProgram(page, "builder-dismiss");
  await addExercise(page, "supino");
  page.once("dialog", (d) => d.accept());
  await page.reload();
  const offer = page.getByRole("button", { name: "Restaurar alterações não salvas" });
  await expect(offer).toBeVisible();

  // New edits while the old draft is still offered, then dismiss the offer.
  await addExercise(page, "remada");
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(offer).toHaveCount(0);
  const stored = await readStoredDraft(page, programId);
  expect(stored?.program.days[0].exercises.map((e) => e.exerciseName)).toEqual([expect.stringMatching(/remada/i)]);

  // A reload (or a killed tab) offers those newer edits back.
  page.once("dialog", (d) => d.accept());
  await page.reload();
  await offer.click();
  expect(await rowNames(page)).toEqual([expect.stringMatching(/remada/i)]);
});

test("a range error found on save is shown once, and the save bar clears when it is fixed", async ({ page }) => {
  const programId = await newCustomProgram(page, "builder-summary");
  await addExercise(page, "supino");
  // An inverted range from an older draft (the number boxes no longer let one through).
  await page.evaluate((id) => {
    const key = `fg:program-draft:${id}`;
    const draft = JSON.parse(localStorage.getItem(key)!);
    Object.assign(draft.program.days[0].exercises[0], { repMin: 15, repMax: 8 });
    localStorage.setItem(key, JSON.stringify({ ...draft, tab: "older-visit" }));
  }, programId);
  page.once("dialog", (d) => d.accept());
  await page.reload();
  await page.getByRole("button", { name: "Restaurar alterações não salvas" }).click();

  await page.getByRole("button", { name: "Salvar programa" }).click();
  const row = rows(page).first();
  await expect(row.getByRole("alert")).toHaveText(/^Rep\. mín: Maior que a Rep\. máx\.$/i);
  const summary = page.getByText(/^Corrija antes de salvar — Rep\. mín em .+: Maior que a Rep\. máx\.$/);
  await expect(summary).toBeVisible();
  await expect(field(page, 0, "repMin")).toBeFocused();

  // Putting the range right from the max side clears the row and the save bar.
  await field(page, 0, "repMax").fill("20");
  await expect(row.getByRole("alert")).toHaveCount(0);
  await expect(summary).toHaveCount(0);
  await save(page);
});

test("saving while a number box still has focus saves what the box shows", async ({ page }) => {
  await newCustomProgram(page, "builder-focused");
  await addExercise(page, "supino");
  await save(page);

  const sets = field(page, 0, "sets");
  await sets.fill("35");
  await expect(sets).toBeFocused();
  // Out of range, not stored yet — but the screen no longer matches "Salvo".
  await expect(page.getByRole("button", { name: "Salvar programa" })).toBeVisible();
  // A click that leaves focus in the box (not every browser moves it on tap).
  await page.getByRole("button", { name: "Salvar programa" }).evaluate((b: HTMLButtonElement) => b.click());
  await expect(page.getByRole("button", { name: "Salvo" })).toBeVisible({ timeout: 15_000 });
  await expect(sets).toHaveValue("30");
  await page.reload();
  await expect(field(page, 0, "sets")).toHaveValue("30");
});

test("a save in another tab keeps this tab's unsaved draft", async ({ page, context }) => {
  const programId = await newCustomProgram(page, "builder-tabs");
  await addExercise(page, "supino");
  expect((await readStoredDraft(page, programId))?.program.days[0].exercises).toHaveLength(1);

  const other = await context.newPage();
  await other.goto(`/app/programs/${programId}/edit`);
  await expect(other.getByRole("button", { name: "Restaurar alterações não salvas" })).toBeVisible();
  await other.getByRole("button", { name: "Salvar programa" }).click();
  await expect(other.getByRole("button", { name: "Salvo" })).toBeVisible({ timeout: 15_000 });
  await other.close();

  expect((await readStoredDraft(page, programId))?.program.days[0].exercises).toHaveLength(1);
});

test("one Escape closes the picker, and the leave sheet keeps focus inside", async ({ page }) => {
  await newCustomProgram(page, "builder-keys");
  await page.getByRole("button", { name: "Adicionar exercício" }).click();
  const search = page.locator("dialog[open]").getByRole("searchbox", { name: "Buscar exercício" });
  await search.fill("supino");
  await search.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);

  await addExercise(page, "supino");
  await page.getByRole("link", { name: "Programa" }).first().click();
  const sheet = page.getByRole("alertdialog", { name: "Sair sem salvar?" });
  await expect(sheet.getByRole("button", { name: "Salvar e sair" })).toBeFocused();
  // Tab walks the sheet's buttons and never reaches the builder or the nav behind it.
  const seen = new Set<string>();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    const at = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return "body";
      return el.closest("dialog[open]") ? `sheet:${el.textContent?.trim()}` : `outside:${el.outerHTML.slice(0, 80)}`;
    });
    expect(at).not.toMatch(/^outside:/);
    seen.add(at);
  }
  expect(seen).toContain("sheet:Descartar e sair");

  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(page).toHaveURL(/\/edit$/);
  await expect(rows(page)).toHaveCount(1);
});

test("saving keeps each exercise row: logged workouts stay linked and unedited settings survive", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  test.setTimeout(150_000);
  await newUserOnGd1(page, "builder-rows");
  // A logged workout on Monday's rows.
  const sessionId = await startDayFromToday(page, SEGUNDA);
  await recordSet(page, 1, "40", "10");
  await finishAndSave(page);

  const programId = sql(`SELECT "programId" FROM "WorkoutSession" WHERE id = '${sessionId}'`);
  const dayId = sql(`SELECT "programDayId" FROM "WorkoutSession" WHERE id = '${sessionId}'`);
  const rowIds = () => sql(`SELECT id FROM "UserProgramExercise" WHERE "dayId" = '${dayId}' ORDER BY "sortOrder"`).split("\n");
  const before = rowIds();
  // Settings a template fork carries but the builder shows no box for.
  sql(`UPDATE "UserProgramExercise" SET tempo = '3-1-1-0', "progressionStrategy" = 'DOUBLE', "loadIncrementKg" = 2.5 WHERE id = '${before[0]}'`);
  const linked = () => sql(`SELECT count(*) FROM "WorkoutExerciseLog" WHERE "sessionId" = '${sessionId}' AND "programExerciseId" IS NOT NULL`);
  const linkedBefore = linked();
  expect(Number(linkedBefore)).toBeGreaterThan(0);

  await page.goto(`/app/programs/${programId}/edit`);
  await page.getByRole("button", { name: SEGUNDA, exact: true }).click();
  await field(page, 0, "sets").fill("5");
  await field(page, 0, "sets").blur();
  await save(page);

  expect(rowIds()).toEqual(before);
  expect(linked()).toBe(linkedBefore);
  expect(sql(`SELECT sets, tempo, "progressionStrategy", "loadIncrementKg" FROM "UserProgramExercise" WHERE id = '${before[0]}'`)).toBe(
    "5|3-1-1-0|DOUBLE|2.5",
  );

  // A duplicate is a new row that keeps the source's settings; the source keeps its id.
  await rows(page).first().getByRole("button", { name: "Duplicar" }).click();
  await save(page);
  const after = rowIds();
  expect(after).toHaveLength(before.length + 1);
  expect(after[0]).toBe(before[0]);
  expect(after.slice(2)).toEqual(before.slice(1));
  expect(sql(`SELECT sets, tempo, "progressionStrategy", "loadIncrementKg" FROM "UserProgramExercise" WHERE id = '${after[1]}'`)).toBe(
    "5|3-1-1-0|DOUBLE|2.5",
  );
  // A second save (with the ids the first one handed back) rewrites nothing.
  await field(page, 1, "sets").fill("4");
  await field(page, 1, "sets").blur();
  await save(page);
  expect(rowIds()).toEqual(after);
  expect(linked()).toBe(linkedBefore);
});
