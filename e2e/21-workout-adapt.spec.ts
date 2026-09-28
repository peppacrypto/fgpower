import "dotenv/config";
import { test, expect, devices, type Page } from "@playwright/test";
import pg from "pg";
import {
  QUINTA,
  expectSetSaved,
  finishAndSave,
  newUserOnGd1,
  openFinishSheet,
  recordSet,
  sessionIdFromUrl,
  startDayFromToday,
  todayDayRow,
  waitForWorkoutScreen,
} from "./workout-helpers";

/*
 * Adapting the workout to the real gym (Batch 4, cluster A): "Trocar" swaps an
 * exercise for a stand-in (or adds it after one that already has sets),
 * "Adicionar exercício" appends one, the technique opens over the workout and
 * the screen keeps its place, a fresh visit goes back to the workout in
 * progress, a load far from last time's is asked about, and a finished
 * workout can be corrected or deleted for a day. Plus the workout screen's
 * accessibility: a modal finish sheet, focus on the new exercise, words for a
 * half-filled row, tab titles.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use({ ...iPhone, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 180_000 });

// Direct DB access only to check what was saved — never production.
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(async () => {
  await db.end();
});

const FIRST = "Puxada Alta Unilateral no Pulley";
const SECOND = "Remada Sentada na Polia Baixa";
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const announcer = (page: Page) => page.locator("[data-workout-announcer]");

/** The swap sheet's first offered exercise: its name and its button. */
async function firstOption(page: Page, verb: "Trocar por" | "Adicionar") {
  const sheet = page.locator("[data-swap-sheet]");
  const option = sheet.getByRole("button", { name: new RegExp(`^${verb} `) }).first();
  await expect(option).toBeVisible({ timeout: 20_000 });
  const label = (await option.getAttribute("aria-label")) ?? "";
  return { option, name: label.slice(verb.length + 1) };
}

async function exerciseRows(sessionId: string) {
  const { rows } = await db.query<{
    id: string;
    exerciseId: string;
    substitutedFromExerciseId: string | null;
    namePt: string;
    prescribedSets: number;
    notes: string | null;
  }>(
    `select l.id, l."exerciseId", l."substitutedFromExerciseId", x."namePt", l."prescribedSets", l.notes
       from "WorkoutExerciseLog" l join "Exercise" x on x.id = l."exerciseId"
      where l."sessionId" = $1 order by l."sortOrder"`,
    [sessionId],
  );
  return rows;
}

test("Trocar swaps an untouched exercise; the summary counts the one performed and can keep it in the program", async ({
  page,
  context,
}) => {
  await newUserOnGd1(page, "adapt-swap");
  const sessionId = await startDayFromToday(page, QUINTA);
  await expect(page).toHaveTitle(`Treino · ${QUINTA} · FGPOWER`);
  await expect(heading(page)).toHaveText(FIRST);

  await page.getByRole("button", { name: "Trocar", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: FIRST });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Sugestões para trocar")).toBeVisible();
  // Curated relations or, before they land, the same muscle and movement: never the exercise itself.
  const { option, name: picked } = await firstOption(page, "Trocar por");
  expect(picked).not.toBe(FIRST);
  await option.click();
  await expect(sheet).toHaveCount(0, { timeout: 20_000 });
  await expect(heading(page)).toHaveText(picked);
  await expect(page.locator("[data-substituted]")).toContainText(`no lugar de ${FIRST}`);
  // Focus lands on the new exercise's name and the change is announced.
  await expect(heading(page)).toBeFocused();
  await expect(announcer(page)).toContainText(`Trocado por ${picked}`);

  const [swapped] = await exerciseRows(sessionId);
  expect(swapped.namePt).toBe(picked);
  expect(swapped.substitutedFromExerciseId).not.toBeNull();
  // The program's note for the unilateral pulldown doesn't coach the stand-in.
  expect(swapped.notes).toBeNull();
  await expect(page.getByText(/Cada série = braço D \+ E/)).toHaveCount(0);

  // Offline, a pick fails where it was made and nothing changes.
  await page.getByRole("button", { name: "Próximo exercício" }).first().click();
  await expect(heading(page)).toHaveText(SECOND);
  await page.getByRole("button", { name: "Trocar", exact: true }).click();
  const { option: offlinePick } = await firstOption(page, "Trocar por");
  await context.setOffline(true);
  await offlinePick.click();
  await expect(page.locator("[data-swap-sheet]").getByRole("alert")).toContainText("Sem conexão");
  await context.setOffline(false);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-swap-sheet]")).toHaveCount(0);
  await expect(heading(page)).toHaveText(SECOND);

  // Back to the swapped exercise: a set, then finish.
  await page.getByRole("button", { name: "Exercício anterior" }).click();
  await expect(heading(page)).toHaveText(picked);
  await recordSet(page, 1, "30", "10");
  await finishAndSave(page);
  const card = page.locator("[data-swap]");
  await expect(card).toContainText(`no lugar de ${FIRST}`);
  const { rows } = await db.query<{ exerciseId: string }>(
    `select "exerciseId" from "SetLog" where "sessionId" = $1 and "isCompleted" and "setType" = 'WORKING'`,
    [sessionId],
  );
  expect(rows.map((r) => r.exerciseId)).toEqual([swapped.exerciseId]);

  // "Usar no programa": the program's Quinta asks for the swapped-in exercise from now on.
  await card.getByRole("button", { name: "Usar no programa" }).click();
  await expect(card.getByText("No programa ✓")).toBeVisible({ timeout: 15_000 });
  const { rows: program } = await db.query<{ exerciseId: string; notes: string | null }>(
    `select pe."exerciseId", pe.notes from "WorkoutSession" s
       join "UserProgramExercise" pe on pe."dayId" = s."programDayId"
      where s.id = $1 order by pe."sortOrder" limit 1`,
    [sessionId],
  );
  expect(program[0].exerciseId).toBe(swapped.exerciseId);
  expect(program[0].notes).toBeNull();
  // Settled, not a passing flash: the refreshed summary (and a later visit) still says so.
  await page.waitForTimeout(1500);
  await expect(card.getByText("No programa ✓")).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-swap]").getByText("No programa ✓")).toBeVisible();
  await expect(page.locator("[data-swap]").getByRole("button", { name: "Usar no programa" })).toHaveCount(0);
});

test("an exercise with sets gets the pick after it; 'Adicionar exercício' appends one found by search", async ({ page }) => {
  await newUserOnGd1(page, "adapt-add");
  const sessionId = await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");

  await page.getByRole("button", { name: "Trocar", exact: true }).click();
  await expect(page.locator("[data-swap-has-data]")).toBeVisible();
  const { option, name: picked } = await firstOption(page, "Adicionar");
  await option.click();
  await expect(heading(page)).toHaveText(picked, { timeout: 20_000 });
  await expect(page.getByText(/Exercício 2 de 7/)).toBeVisible();
  await expect(page.locator("[data-substituted]")).toContainText(`no lugar de ${FIRST}`);
  // The sets still to do: 1 of 3 was done on the first.
  await expect(page.getByRole("textbox", { name: /^Série \d+ — kg$/ })).toHaveCount(2);
  const rows = await exerciseRows(sessionId);
  expect(rows.map((r) => r.namePt).slice(0, 3)).toEqual([FIRST, picked, SECOND]);

  // The overview offers "Adicionar exercício": a search finds one and it goes at the end.
  await page.getByRole("button", { name: /ver todos/ }).click();
  await page.getByRole("button", { name: "Adicionar exercício" }).first().click();
  const sheet = page.locator("[data-swap-sheet]");
  await expect(sheet.getByRole("heading", { name: "No fim do treino" })).toBeVisible();
  // One already in the workout is never offered again — not even by name (no second copy of it).
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/workout/exercises") && r.url().includes("q=")),
    sheet.getByRole("searchbox", { name: "Buscar exercício" }).fill(SECOND),
  ]);
  await expect(sheet.locator("ul.opacity-60")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: `Adicionar ${SECOND}`, exact: true })).toHaveCount(0);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/workout/exercises") && r.url().includes("q=prancha")),
    sheet.getByRole("searchbox", { name: "Buscar exercício" }).fill("prancha"),
  ]);
  await expect(sheet.getByText("Resultados")).toBeVisible();
  await expect(sheet.locator("ul.opacity-60")).toHaveCount(0);
  const { option: added, name: addedName } = await firstOption(page, "Adicionar");
  expect(addedName.toLowerCase()).toContain("prancha");
  await added.click();
  await expect(heading(page)).toHaveText(addedName, { timeout: 20_000 });
  await expect(page.getByText(/Exercício 8 de 8/)).toBeVisible();
  // The last exercise offers adding another, next to "Finalizar treino".
  await expect(page.getByRole("button", { name: "Adicionar exercício" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Finalizar treino" })).toBeVisible();
});

test("the technique opens over the workout, and the screen comes back to the exercise it was on", async ({ page }) => {
  await newUserOnGd1(page, "adapt-technique");
  const sessionId = await startDayFromToday(page, QUINTA);
  await page.getByRole("button", { name: "Próximo exercício" }).first().click();
  await expect(heading(page)).toHaveText(SECOND);
  // The next exercise has focus (W-161) and the change is announced.
  await expect(heading(page)).toBeFocused();
  await expect(announcer(page)).toContainText(`${SECOND}, exercício 2 de 6`);

  // The photo opens it too; start/end frames and the key cues, over the workout.
  await page.getByRole("button", { name: `Ver técnica de ${SECOND}` }).click();
  const technique = page.getByRole("dialog", { name: SECOND });
  await expect(technique).toBeVisible();
  await expect(technique.getByText("Início", { exact: true })).toBeVisible();
  await expect(technique.getByText("Fim", { exact: true })).toBeVisible();
  await expect(technique.locator("ol li").first()).toBeVisible({ timeout: 15_000 });
  expect(await technique.locator("ol li").count()).toBeLessThanOrEqual(3);
  // A modal: the page behind doesn't scroll along.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(technique).toHaveCount(0);
  await expect(heading(page)).toHaveText(SECOND);

  // The full page and back: still on the second exercise, not the first one to do.
  await page.getByRole("button", { name: "Ver técnica", exact: true }).click();
  await Promise.all([
    page.waitForURL(/\/app\/exercises\/[^/?]+\?from=/),
    page.getByRole("dialog", { name: SECOND }).getByRole("link", { name: "Ver página completa" }).click(),
  ]);
  const from = new URL(page.url()).searchParams.get("from") ?? "";
  expect(from).toMatch(new RegExp(`^/app/workout/${sessionId}\\?ex=`));
  await page.goBack();
  await waitForWorkoutScreen(page);
  await expect(heading(page)).toHaveText(SECOND);
  // A reload lands there too.
  await page.reload();
  await waitForWorkoutScreen(page);
  await expect(heading(page)).toHaveText(SECOND);

  // No sheet for the exercise on the server (404): said as such — not a lost connection to retry.
  await page.route("**/api/workout/technique**", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"not-found"}' }),
  );
  await page.getByRole("button", { name: "Ver técnica", exact: true }).click();
  const missing = page.getByRole("dialog", { name: SECOND });
  await expect(missing.getByText("Sem instruções para este exercício.")).toBeVisible();
  await expect(missing.getByText(/Sem conexão/)).toHaveCount(0);
  await expect(missing.getByRole("button", { name: "Tentar de novo" })).toHaveCount(0);
  await page.unroute("**/api/workout/technique**");
});

test("a fresh visit to Today goes back to the workout in progress, once", async ({ page, context }) => {
  await newUserOnGd1(page, "adapt-resume");
  const sessionId = await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  // The same tab: Today is Today.
  await page.goto("/app/today");
  await expect(page.getByText("Treino em andamento", { exact: true })).toBeVisible();

  // The app reopened (a new visit): Today sends it straight back to the workout…
  const reopened = await context.newPage();
  await reopened.goto("/app/today");
  await reopened.waitForURL(`**/app/workout/${sessionId}`, { timeout: 30_000 });
  await waitForWorkoutScreen(reopened);
  // …only once: "Hoje" afterwards is Today.
  await reopened.goto("/app/today");
  await expect(reopened.getByText("Treino em andamento", { exact: true })).toBeVisible();
  await expect(reopened).toHaveURL(/\/app\/today/);
  await reopened.close();
});

test("a load far from last time's is asked about before it counts", async ({ page }) => {
  await newUserOnGd1(page, "adapt-typo");
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "22,5", "10");
  await finishAndSave(page);
  await page.goto("/app/today");
  const row = todayDayRow(page, QUINTA);
  await row.getByRole("button", { name: "Refazer" }).click();
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    row.getByRole("button", { name: "Sim, treinar de novo" }).click(),
  ]);
  await waitForWorkoutScreen(page);

  const kg = page.getByLabel("Série 1 — kg", { exact: true });
  await kg.fill("225");
  await page.getByLabel("Série 1 — repetições", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  const check = page.locator("[data-set-row]").first().getByRole("alert");
  await expect(check).toContainText(/225\s?kg\? Último: 22,5\s?kg/);
  // Not counted, no rest.
  await expect(page.getByRole("button", { name: "Série 1 feita — toque para desfazer", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-rest-state]")).toHaveCount(0);
  await expect(kg).toHaveAttribute("aria-invalid", "true");
  // Until it is confirmed, the typo isn't the grey load of the set below (a ✓ there would log it unasked).
  await expect(page.getByLabel("Série 2 — kg", { exact: true })).not.toHaveAttribute("placeholder", "225");
  // "Corrigir": back in the kg box, selected.
  await check.getByRole("button", { name: "Corrigir" }).click();
  await expect(kg).toBeFocused();
  await page.keyboard.type("25");
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  await expectSetSaved(page, "Série 1");

  // A real jump, confirmed once: it counts.
  await page.getByLabel("Série 2 — kg", { exact: true }).fill("40");
  await page.getByLabel("Série 2 — repetições", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Concluir série 2", exact: true }).click();
  const check2 = page.locator("[data-set-row]").nth(1).getByRole("alert");
  await expect(check2).toContainText(/40\s?kg\? Último: 22,5\s?kg/);
  await check2.getByRole("button", { name: "Está certo" }).click();
  await expectSetSaved(page, "Série 2");

  // Typed and left without ✓ — it would be saved as typed at the finish: asked when the row is left…
  await page.getByLabel("Série 3 — kg", { exact: true }).fill("225");
  await page.getByLabel("Série 3 — repetições", { exact: true }).fill("8");
  await heading(page).focus();
  const check3 = page.locator("[data-set-row]").nth(2).getByRole("alert");
  await expect(check3).toContainText(/225\s?kg\? Último: 22,5\s?kg/);
  // …and again on the finish sheet, above the save.
  let dialog = await openFinishSheet(page);
  const question = dialog.locator("[data-finish-load-check]");
  await expect(question).toContainText(/225\s?kg\? Último: 22,5\s?kg/);
  await expect(question).toContainText(`${FIRST} · Série 3`);
  // "Corrigir": back in that kg box.
  await question.getByRole("button", { name: "Corrigir" }).click();
  await expect(dialog).toHaveCount(0);
  const kg3 = page.getByLabel("Série 3 — kg", { exact: true });
  await expect(kg3).toBeFocused();
  await kg3.fill("25");
  dialog = await openFinishSheet(page);
  await expect(dialog.locator("[data-finish-load-check]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  // "Está certo" at the finish: saved as typed, and the save button has focus.
  await kg3.fill("80");
  await heading(page).focus();
  dialog = await openFinishSheet(page);
  await dialog.locator("[data-finish-load-check]").getByRole("button", { name: "Está certo" }).click();
  await expect(dialog.locator("[data-finish-load-check]")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Finalizar e salvar" })).toBeFocused();
});

/**
 * Puts set `n`'s row just above the rest bar (where a user's drag leaves it),
 * types a load far from last time's and taps ✓: the question opens below the
 * row — under the bar — so it must be brought into view, buttons reachable.
 */
async function askUnderRestBar(page: Page, n: number) {
  const bar = page.locator("[data-rest-state]");
  await expect(bar).toBeVisible();
  const kg = page.getByLabel(`Série ${n} — kg`, { exact: true });
  await kg.evaluate((input) => {
    const bar = document.querySelector("[data-rest-state]")!.getBoundingClientRect();
    const grid = input.closest("[data-set-row]")!.firstElementChild!.getBoundingClientRect();
    window.scrollBy(0, grid.bottom - bar.top + 4);
  });
  await kg.fill("225");
  await page.getByLabel(`Série ${n} — repetições`, { exact: true }).fill("8");
  await page.getByRole("button", { name: `Concluir série ${n}`, exact: true }).click();
  const check = page.locator("[data-set-row]").filter({ has: kg }).getByRole("alert");
  await expect(check).toContainText(/225\s?kg\? Último: 22,5\s?kg/);
  // Clear of the bar once the scroll settles, and "Está certo" is what a tap there reaches.
  await expect
    .poll(
      () =>
        check.evaluate((el) => {
          const barTop = document.querySelector("[data-rest-state]")!.getBoundingClientRect().top;
          const box = el.getBoundingClientRect();
          const ok = el.querySelectorAll("button")[1].getBoundingClientRect();
          const hit = document.elementFromPoint(ok.left + ok.width / 2, ok.top + ok.height / 2);
          return box.top >= 0 && box.bottom <= barTop && hit?.textContent === "Está certo";
        }),
      { timeout: 5_000 },
    )
    .toBe(true);
  return check;
}

test("the load question ✓ raises under the rest bar is brought into view (390 and 320 wide)", async ({ page }) => {
  await newUserOnGd1(page, "adapt-typo-bar");
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "22,5", "10");
  await finishAndSave(page);
  await page.goto("/app/today");
  const day = todayDayRow(page, QUINTA);
  await day.getByRole("button", { name: "Refazer" }).click();
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    day.getByRole("button", { name: "Sim, treinar de novo" }).click(),
  ]);
  await waitForWorkoutScreen(page);
  // Set 1 as last time: the rest bar shows.
  await recordSet(page, 1, "22,5", "10");

  // iPhone 13 (390 × 664).
  const check = await askUnderRestBar(page, 2);
  await check.getByRole("button", { name: "Está certo" }).click();
  await expectSetSaved(page, "Série 2");

  // The narrowest phones: the question wraps and the bar is taller.
  await page.setViewportSize({ width: 320, height: 568 });
  const check3 = await askUnderRestBar(page, 3);
  await check3.getByRole("button", { name: "Corrigir" }).click();
  await expect(page.getByLabel("Série 3 — kg", { exact: true })).toBeFocused();
});

test("a finished workout: '⋯' edits a set (records follow) and deletes the workout (the week follows)", async ({ page }) => {
  await newUserOnGd1(page, "adapt-correct");
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  await recordSet(page, 2, "40", "10");
  const summary = await finishAndSave(page);
  const sessionId = sessionIdFromUrl(summary);
  const { rows: before } = await db.query<{ userId: string; enrollmentId: string; updatedAt: Date }>(
    `select "userId", "enrollmentId", "updatedAt" from "WorkoutSession" where id = $1`,
    [sessionId],
  );

  await page.getByRole("button", { name: "Opções do treino" }).click();
  await expect(page.getByText(/^Correções até /)).toBeVisible();
  await Promise.all([
    page.waitForURL(`**/app/workout/${sessionId}/summary/editar`, { timeout: 30_000 }),
    page.getByRole("link", { name: "Editar séries" }).click(),
  ]);
  await expect(page).toHaveTitle(`Editar séries · ${QUINTA} · FGPOWER`);
  await page.getByLabel("Série 2 — kg", { exact: true }).fill("42,5");
  await Promise.all([
    page.waitForURL(`**/app/workout/${sessionId}/summary`, { timeout: 30_000 }),
    page.getByRole("button", { name: "Salvar correções" }).click(),
  ]);
  await expect(page.getByText("Correções salvas · recordes recalculados ✓")).toBeVisible();
  await expect(page.getByText(/^42,5\s?kg × 10$/)).toBeVisible();
  const { rows } = await db.query<{ totalVolumeKg: number }>(`select "totalVolumeKg" from "WorkoutSession" where id = $1`, [
    sessionId,
  ]);
  expect(Number(rows[0].totalVolumeKg)).toBe(825);
  // A correction doesn't move the window: it runs from the save.
  const { rows: after } = await db.query<{ updatedAt: Date }>(`select "updatedAt" from "WorkoutSession" where id = $1`, [
    sessionId,
  ]);
  expect(after[0].updatedAt.getTime()).toBe(before[0].updatedAt.getTime());

  await page.getByRole("button", { name: "Opções do treino" }).click();
  await page.getByRole("button", { name: "Excluir treino" }).click();
  const confirm = page.getByRole("alertdialog", { name: `Excluir “${QUINTA}”?` });
  await expect(confirm).toBeVisible();
  // The latest workout: the week and the program go back as they were.
  await expect(confirm).toContainText("a semana e o programa voltam a contar");
  // Cancel is the safe default.
  await expect(confirm.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    confirm.getByRole("button", { name: "Excluir treino" }).click(),
  ]);
  await expect(page.getByText("Treino excluído do histórico.")).toBeVisible();
  await expect(todayDayRow(page, QUINTA)).not.toContainText("feito esta semana");
  const { rows: left } = await db.query(`select id from "WorkoutSession" where id = $1`, [sessionId]);
  expect(left).toHaveLength(0);
  // The block's only workout: the program is back where it started — its first day next, no workout counted.
  const { rows: enrollment } = await db.query<{ nextDayIndex: number; currentWeek: number; completedSessions: number; first: number }>(
    `select e."nextDayIndex", e."currentWeek", e."completedSessions",
            (select min(d."dayIndex") from "UserProgramDay" d where d."programId" = e."programId") as first
       from "ProgramEnrollment" e where e.id = $1`,
    [before[0].enrollmentId],
  );
  expect(enrollment[0].completedSessions).toBe(0);
  expect(enrollment[0].currentWeek).toBe(1);
  expect(enrollment[0].nextDayIndex).toBe(enrollment[0].first);
});

test("a workout saved later on its own day can still be corrected for a day after the save", async ({ page }) => {
  await newUserOnGd1(page, "adapt-late-save");
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  const summary = await finishAndSave(page);
  const sessionId = sessionIdFromUrl(summary);
  // As "Salvar como feito em …" dates it: finished days ago, saved just now.
  await db.query(
    `update "WorkoutSession" set "startedAt" = "startedAt" - interval '3 days', "finishedAt" = "finishedAt" - interval '3 days'
      where id = $1`,
    [sessionId],
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Opções do treino" })).toBeVisible();
  // A day after the save, the window is closed.
  await db.query(`update "WorkoutSession" set "updatedAt" = "updatedAt" - interval '25 hours' where id = $1`, [sessionId]);
  await page.reload();
  await expect(page.getByText("Salvo no histórico ✓")).toBeVisible();
  await expect(page.getByRole("button", { name: "Opções do treino" })).toHaveCount(0);
});

test("workout accessibility: modal finish sheet, words for a half-filled row, readable headers", async ({ page }) => {
  await newUserOnGd1(page, "adapt-a11y");
  await startDayFromToday(page, QUINTA);

  // The column headers read at arm's length: 12px and up.
  const header = page.getByText("Série", { exact: true }).first();
  expect(parseFloat(await header.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);

  // Only kg typed: once the row is left, it says what's missing — tied to the empty box.
  await page.getByLabel("Série 1 — kg", { exact: true }).fill("40");
  await page.getByLabel("Série 2 — kg", { exact: true }).focus();
  const reps = page.getByLabel("Série 1 — repetições", { exact: true });
  await expect(reps).toHaveAttribute("aria-invalid", "true");
  const describedBy = await reps.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  // (A first time: ✓ would take the program's 12 reps.)
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveText("Falta reps · ✓ preenche 12");
  await expect(page.locator(`[id="${describedBy}"]`)).toBeVisible();

  // The finish sheet is a modal dialog: Tab never reaches the sets behind it (past its
  // last button focus goes to the browser's own UI — the page's body — and comes back).
  const dialog = await openFinishSheet(page);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement) || document.activeElement === document.body),
    ).toBe(true);
  }
  await expect(page.getByRole("textbox", { name: "Série 1 — kg", exact: true })).not.toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
});
