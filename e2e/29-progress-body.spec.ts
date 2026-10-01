import { expect, test, type Page } from "@playwright/test";
import { IPHONE, loginAsTestUser, newOnboardedUser, revokeSessions, sql, sqlText, userIdOf } from "./fixtures";
import {
  SEGUNDA,
  finishAndSave,
  headerPrescribedCount,
  newUserOnGd1,
  newUserOnTemplate,
  recordSet,
  startDayFromToday,
} from "./workout-helpers";

/**
 * Batch 5 — body, check-in, trends and fatigue (C5: W-083, W-085, W-127,
 * W-128, L-volume-counts-stretches): Corpo logs the weight (7-day average,
 * a typo caught, entries deleted) and the circumferences, privately; Today
 * asks for the day's weigh-in in the weeks the program asks for it; the
 * summary's check-in saves as it's answered and folds into its answers;
 * Progress draws workouts per week and sets per muscle; the fatigue signal
 * suggests a deload — which the user applies, or not, and can undo — never
 * in a planned deload week, and one optional prompt at a time on Today.
 * Every confirmation reads the same after a server re-render (recovery R5),
 * and the saves say so when offline or signed out.
 */

test.use({ ...IPHONE, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 150_000 });

const NBSP = " ";
const SP = "'America/Sao_Paulo'";
/** São Paulo day number of now() minus `days`, in SQL. */
const spDay = (days = 0) => `(((now() - interval '${days} days') AT TIME ZONE ${SP})::date - DATE '1970-01-01')`;
/** A São Paulo wall-clock instant: `week` weeks from this Monday (0 = this week), `day` 0–6 from Monday, at `hour`. */
const spAt = (week: number, day: number, hour = 12) =>
  `((date_trunc('week', now() AT TIME ZONE ${SP}) + interval '${week * 7 + day} days' + interval '${hour} hours') AT TIME ZONE ${SP})`;

/** Daily weigh-ins ending today (`values[0]` the oldest). */
function seedWeighIns(userId: string, values: number[]) {
  const rows = values.map(
    (v, i) =>
      `('bm' || md5(random()::text), ${sqlText(userId)}, 'BODYWEIGHT', ${v}, 'kg', now() - interval '${values.length - 1 - i} days', ${spDay(values.length - 1 - i)})`,
  );
  sql(`INSERT INTO "BodyMetric" (id, "userId", kind, value, unit, "measuredAt", day) VALUES ${rows.join(", ")}`);
}

async function noHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}

/**
 * A server re-render of the page as it stands — what better-auth's session
 * refresh sets off inside any later action (recovery R5). A confirmation an
 * action just showed must read the same after it.
 */
async function rerender(page: Page) {
  const response = page.waitForResponse((r) => r.request().method() === "GET" && r.request().headers()["rsc"] === "1");
  await page.evaluate(() => (window as unknown as { next: { router: { refresh(): void } } }).next.router.refresh());
  await (await response).finished();
  // React commits the new tree in a transition.
  await page.waitForTimeout(300);
}

/**
 * Signed out meanwhile (D-L): the action says so inline with "Entrar" — or the
 * page itself goes to /login (it may do both, one after the other) — coming
 * back to `path`. Nothing here waits on an element: the page can move on.
 */
async function expectSessionExpired(page: Page, path: string) {
  const entrar = page.getByRole("alert").filter({ hasText: "Sua sessão expirou — entre de novo." }).getByRole("link", { name: "Entrar" });
  await expect(async () => {
    const url = new URL(page.url());
    const onLogin = url.pathname === "/login" && url.searchParams.get("sessao") === "expirada" && url.searchParams.get("next") === path;
    const href = (await entrar.count()) > 0 ? await entrar.first().getAttribute("href", { timeout: 1_000 }).catch(() => null) : null;
    expect(onLogin || (href ?? "").includes(encodeURIComponent(path))).toBe(true);
  }).toPass({ timeout: 15_000 });
}

/** Signs the same user in again (after revokeSessions). */
async function loginAgain(page: Page, userId: string) {
  await loginAsTestUser(page, sql(`SELECT email FROM "user" WHERE id = ${sqlText(userId)}`));
}

/** The program week Today shows ("Semana 6 de 13"). */
async function shownWeek(page: Page): Promise<number> {
  const line = (await page.locator("[data-program-card] [data-week-line]").textContent()) ?? "";
  const m = /Semana (\d+) de/i.exec(line);
  expect(m, `week line: ${line}`).not.toBeNull();
  return Number(m![1]);
}

interface Block {
  userId: string;
  enrollmentId: string;
  programId: string;
  days: { id: string; name: string }[];
}

/** The user's GD 1 block (activated through the UI), with its days in order. */
function blockOf(userId: string): Block {
  const [enrollmentId, programId] = sql(
    `SELECT id, "programId" FROM "ProgramEnrollment" WHERE "userId" = ${sqlText(userId)} AND status = 'ACTIVE'`,
  ).split("|");
  const days = sql(`SELECT id, name FROM "UserProgramDay" WHERE "programId" = ${sqlText(programId)} ORDER BY "dayIndex"`)
    .split("\n")
    .map((line) => {
      const [id, name] = line.split("|");
      return { id, name };
    });
  return { userId, enrollmentId, programId, days };
}

let seq = 0;
/** A finished workout of the block on day `day`, straight into the database. `at` is a SQL timestamptz. */
function insertWorkout(
  b: Block,
  opts: { at: string; day: number; week: number; lifts?: { exerciseId: string; kg: number; reps: number }[]; shortSleep?: boolean },
): string {
  const id = `c5w${Date.now().toString(36)}${(seq++).toString(36)}`;
  const lifts = opts.lifts ?? [];
  let q = `INSERT INTO "WorkoutSession" (id, "userId", "enrollmentId", "programId", "programDayId", name, status, "startedAt", "finishedAt",
      "durationSeconds", "programWeek", "programDayIndex", "totalWorkingSets", "updatedAt", "shortSleep", "checkInAt")
    VALUES ('${id}', ${sqlText(b.userId)}, '${b.enrollmentId}', '${b.programId}', '${b.days[opts.day].id}', ${sqlText(b.days[opts.day].name)},
      'COMPLETED', ${opts.at} - interval '50 minutes', ${opts.at}, 3000, ${opts.week}, ${opts.day}, ${Math.max(1, lifts.length * 3)},
      ${opts.at}, ${opts.shortSleep === true}, ${opts.shortSleep ? opts.at : "NULL"});`;
  lifts.forEach((lift, i) => {
    const log = `${id}l${i}`;
    q += `INSERT INTO "WorkoutExerciseLog" (id, "sessionId", "userId", "exerciseId", "sortOrder", "prescribedSets", "repMin", "repMax", "restSeconds")
      VALUES ('${log}', '${id}', ${sqlText(b.userId)}, '${lift.exerciseId}', ${i}, 3, 6, 10, 120);`;
    for (let n = 1; n <= 3; n++) {
      q += `INSERT INTO "SetLog" (id, "userId", "sessionId", "exerciseLogId", "exerciseId", "setNumber", "setType", "weightKg", reps, "isCompleted", "completedAt", "updatedAt")
        VALUES ('${log}s${n}', ${sqlText(b.userId)}, '${id}', '${log}', '${lift.exerciseId}', ${n}, 'WORKING', ${lift.kg}, ${lift.reps}, true, ${opts.at}, ${opts.at});`;
    }
  });
  sql(q);
  return id;
}

/**
 * Puts the block in its fifth or sixth week (started on a Monday five weeks
 * back), with both of its first two key exercises (âncoras/benchmarks)
 * dropping 10 → 8 → 8 reps at the same load over the last two weeks — and,
 * with `shortSleep`, "menos de 6 h" in 3 check-ins of the last 7 days.
 */
function seedFatigue(b: Block, opts: { shortSleep: boolean }) {
  sql(`UPDATE "ProgramEnrollment" SET "startedAt" = ${spAt(-5, 0)}, "currentWeek" = 5 WHERE id = '${b.enrollmentId}'`);
  const anchors = sql(
    `SELECT DISTINCT ON (pe."exerciseId") pe."exerciseId" FROM "UserProgramExercise" pe JOIN "UserProgramDay" d ON d.id = pe."dayId"
     WHERE d."programId" = '${b.programId}' AND pe.notes ~* '(^|[^[:alpha:]])(âncora|benchmark)' LIMIT 2`,
  ).split("\n");
  expect(anchors).toHaveLength(2);
  for (const [ago, reps, week] of [
    [13, 10, 3],
    [6, 8, 4],
    [2, 8, 5],
  ] as const) {
    insertWorkout(b, {
      at: `(now() - interval '${ago} days')`,
      day: 0,
      week,
      lifts: anchors.map((exerciseId) => ({ exerciseId, kg: 60, reps })),
      shortSleep: opts.shortSleep && ago < 7,
    });
  }
  if (opts.shortSleep) insertWorkout(b, { at: `(now() - interval '4 days')`, day: 1, week: 5, shortSleep: true });
}

// ---------------------------------------------------------------------------
// Corpo (W-083)
// ---------------------------------------------------------------------------

test("Corpo: the empty state, a weigh-in, a typo caught, a delete, measurements — and the Progress card", async ({ page }) => {
  await newOnboardedUser(page, { label: "c5-body" });
  const userId = await userIdOf(page);

  await page.goto("/app/progress");
  const card = page.locator("[data-body-card]");
  await expect(card).toContainText("Registrar peso e medidas");
  await Promise.all([page.waitForURL(/\/app\/progress\/body$/), card.click()]);
  await expect(page.getByRole("heading", { level: 1, name: "Corpo" })).toBeVisible();
  await expect(page.getByText("Só você vê. Nada daqui aparece no feed nem no seu perfil.")).toBeVisible();
  await expect(page.getByText("Seu corpo, em números")).toBeVisible();

  const form = page.locator("[data-weigh-in-form]");
  await form.getByLabel("Peso (kg)").fill("81,4");
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  const entries = page.locator("section[aria-labelledby=peso] [data-body-entry]");
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText(`81,4${NBSP}kg`);
  await expect(page.getByText("Seu corpo, em números")).toHaveCount(0);
  // The page redrew around the same form: it still says so.
  await expect(form.getByRole("status")).toContainText("Salvo ✓");
  await rerender(page);
  await expect(entries).toHaveCount(1);

  // Out of range, then 10%+ off the last weigh-in: "Confere?" first.
  await form.getByLabel("Peso (kg)").fill("814");
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("Confira o valor: entre 25 e 350 kg");
  await form.getByLabel("Peso (kg)").fill("91");
  await form.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText(`Confere? Última pesagem: 81,4 kg`);
  await form.getByRole("button", { name: "Corrigir" }).click();
  await expect(form.getByLabel("Peso (kg)")).toBeFocused();
  await expect(entries).toHaveCount(1);

  // Delete it, with an inline "Excluir?" — "Não" gives the focus back to the row's ×.
  const del = page.getByRole("button", { name: /^Excluir pesagem de / });
  await del.click();
  await page.getByRole("button", { name: "Não" }).click();
  await expect(del).toBeFocused();
  await del.click();
  await page.getByRole("button", { name: "Sim" }).click();
  await expect(entries).toHaveCount(0);
  // Its last entry gone, the list goes with the server's redraw: Corpo's own live region says so
  // — "Registro" agrees with any kind — and holds the focus, through a re-render too.
  const announcer = page.locator("[data-body-announcer]");
  await expect(announcer).toHaveText(/^Registro excluído: pesagem de \d{2} [A-Z]{3}\.$/);
  await expect(announcer).toBeFocused();
  await rerender(page);
  await expect(announcer).toHaveText(/^Registro excluído: pesagem de /);
  await expect(announcer).toBeFocused();
  await page.reload();
  await expect(page.getByText("Seu corpo, em números")).toBeVisible();

  // Measurements: Cintura 84 → its row.
  const measures = page.locator("[data-measurements-form]");
  await measures.getByLabel("Cintura").fill("84");
  await measures.getByRole("button", { name: "Salvar medidas" }).click();
  await expect(page.locator('[data-measurement="WAIST"]')).toContainText(/Cintura\s*84\scm/);

  // 20 daily weigh-ins, going down 0,1 kg a day: the 7-day average and its rate.
  seedWeighIns(
    userId,
    Array.from({ length: 20 }, (_, i) => Math.round((83 - i * 0.1) * 10) / 10),
  );
  await page.reload();
  const chart = page.locator('[data-chart="Peso"]');
  await expect(chart).toContainText("Média 7 dias");
  await expect(chart.locator("[data-bodyweight-headline]")).toContainText(/81,4\skg · −0,7 kg\/sem \(−0,8%\)/);
  await expect(chart.getByRole("img")).toHaveAttribute("aria-label", /^Peso, média de 7 dias: de .* em 20 pesagens\.$/);
  await expect(entries).toHaveCount(14);

  await page.goto("/app/progress");
  await expect(card).toContainText("Média 7 dias");
  await expect(card).toContainText("kg/sem");
  await expect(card).toContainText(`Cintura 84${NBSP}cm`);
  await expect(card).toHaveAttribute("href", "/app/progress/body");
  // Its name says what it shows (label in name), not just where it goes.
  await expect(card).toHaveAttribute("aria-label", /^Corpo: Média 7 dias 81,4\skg · −0,7 kg\/sem; Cintura 84\scm — abrir$/);

  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/app/progress/body");
  await noHorizontalScroll(page);

  // Body data is never public: Settings has no switch to show it (the column stays, unused).
  await page.goto("/app/settings");
  const privacy = page.locator("section#privacidade");
  await expect(privacy.getByRole("switch").first()).toBeVisible();
  await expect(privacy.getByRole("switch", { name: /medidas corporais/i })).toHaveCount(0);
  await expect(page.getByText(/medidas corporais publicamente/i)).toHaveCount(0);
});

test("Today asks for the weigh-in in the weeks the program asks for it, and stays calm otherwise", async ({ page }) => {
  await newUserOnGd1(page, "c5-weigh");
  const userId = await userIdOf(page);
  const b = blockOf(userId);

  // GD 1's first week asks for the starting measurements.
  await page.goto("/app/today");
  const row = page.locator("[data-weigh-in]");
  await expect(row).toHaveAttribute("data-weigh-in", "open");
  await expect(row).toContainText("Peso de hoje");
  await expect(page.locator("[data-measure-link]")).toHaveAttribute("href", "/app/progress/body#medidas");
  await row.getByLabel("Peso de hoje").fill("81,4");
  await row.getByRole("button", { name: "Salvar" }).click();
  await expect(row).toHaveAttribute("data-weigh-in", "saved");
  await expect(row).toContainText(`Peso hoje 81,4 kg`);
  // Said out loud from a live region that was there before the save.
  await expect(page.getByRole("status").filter({ hasText: "Peso de hoje salvo: 81,4 kg." })).toBeAttached();
  await page.reload();
  // In a week that asks, the line stays for the day.
  await expect(row).toHaveAttribute("data-weigh-in", "saved");
  await expect(row.getByRole("link", { name: "Corpo" })).toHaveAttribute("href", "/app/progress/body");

  // Corpo says why: the program asks for the starting measurements this week.
  await page.goto("/app/progress/body");
  const banner = page.locator("[data-measure-banner]");
  await expect(banner).toHaveAttribute("data-measure-banner", "measure");
  await expect(banner).toContainText("Semana de medidas · GD 1 · sem. 1");
  await expect(banner).toContainText("O programa pede o peso médio de 7 dias, cintura e membros.");

  // Week 5: nothing asked. Weighed today: nothing shown.
  sql(`UPDATE "ProgramEnrollment" SET "startedAt" = ${spAt(-5, 0)}, "currentWeek" = 5 WHERE id = '${b.enrollmentId}'`);
  await page.reload();
  await expect(banner).toHaveCount(0);
  await page.goto("/app/today");
  await expect(row).toHaveCount(0);
  await expect(page.locator("[data-measure-link]")).toHaveCount(0);

  // The habit (weighed 3 days ago), not yet today: the row, until today's is in.
  sql(`DELETE FROM "BodyMetric" WHERE "userId" = ${sqlText(userId)}`);
  sql(`INSERT INTO "BodyMetric" (id, "userId", kind, value, unit, "measuredAt", day)
       VALUES ('bm' || md5(random()::text), ${sqlText(userId)}, 'BODYWEIGHT', 81.8, 'kg', now() - interval '3 days', ${spDay(3)})`);
  await page.reload();
  await expect(row).toHaveAttribute("data-weigh-in", "open");
  await expect(row.getByLabel("Peso de hoje")).toHaveAttribute("placeholder", "81,8");
  await row.getByLabel("Peso de hoje").fill("81,5");
  await row.getByRole("button", { name: "Salvar" }).click();
  await expect(row).toContainText("salvo ✓");
  // Today now has today's weigh-in (the row's condition is off), yet a re-render keeps the confirmation.
  await rerender(page);
  await expect(row).toHaveAttribute("data-weigh-in", "saved");
  await expect(row).toContainText(`Peso hoje 81,5 kg · salvo ✓`);
  await page.reload();
  await expect(row).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// The post-workout check-in (W-127)
// ---------------------------------------------------------------------------

test("the check-in saves as it's answered, folds into its answers, feeds Corpo, and closes after 24 h", async ({ page }) => {
  await newUserOnGd1(page, "c5-checkin");
  const userId = await userIdOf(page);
  const sessionId = await startDayFromToday(page, SEGUNDA);
  await recordSet(page, 1, "60", "8");
  const summaryUrl = await finishAndSave(page);

  const card = page.locator("[data-check-in]");
  await expect(card).toHaveAttribute("data-check-in", "open");
  await expect(page.getByRole("heading", { name: "Como foi o treino?" })).toBeVisible();
  await expect(card).toContainText("Leva 10 segundos e ajuda a ver sinais de fadiga. Só você vê.");

  const effort = page.getByRole("group", { name: "Esforço do treino" });
  await effort.getByRole("radio", { name: "8", exact: true }).check();
  await expect(card.getByRole("status")).toContainText("Salvo ✓");
  // Answered now (checkInAt is set), the card stays open through a re-render: the rest can still be answered.
  await rerender(page);
  await expect(card).toHaveAttribute("data-check-in", "open");
  await expect(effort.getByRole("radio", { name: "8", exact: true })).toBeChecked();
  await page.getByRole("group", { name: "Dor muscular ao chegar" }).getByRole("radio", { name: "3", exact: true }).check();
  await page.getByRole("button", { name: "Dormi menos de 6 h" }).click();
  await expect(page.getByRole("button", { name: "Dormi menos de 6 h" })).toHaveAttribute("aria-pressed", "true");
  await card.getByLabel("Peso hoje").fill("81,4");
  await card.getByLabel("Nota").click();
  await expect(card.getByRole("status")).toContainText("Salvo ✓");
  await expect
    .poll(() => sql(`SELECT "sessionRpe", soreness, "shortSleep", "bodyweightKg" FROM "WorkoutSession" WHERE id = '${sessionId}'`))
    .toBe("8|3|t|81.4");

  // Keyboard: the arrow keys move along the scale.
  await effort.getByRole("radio", { name: "8", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(effort.getByRole("radio", { name: "9", exact: true })).toBeChecked();
  await expect.poll(() => sql(`SELECT "sessionRpe" FROM "WorkoutSession" WHERE id = '${sessionId}'`)).toBe("9");

  await page.reload();
  await expect(card).toHaveAttribute("data-check-in", "answered");
  await expect(card).toContainText(`Esforço 9/10 · Dor 3/10 · 81,4${NBSP}kg · Sono < 6 h`);
  // The answers wrap at their separators on a small phone.
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 320, height: 640 });
  await noHorizontalScroll(page);
  await page.setViewportSize(viewport);
  await card.getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("group", { name: "Esforço do treino" }).getByRole("radio", { name: "9", exact: true })).toBeChecked();
  await expect(card.getByLabel("Peso hoje")).toHaveValue("81,4");
  // An edit saves the same way and stays open through a re-render.
  const soreness = page.getByRole("group", { name: "Dor muscular ao chegar" });
  await soreness.getByRole("radio", { name: "4", exact: true }).check();
  await expect(card.getByRole("status")).toContainText("Salvo ✓");
  await rerender(page);
  await expect(card).toHaveAttribute("data-check-in", "open");
  await expect(soreness.getByRole("radio", { name: "4", exact: true })).toBeChecked();
  expect(sql(`SELECT soreness FROM "WorkoutSession" WHERE id = '${sessionId}'`)).toBe("4");
  // A long note (saved when the field is left)…
  await card
    .getByLabel("Nota")
    .fill("Ombro pesado no supino; baixar 2,5 kg na próxima. Dormi mal na terça e na quarta, e o joelho reclamou no búlgaro.");
  await card.getByLabel("Peso hoje").click();
  await expect(card.getByRole("status")).toContainText("Salvo ✓");
  await card.getByRole("button", { name: "Pronto" }).click();
  // …folds to two lines under the answers, and never shows the top of a third below them.
  const note = card.locator("[data-check-in-note]");
  const clamp = await note.evaluate((el) => ({
    height: el.clientHeight,
    content: el.scrollHeight,
    line: parseFloat(getComputedStyle(el).lineHeight),
  }));
  expect(clamp.content).toBeGreaterThan(clamp.height);
  expect(clamp.height).toBeLessThanOrEqual(2 * clamp.line + 0.5);
  await expect(card).toContainText(`Esforço 9/10 · Dor 4/10 · 81,4${NBSP}kg · Sono < 6 h`);
  // Focus follows the fold (the button pressed is gone).
  await expect(card.getByRole("button", { name: "Editar" })).toBeFocused();

  // The weight is the day's weigh-in on Corpo, tagged as the workout's.
  await page.goto("/app/progress/body");
  await expect(page.locator("[data-body-entry]").first()).toContainText(`81,4${NBSP}kg`);
  await expect(page.locator("[data-body-entry]").first()).toContainText("treino");

  // "Pular" folds it on this device.
  sql(`UPDATE "WorkoutSession" SET "checkInAt" = NULL, "sessionRpe" = NULL, soreness = NULL, "shortSleep" = false, "bodyweightKg" = NULL WHERE id = '${sessionId}'`);
  await page.goto(summaryUrl);
  await expect(card).toHaveAttribute("data-check-in", "open");
  await card.getByRole("button", { name: "Pular" }).click();
  await expect(card).toHaveAttribute("data-check-in", "skipped");
  await expect(card).toContainText("Check-in do treino");
  await expect(card.getByRole("button", { name: "Responder" })).toBeFocused();
  await page.reload();
  await expect(card).toHaveAttribute("data-check-in", "skipped");
  await card.getByRole("button", { name: "Responder" }).click();
  await expect(page.getByRole("heading", { name: "Como foi o treino?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Como foi o treino?" })).toBeFocused();

  await page.setViewportSize({ width: 320, height: 640 });
  await noHorizontalScroll(page);

  // After 24 h: an answered check-in is a read-only line; no form.
  sql(`UPDATE "WorkoutSession" SET "finishedAt" = now() - interval '25 hours', "updatedAt" = now() - interval '25 hours',
       "checkInAt" = now() - interval '24 hours', "sessionRpe" = 7 WHERE id = '${sessionId}'`);
  await page.reload();
  await expect(card).toHaveAttribute("data-check-in", "answered");
  await expect(card).toContainText("Esforço 7/10");
  await expect(card.getByRole("button", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Como foi o treino?" })).toHaveCount(0);
  expect(userId).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Trends on Progress (W-085)
// ---------------------------------------------------------------------------

test("Progress draws workouts per week and sets per muscle, for the period chosen", async ({ page }) => {
  await newUserOnGd1(page, "c5-trends");
  const userId = await userIdOf(page);
  const b = blockOf(userId);

  // A new user: neither section.
  await page.goto("/app/progress");
  await expect(page.getByRole("heading", { name: "Treinos por semana" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Séries por músculo" })).toHaveCount(0);

  const bench = sql(`SELECT id FROM "Exercise" WHERE slug = 'barbell-bench-press-medium-grip'`);
  sql(`UPDATE "ProgramEnrollment" SET "startedAt" = ${spAt(-6, 0)}, "currentWeek" = 6 WHERE id = '${b.enrollmentId}'`);
  // Six weeks back: 5 of 5 last week, 3 workouts the weeks before.
  for (let w = 6; w >= 1; w--) {
    const days = w === 1 ? [0, 1, 2, 3, 4] : [0, 2, 4];
    for (const d of days) {
      insertWorkout(b, { at: spAt(-w, d, 18), day: d, week: 7 - w, lifts: d === 0 ? [{ exerciseId: bench, kg: 60, reps: 8 }] : [] });
    }
  }

  await page.goto("/app/progress?period=4w");
  const chart = page.locator("[data-weekly-chart]");
  await expect(chart).toHaveAttribute("data-columns", "5");
  await expect(page.locator("[data-weeks-headline]")).toHaveText("média 3,5 por semana · meta 5");
  await expect(chart.getByRole("img")).toHaveAttribute("aria-label", /^Treinos por semana desde .*: média 3,5 por semana, meta 5; 1 de 4 semanas completas na meta; esta semana 0 de 5\.$/);
  const lastWeek = chart.locator("table tbody tr").nth(3);
  await expect(lastWeek).toContainText("5 de 5");
  await expect(lastWeek).toContainText("na meta");
  await expect(lastWeek).toContainText("seg, ter, qua, qui, sex");

  const muscles = page.locator("[data-muscle-volume]");
  await expect(page.locator("[data-muscles-headline]")).toHaveText("média por semana treinada · 4 semanas");
  await expect(muscles.getByRole("group", { name: /^Peitoral: 3 séries por semana, abaixo$/ })).toBeVisible();
  // An untrained group is said once ("nenhuma série"), never "nenhuma série, sem séries".
  await expect(muscles.getByRole("group", { name: "Costas: nenhuma série", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volume por músculo" })).toHaveAttribute("href", "/app/science/training-volume");

  // The period chips change the columns.
  await page.getByRole("link", { name: "8 semanas" }).click();
  await expect(chart).toHaveAttribute("data-columns", "7");

  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/app/progress?period=1y");
  await expect(chart).toBeVisible();
  await noHorizontalScroll(page);

  // A year of weeks (Mon/Wed/Fri since a year ago): 53 thin columns, each day still its own square.
  const dayOfWeekAgo = `((date_trunc('week', now() AT TIME ZONE ${SP}) + (d - 7 * w) * interval '1 day' + interval '18 hours') AT TIME ZONE ${SP})`;
  sql(`INSERT INTO "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "totalWorkingSets", "updatedAt")
    SELECT 'c5y' || md5(${sqlText(userId)} || w || '-' || d), ${sqlText(userId)}, 'Treino livre', 'COMPLETED', t - interval '50 minutes', t, 3, t
    FROM generate_series(7, 60) w, unnest(ARRAY[0, 2, 4]) d, LATERAL (SELECT ${dayOfWeekAgo} AS t) x`);
  await page.reload();
  await expect(chart).toHaveAttribute("data-columns", "53");
  await noHorizontalScroll(page);
  const widest = await chart.locator("[data-day-grid]").evaluate((grid) =>
    Math.max(...Array.from(grid.children).map((col) => (col.firstElementChild as HTMLElement).getBoundingClientRect().width - col.getBoundingClientRect().width)),
  );
  expect(widest).toBeLessThanOrEqual(0.5);
});

// ---------------------------------------------------------------------------
// The fatigue signal and an applied deload (W-128)
// ---------------------------------------------------------------------------

test("fatigue: 2 of the program's triggers suggest a deload — 'Agora não', apply, undo, and a halved workout", async ({ page }) => {
  await newUserOnGd1(page, "c5-fatigue");
  const userId = await userIdOf(page);
  const b = blockOf(userId);
  seedFatigue(b, { shortSleep: true });
  // The weigh-in habit is on (weighed 3 days ago): without the signal, Today would ask for today's.
  sql(`INSERT INTO "BodyMetric" (id, "userId", kind, value, unit, "measuredAt", day)
       VALUES ('bm' || md5(random()::text), ${sqlText(userId)}, 'BODYWEIGHT', 81.8, 'kg', now() - interval '3 days', ${spDay(3)})`);

  await page.goto("/app/today");
  const card = page.locator("[data-fatigue]");
  await expect(card).toHaveAttribute("data-fatigue", "deload");
  await expect(card).toContainText("Sinal de fadiga · 2 de 4 gatilhos");
  await expect(card).toContainText("É uma sugestão; você decide.");
  await card.getByText("Por quê?").click();
  const evidence = card.locator("[data-fatigue-evidence]");
  await expect(evidence).toContainText("Reps caindo 2+ em 2 exercícios-chave por 2 sessões");
  await expect(evidence).toContainText("10 → 8 → 8");
  await expect(evidence).toContainText("Menos de 6 h de sono em 3 check-ins");
  await expect(card).toContainText("Gatilhos do programa:");
  // One optional prompt at a time (fatigue > weigh-in > team invite): neither of the others beside it.
  const weighIn = page.locator("[data-weigh-in]");
  const invite = page.getByRole("heading", { name: "Treine com amigos" });
  await expect(weighIn).toHaveCount(0);
  await expect(invite).toHaveCount(0);

  // "Agora não": closed for this week, on every device (a re-render reads the dismissal back).
  await card.getByRole("button", { name: "Agora não" }).click();
  await expect(card).toHaveCount(0);
  // Said out loud, and the focus waits where the card was (its button is gone)…
  const closed = page.getByRole("status").filter({ hasText: "Sinal de fadiga fechado nesta semana." });
  await expect(closed).toBeFocused();
  await rerender(page);
  await expect(card).toHaveCount(0);
  // …through the re-render the action sets off: Today keeps the closed frame's live region.
  await expect(closed).toBeAttached();
  await expect(closed).toBeFocused();
  // The next prompt in line takes the spot: today's weigh-in — still not the invite.
  await expect(weighIn).toHaveAttribute("data-weigh-in", "open");
  await expect(invite).toHaveCount(0);
  await page.reload();
  await expect(card).toHaveCount(0);
  // Weighed in: nothing else is asked today, so the invite has its turn.
  await weighIn.getByLabel("Peso de hoje").fill("81,5");
  await weighIn.getByRole("button", { name: "Salvar" }).click();
  await expect(weighIn).toHaveAttribute("data-weigh-in", "saved");
  await page.reload();
  await expect(weighIn).toHaveCount(0);
  await expect(invite).toBeVisible();

  // (Reopened for the test.) Apply asks first, saying what changes; "Cancelar" changes nothing.
  sql(`DELETE FROM "UserDismissal" WHERE "userId" = ${sqlText(userId)}`);
  await page.reload();
  await expect(invite).toHaveCount(0);
  const confirm = page.getByRole("dialog", { name: "Aplicar deload nesta semana?" });
  await card.getByRole("button", { name: "Aplicar deload nesta semana" }).click();
  await expect(confirm).toContainText("metade das séries, as mesmas cargas e RIR 3-4");
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(card).toHaveAttribute("data-fatigue", "deload");
  expect(sql(`SELECT cardinality("deloadMondays") FROM "ProgramEnrollment" WHERE id = '${b.enrollmentId}'`)).toBe("0");

  // Apply → the week is a deload; undo → back. Each outcome is read from the server: a re-render keeps it.
  await card.getByRole("button", { name: "Aplicar deload nesta semana" }).click();
  await confirm.getByRole("button", { name: "Aplicar deload" }).click();
  await expect(page.getByText("Deload aplicado nesta semana.")).toBeVisible();
  await expect(card).toHaveAttribute("data-fatigue", "applied");
  // The button pressed is gone with the card it was on: the applied card takes the focus.
  await expect(card).toBeFocused();
  await expect(card).toContainText(/Deload aplicado · semana \d+/);
  await expect(page.locator("[data-program-card] [data-week-line]")).toContainText("Deload");
  await rerender(page);
  await expect(card).toHaveAttribute("data-fatigue", "applied");
  await card.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByText("Deload desfeito.")).toBeVisible();
  await expect(card).toHaveAttribute("data-fatigue", "deload");
  await expect(card).toBeFocused();
  await rerender(page);
  await expect(card).toHaveAttribute("data-fatigue", "deload");

  await card.getByRole("button", { name: "Aplicar deload nesta semana" }).click();
  await confirm.getByRole("button", { name: "Aplicar deload" }).click();
  await expect(card).toHaveAttribute("data-fatigue", "applied");

  // The next workout opens with half the working sets, as a deload workout (Quarta: never trained here).
  const sets = Number(
    sql(`SELECT pe.sets FROM "UserProgramExercise" pe WHERE pe."dayId" = '${b.days[2].id}' ORDER BY pe."sortOrder" LIMIT 1`),
  );
  await startDayFromToday(page, b.days[2].name);
  expect(await headerPrescribedCount(page)).toBe(Math.max(1, Math.floor(sets / 2)));
  await expect(page.getByText(/· deload/i).first()).toBeVisible();
  await recordSet(page, 1, "40", "8");
  await finishAndSave(page);

  // Trained under it: the deload stays (no "Desfazer").
  await page.goto("/app/today");
  await expect(card).toHaveAttribute("data-fatigue", "applied");
  await expect(card.getByRole("button", { name: "Desfazer" })).toHaveCount(0);
});

test("fatigue: the reps drop alone only asks to watch recovery — no apply button", async ({ page }) => {
  await newUserOnGd1(page, "c5-watch");
  const b = blockOf(await userIdOf(page));
  seedFatigue(b, { shortSleep: false });

  await page.goto("/app/today");
  const card = page.locator("[data-fatigue]");
  await expect(card).toHaveAttribute("data-fatigue", "watch");
  await expect(card).toContainText("Atenção à recuperação");
  await expect(card).toContainText("Marque no check-in depois do treino.");
  await expect(card.getByRole("button", { name: "Aplicar deload nesta semana" })).toHaveCount(0);
  await card.getByRole("button", { name: "Entendi" }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(card).toHaveCount(0);
});

test("fatigue: never in the program's own deload week — and the week before it only says to hold on", async ({ page }) => {
  // GD 5 plans a deload in week 7 (and tests in week 13).
  await newUserOnTemplate(page, "c5-planned", "gd-5");
  const b = blockOf(await userIdOf(page));
  seedFatigue(b, { shortSleep: true });
  const card = page.locator("[data-fatigue]");

  // Week 6: the same two triggers, but the program's deload comes next week anyway.
  await page.goto("/app/today");
  let week = await shownWeek(page);
  sql(`UPDATE "ProgramEnrollment" SET "currentWeek" = "currentWeek" + ${6 - week} WHERE id = '${b.enrollmentId}'`);
  await page.reload();
  expect(await shownWeek(page)).toBe(6);
  await expect(card).toHaveAttribute("data-fatigue", "deload-next");
  await expect(card).toContainText("o deload do programa já vem na semana que vem");
  await expect(card.getByRole("button", { name: "Aplicar deload nesta semana" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Entendi" })).toBeVisible();

  // Week 7, the planned deload: no signal at all.
  week = await shownWeek(page);
  sql(`UPDATE "ProgramEnrollment" SET "currentWeek" = "currentWeek" + ${7 - week} WHERE id = '${b.enrollmentId}'`);
  await page.reload();
  expect(await shownWeek(page)).toBe(7);
  await expect(page.locator("[data-program-card] [data-week-line]")).toContainText("Deload");
  await expect(card).toHaveCount(0);
});

test("signed out meanwhile: the weigh-in and the check-in say so and sign back in to the same page", async ({ page, context }) => {
  await newUserOnGd1(page, "c5-expired");
  const userId = await userIdOf(page);

  // Today's weigh-in (GD 1's first week asks for it).
  await page.goto("/app/today");
  const row = page.locator("[data-weigh-in]");
  await expect(row).toHaveAttribute("data-weigh-in", "open");
  await revokeSessions(userId, context);
  await row.getByLabel("Peso de hoje").fill("81,4");
  await row.getByRole("button", { name: "Salvar" }).click();
  await expectSessionExpired(page, "/app/today");
  expect(sql(`SELECT count(*) FROM "BodyMetric" WHERE "userId" = ${sqlText(userId)}`)).toBe("0");

  // The check-in on a summary.
  await loginAgain(page, userId);
  const sessionId = await startDayFromToday(page, SEGUNDA);
  await recordSet(page, 1, "60", "8");
  const summaryUrl = await finishAndSave(page);
  await expect(page.locator("[data-check-in]")).toHaveAttribute("data-check-in", "open");
  await revokeSessions(userId, context);
  await page.getByRole("group", { name: "Esforço do treino" }).getByRole("radio", { name: "7", exact: true }).check();
  await expectSessionExpired(page, new URL(summaryUrl).pathname);
  expect(sql(`SELECT "checkInAt" IS NULL FROM "WorkoutSession" WHERE id = '${sessionId}'`)).toBe("t");
});


test("offline: the weigh-in and the check-in say so, and a retry saves", async ({ page, context }) => {
  await newUserOnGd1(page, "c5-offline");

  // Today's weigh-in keeps what was typed for another try.
  await page.goto("/app/today");
  const row = page.locator("[data-weigh-in]");
  await expect(row).toHaveAttribute("data-weigh-in", "open");
  await context.setOffline(true);
  await row.getByLabel("Peso de hoje").fill("81,4");
  await row.getByRole("button", { name: "Salvar" }).click();
  await expect(row.getByRole("alert")).toContainText("Sem conexão");
  await expect(row.getByLabel("Peso de hoje")).toHaveValue("81,4");
  await context.setOffline(false);
  await row.getByRole("button", { name: "Salvar" }).click();
  await expect(row).toHaveAttribute("data-weigh-in", "saved");

  // The check-in takes the answer back and says why; answering again saves it.
  const sessionId = await startDayFromToday(page, SEGUNDA);
  await recordSet(page, 1, "60", "8");
  await finishAndSave(page);
  const card = page.locator("[data-check-in]");
  const seven = page.getByRole("group", { name: "Esforço do treino" }).getByRole("radio", { name: "7", exact: true });
  await context.setOffline(true);
  // A click, not check(): the card takes the answer back on purpose.
  await seven.click();
  await expect(card.getByRole("alert")).toContainText("Sem conexão");
  await expect(card.getByRole("alert")).toContainText("A alteração foi desfeita.");
  await expect(seven).not.toBeChecked();
  await context.setOffline(false);
  await seven.check();
  await expect(card.getByRole("status")).toContainText("Salvo ✓");
  expect(sql(`SELECT "sessionRpe" FROM "WorkoutSession" WHERE id = '${sessionId}'`)).toBe("7");
});
