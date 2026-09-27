import "dotenv/config";
import { test, expect, devices, type Page } from "@playwright/test";
import pg from "pg";
import {
  QUINTA,
  expectSetSaved,
  isSetSync,
  newUserOnGd1,
  openFinishSheet,
  recordSet,
  startDayFromToday,
} from "./workout-helpers";

/*
 * The core workout loop (Batch 1, cluster A): ✓ never waits on the server,
 * the rest timer runs on wall-clock time and survives locks, reloads and
 * navigation, saves that fail are kept and resent by themselves, the keyboard
 * walks kg → reps → done, the next exercise is in reach after the last set,
 * and a workout left open is saved on its own day.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use({ ...iPhone, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 150_000 });

// Direct DB access only to check what reached the server and to age a
// session (the UI can't make a 3-day-old workout) — never production.
// Prisma stores DateTime as UTC in `timestamp without time zone`: read it back as UTC.
const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  types: {
    getTypeParser: ((oid: number, format?: "text" | "binary") =>
      oid === pg.types.builtins.TIMESTAMP
        ? (value: string) => new Date(`${value.replace(" ", "T")}Z`)
        : pg.types.getTypeParser(oid, format)) as typeof pg.types.getTypeParser,
  },
});
test.afterAll(async () => {
  await db.end();
});

/** First exercise of the session: its working sets in order. */
async function firstExerciseSets(sessionId: string) {
  const { rows } = await db.query<{ weightKg: number | null; reps: number | null; isCompleted: boolean }>(
    `select l."weightKg", l.reps, l."isCompleted"
       from "SetLog" l join "WorkoutExerciseLog" e on e.id = l."exerciseLogId"
      where l."sessionId" = $1 and l."setType" = 'WORKING' and not l."isExtra"
        and e."sortOrder" = (select min("sortOrder") from "WorkoutExerciseLog" where "sessionId" = $1)
      order by l."setNumber"`,
    [sessionId],
  );
  return rows;
}

const restBar = (page: Page) => page.locator("[data-rest-state]");
// The workout's own announcer (the app shell has other live regions, e.g. the offline banner).
const liveRegion = (page: Page) => page.locator("[data-workout-announcer]");
const restClock = (page: Page) => restBar(page).locator("span[aria-hidden]").first();
const doneButton = (page: Page, n: number) =>
  page.getByRole("button", { name: `Série ${n} feita — toque para desfazer`, exact: true });

/** "2:00" → 120. */
async function restSecondsLeft(page: Page) {
  const [m, s] = (await restClock(page).innerText()).split(":").map(Number);
  return m * 60 + s;
}

test("✓ starts the rest at once on a slow connection; the rest survives a reload, 'Ver técnica' and ±15 s", async ({
  page,
}) => {
  await newUserOnGd1(page, "loop-rest");
  await startDayFromToday(page, QUINTA);

  // A slow gym connection: every set save takes 2.5 s.
  await page.route("**/api/workout/sets", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.getByLabel("Série 1 — kg", { exact: true }).fill("40");
  await page.getByLabel("Série 1 — repetições", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  // The ✓ and the rest show on the tap, while the save is still on its way.
  await expect(doneButton(page, 1)).toBeVisible({ timeout: 1000 });
  await expect(page.getByRole("button", { name: "Pular descanso" })).toBeVisible({ timeout: 1000 });
  await expect(doneButton(page, 1)).toHaveAttribute("data-sync", "sending");
  // Whose rest it is.
  await expect(restBar(page)).toContainText("após Puxada Alta Unilateral no Pulley");
  await expectSetSaved(page, "Série 1");
  await page.unroute("**/api/workout/sets");

  // The countdown is hidden from screen readers (it would be re-read every
  // second); a polite live region announces the start instead.
  await expect(restClock(page)).toHaveAttribute("aria-hidden", "true");
  await expect(liveRegion(page)).toContainText("Descanso de 2 minutos.");

  // ±15 s.
  const before = await restSecondsLeft(page);
  await page.getByRole("button", { name: "Mais 15 segundos" }).click();
  expect(await restSecondsLeft(page)).toBeGreaterThanOrEqual(before + 13);
  await page.getByRole("button", { name: "Menos 15 segundos" }).click();
  await page.getByRole("button", { name: "Menos 15 segundos" }).click();
  expect(await restSecondsLeft(page)).toBeLessThanOrEqual(before - 13);

  // A reload keeps the rest (and the ✓).
  const left = await restSecondsLeft(page);
  await page.reload();
  await expect(restBar(page)).toBeVisible();
  const afterReload = await restSecondsLeft(page);
  expect(afterReload).toBeLessThanOrEqual(left);
  expect(afterReload).toBeGreaterThan(left - 30);
  await expect(doneButton(page, 1)).toBeVisible();

  // So does a trip to "Ver técnica" and back.
  await Promise.all([page.waitForURL(/\/app\/exercises\//), page.getByRole("link", { name: "Ver técnica" }).click()]);
  await page.goBack();
  await expect(page.getByText(/Séries do treino/).first()).toBeVisible({ timeout: 30_000 });
  await expect(restBar(page)).toBeVisible();
  await expect(doneButton(page, 1)).toBeVisible();

  // Un-✓ing the set that started the rest cancels it.
  await doneButton(page, 1).click();
  await expect(page.getByRole("button", { name: "Concluir série 1", exact: true })).toBeVisible();
  await expect(restBar(page)).toHaveCount(0);
  await expect.poll(async () => (await firstExerciseSets(sessionIdOf(page)))[0].isCompleted).toBe(false);
});

function sessionIdOf(page: Page) {
  return new URL(page.url()).pathname.split("/")[3];
}

test("the rest runs on wall-clock time: a locked phone doesn't freeze it, and its end is reported", async ({ page }) => {
  await newUserOnGd1(page, "loop-clock");
  await page.clock.install();
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  await expect(restBar(page)).toHaveAttribute("data-rest-state", "running");
  expect(await restSecondsLeft(page)).toBeGreaterThan(110);

  // The screen locks for 90 s: the wall clock moves on, no timer fires.
  const now = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(now + 90_000);
  await page.clock.runFor(600);
  const left = await restSecondsLeft(page);
  expect(left).toBeLessThanOrEqual(30);
  expect(left).toBeGreaterThan(20);
  await expect(liveRegion(page)).toContainText("30 segundos de descanso.");

  // At zero the bar says so (after vibrating / beeping), then goes away.
  await page.clock.runFor(35_000);
  await expect(restBar(page)).toHaveAttribute("data-rest-state", "ended");
  await expect(restBar(page)).toContainText("Descanso concluído");
  await expect(liveRegion(page)).toContainText("Descanso concluído.");
  await page.clock.runFor(8000);
  await expect(restBar(page)).toHaveCount(0);

  // Back after the rest ended while the phone was locked: how long ago.
  await page.getByRole("button", { name: "Concluir série 2", exact: true }).click();
  await expectSetSaved(page, "Série 2");
  const t = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(t + 160_000);
  await page.clock.runFor(600);
  await expect(restBar(page)).toContainText(/Descanso terminou há 4\d s/);
});

test("a ✓ made without connection stays ✓'d as pending and is sent by itself when the connection returns", async ({
  page,
  context,
}) => {
  await newUserOnGd1(page, "loop-offline");
  const sessionId = await startDayFromToday(page, QUINTA);

  await context.setOffline(true);
  await page.getByLabel("Série 1 — kg", { exact: true }).fill("50");
  await page.getByLabel("Série 1 — repetições", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  await page.getByRole("button", { name: "Concluir série 2", exact: true }).click();

  // Still ✓'d, the rest runs, and nothing asks for a re-tap.
  await expect(doneButton(page, 1)).toBeVisible();
  await expect(doneButton(page, 2)).toBeVisible();
  await expect(restBar(page)).toBeVisible();
  await expect(page.getByText("Pendente · reenviando")).toHaveCount(2, { timeout: 15_000 });
  await expect(page.getByText("2 séries aguardando conexão")).toBeVisible();
  await expect(page.getByText(/Toque ✓ de novo/)).toHaveCount(0);
  expect((await firstExerciseSets(sessionId)).filter((s) => s.isCompleted)).toHaveLength(0);

  await context.setOffline(false);
  await expect(page.getByText(/aguardando conexão/)).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText("Pendente · reenviando")).toHaveCount(0);
  await expect(doneButton(page, 1)).not.toHaveAttribute("data-sync", /.+/);
  const sets = await firstExerciseSets(sessionId);
  expect(sets.slice(0, 2)).toEqual([
    { weightKg: 50, reps: 8, isCompleted: true },
    { weightKg: 50, reps: 8, isCompleted: true },
  ]);
});

test("a ✓ that never got through survives a reload and is sent from the local copy", async ({ page }) => {
  await newUserOnGd1(page, "loop-mirror");
  const sessionId = await startDayFromToday(page, QUINTA);

  // The server can't be reached (weak signal), and then the tab dies.
  await page.route("**/api/workout/sets", (route) => route.abort("connectionreset"));
  await page.getByLabel("Série 1 — kg", { exact: true }).fill("45");
  await page.getByLabel("Série 1 — repetições", { exact: true }).fill("9");
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  await expect(page.getByText("Pendente · reenviando")).toBeVisible({ timeout: 15_000 });
  await page.unroute("**/api/workout/sets");

  const replay = page.waitForResponse(isSetSync, { timeout: 15_000 });
  await page.reload();
  await expect(doneButton(page, 1)).toBeVisible();
  await replay;
  await expect.poll(async () => (await firstExerciseSets(sessionId))[0]).toEqual({
    weightKg: 45,
    reps: 9,
    isCompleted: true,
  });
});

test("keyboard: kg → Next → reps → Done completes the set; the last set brings the next exercise into reach", async ({
  page,
}) => {
  await newUserOnGd1(page, "loop-keys");
  await startDayFromToday(page, QUINTA);

  const kg = page.getByLabel("Série 1 — kg", { exact: true });
  const reps = page.getByLabel("Série 1 — repetições", { exact: true });
  await expect(kg).toHaveAttribute("enterkeyhint", "next");
  await expect(reps).toHaveAttribute("enterkeyhint", "done");
  await kg.click();
  await page.keyboard.type("40");
  await page.keyboard.press("Enter");
  await expect(reps).toBeFocused();
  await page.keyboard.type("10");
  await page.keyboard.press("Enter");
  await expectSetSaved(page, "Série 1");
  await expect(reps).not.toBeFocused();
  await expect(page.getByRole("button", { name: "Pular descanso" })).toBeVisible();

  // Sets 2 and 3 with the suggested numbers; the last one ends the exercise.
  await page.getByRole("button", { name: "Concluir série 2", exact: true }).click();
  await expectSetSaved(page, "Série 2");
  await page.getByRole("button", { name: "Concluir série 3", exact: true }).click();
  await expectSetSaved(page, "Série 3");
  const nextCta = page.locator("button").filter({ hasText: /^Próximo exercício$/ });
  await expect(nextCta).toBeInViewport();

  // The rest bar offers the next exercise too, and then says whose rest it still is.
  const shortcut = restBar(page).getByRole("button", { name: /^Próximo · / });
  await expect(shortcut).toBeVisible();
  const nextName = (await shortcut.innerText()).replace(/^Próximo · /i, "").trim();
  await shortcut.click();
  await expect(page.getByText(/Exercício 2 de 6/)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(new RegExp(nextName, "i"));
  await expect(restBar(page)).toContainText("após Puxada Alta Unilateral no Pulley");
});

/** A São Paulo "dd/mm" for `date`. */
function spDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(date);
}

/** Starts Quinta, records two sets, then moves the whole session 3 days into the past. */
async function staleSessionWithTwoSets(page: Page, label: string) {
  await newUserOnGd1(page, label);
  const sessionId = await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  await recordSet(page, 2, "40", "9");
  await db.query(
    `update "WorkoutSession" set "startedAt" = "startedAt" - interval '3 days' where id = $1`,
    [sessionId],
  );
  // Set 2 done 5 minutes after set 1.
  await db.query(
    `update "SetLog" set "completedAt" = "completedAt" - interval '3 days' + (case when "setNumber" = (
        select max("setNumber") from "SetLog" s2 where s2."exerciseLogId" = "SetLog"."exerciseLogId" and s2."isCompleted")
       then interval '5 minutes' else interval '0' end),
       "updatedAt" = "updatedAt" - interval '3 days'
     where "sessionId" = $1 and "isCompleted"`,
    [sessionId],
  );
  const { rows } = await db.query<{ startedAt: Date; last: Date }>(
    `select s."startedAt", max(l."completedAt") as last from "WorkoutSession" s join "SetLog" l on l."sessionId" = s.id
      where s.id = $1 group by s."startedAt"`,
    [sessionId],
  );
  await page.reload();
  await expect(page.getByText(/Séries do treino/).first()).toBeVisible({ timeout: 30_000 });
  return { sessionId, startedAt: rows[0].startedAt, lastSet: rows[0].last };
}

test("a workout left open days ago shows since when, and saves on its own day with its real duration", async ({
  page,
}) => {
  const { sessionId, startedAt, lastSet } = await staleSessionWithTwoSets(page, "loop-stale");

  // No 72-hour clock: since when it is open.
  await expect(page.getByText(`Aberto desde`)).toContainText(spDate(startedAt));

  const dialog = await openFinishSheet(page);
  await expect(dialog).toContainText("Este treino ficou aberto desde");
  const saveAsDay = dialog.getByRole("button", { name: `Salvar como feito em ${spDate(lastSet)}` });
  await expect(saveAsDay).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Salvar com data de hoje" })).toBeVisible();
  await Promise.all([page.waitForURL(/\/summary/, { timeout: 30_000 }), saveAsDay.click()]);

  const { rows } = await db.query<{ status: string; finishedAt: Date; durationSeconds: number }>(
    `select status::text, "finishedAt", "durationSeconds" from "WorkoutSession" where id = $1`,
    [sessionId],
  );
  expect(rows[0].status).toBe("COMPLETED");
  expect(Math.abs(rows[0].finishedAt.getTime() - lastSet.getTime())).toBeLessThan(2000);
  // First to last set: about 5 minutes, not 72 hours.
  expect(rows[0].durationSeconds).toBeGreaterThanOrEqual(60);
  expect(rows[0].durationSeconds).toBeLessThan(10 * 60);
});

test("finishing a workout left open as today's still times it by its sets, not by the days it stayed open", async ({
  page,
}) => {
  const { sessionId } = await staleSessionWithTwoSets(page, "loop-stale-today");
  const dialog = await openFinishSheet(page);
  await Promise.all([
    page.waitForURL(/\/summary/, { timeout: 30_000 }),
    dialog.getByRole("button", { name: "Salvar com data de hoje" }).click(),
  ]);
  const { rows } = await db.query<{ finishedAt: Date; durationSeconds: number }>(
    `select "finishedAt", "durationSeconds" from "WorkoutSession" where id = $1`,
    [sessionId],
  );
  expect(Math.abs(rows[0].finishedAt.getTime() - Date.now())).toBeLessThan(60_000);
  expect(rows[0].durationSeconds).toBeLessThan(10 * 60);
});

async function finishedRow(sessionId: string) {
  const { rows } = await db.query<{ status: string; finishedAt: Date; durationSeconds: number; totalWorkingSets: number }>(
    `select status::text, "finishedAt", "durationSeconds", "totalWorkingSets" from "WorkoutSession" where id = $1`,
    [sessionId],
  );
  return rows[0];
}

test("a workout left open and continued today saves with today's date timed by today's sets — its own day stays offered", async ({
  page,
}) => {
  const { sessionId, startedAt, lastSet } = await staleSessionWithTwoSets(page, "loop-stale-continued");

  // "Continuar hoje": the third set is done today.
  await recordSet(page, 3, "40", "8");
  await expect(page.getByText("Aberto desde")).toContainText(spDate(startedAt));

  const dialog = await openFinishSheet(page);
  await expect(dialog).toContainText("Treino aberto desde");
  const today = dialog.getByRole("button", { name: "Salvar com data de hoje" });
  const ownDay = dialog.getByRole("button", { name: `Salvar como feito em ${spDate(lastSet)}` });
  await expect(ownDay).toBeVisible();
  // Continued today: today's date is the first choice.
  await expect(today).toBeFocused();
  await Promise.all([page.waitForURL(/\/summary/, { timeout: 30_000 }), today.click()]);

  const row = await finishedRow(sessionId);
  expect(row.status).toBe("COMPLETED");
  expect(Math.abs(row.finishedAt.getTime() - Date.now())).toBeLessThan(60_000);
  expect(row.totalWorkingSets).toBe(3);
  // Today's sets only (one set: the one-minute floor) — never the 72 h since Monday's sets.
  expect(row.durationSeconds).toBeGreaterThanOrEqual(60);
  expect(row.durationSeconds).toBeLessThan(10 * 60);
  await expect(page.getByText(/\b\d{3,} min\b/)).toHaveCount(0);
});

test("a workout left open, edited today and saved on its own day keeps that day and its duration", async ({ page }) => {
  const { sessionId, lastSet } = await staleSessionWithTwoSets(page, "loop-stale-edited");

  // Today: set 2's reps corrected, set 3 typed without ✓ — until the server has them.
  await page.getByLabel("Série 2 — repetições", { exact: true }).fill("8");
  await page.getByLabel("Série 3 — kg", { exact: true }).fill("40");
  await page.getByLabel("Série 3 — repetições", { exact: true }).fill("7");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(page.locator("[data-sync]")).toHaveCount(0, { timeout: 15_000 });
  // Fresh server data too (a reload after continuing must still offer the old day).
  await page.reload();
  await expect(page.getByText(/Séries do treino/).first()).toBeVisible({ timeout: 30_000 });

  const dialog = await openFinishSheet(page);
  const ownDay = dialog.getByRole("button", { name: `Salvar como feito em ${spDate(lastSet)}` });
  await expect(ownDay).toBeVisible();
  await Promise.all([page.waitForURL(/\/summary/, { timeout: 30_000 }), ownDay.click()]);

  const row = await finishedRow(sessionId);
  expect(row.status).toBe("COMPLETED");
  // Dated at the old day's last set, timed by that day's sets (about 5 minutes).
  expect(Math.abs(row.finishedAt.getTime() - lastSet.getTime())).toBeLessThan(2000);
  expect(spDate(row.finishedAt)).toBe(spDate(lastSet));
  expect(row.durationSeconds).toBeGreaterThanOrEqual(60);
  expect(row.durationSeconds).toBeLessThan(10 * 60);
  // The set typed today still counts, and the correction was kept.
  expect(row.totalWorkingSets).toBe(3);
  expect((await firstExerciseSets(sessionId)).map((s) => s.reps)).toEqual([10, 8, 7]);
});

test("discarding returns to Today with a one-time confirmation flag", async ({ page }) => {
  await newUserOnGd1(page, "loop-discard");
  await startDayFromToday(page, QUINTA);
  const dialog = await openFinishSheet(page);
  await dialog.getByRole("button", { name: "Descartar treino" }).click();
  await Promise.all([
    page.waitForURL(/\/app\/today\?descartado=1$/, { timeout: 30_000 }),
    dialog.getByRole("button", { name: "Sim, descartar" }).click(),
  ]);
});

test("a workout with no exercises offers adding them in the program editor, or discarding it", async ({ page }) => {
  await newUserOnGd1(page, "loop-empty");
  const sessionId = await startDayFromToday(page, QUINTA);
  // The day had no exercises when it was started.
  await db.query(`delete from "WorkoutExerciseLog" where "sessionId" = $1`, [sessionId]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Nenhum exercício neste treino." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descartar treino" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/programs\/[^/]+\/edit$/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Adicionar exercícios" }).click(),
  ]);
  const { rows } = await db.query<{ status: string }>(`select status::text from "WorkoutSession" where id = $1`, [
    sessionId,
  ]);
  expect(rows[0].status).toBe("DISCARDED");
});

test("the exercise note sits under the prescription as a chip that says when it is saved", async ({ page, context }) => {
  await newUserOnGd1(page, "loop-note");
  await startDayFromToday(page, QUINTA);
  await page.getByRole("button", { name: "Adicionar nota do exercício/máquina" }).click();
  const note = page.getByLabel("Nota do exercício/máquina");
  await expect(note).toBeFocused();
  await note.fill("Banco na posição 4");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(page.getByText("Nota salva")).toBeVisible({ timeout: 15_000 });
  // Above the set table, not after "Próximo exercício".
  const chip = page.getByRole("button", { name: /^Nota do exercício\/máquina: Banco na posição 4/ });
  await expect(chip).toBeVisible();
  const chipBox = await chip.boundingBox();
  const firstRow = await page.getByLabel("Série 1 — kg", { exact: true }).boundingBox();
  expect(chipBox!.y).toBeLessThan(firstRow!.y);

  await page.reload();
  await expect(chip).toBeVisible();

  // Saving without connection says so and offers to try again.
  await chip.click();
  await context.setOffline(true);
  await page.getByLabel("Nota do exercício/máquina").fill("Banco na posição 5");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(page.getByText("Nota não salva")).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page.getByText("Nota salva")).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByRole("button", { name: /^Nota do exercício\/máquina: Banco na posição 5/ })).toBeVisible();
});
