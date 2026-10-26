import "dotenv/config";
import { test, expect, devices, type Page } from "@playwright/test";
import { pool as db } from "./db";
import { sql, sqlText, userIdOf } from "./fixtures";
import {
  QUINTA,
  expectSetSaved,
  finishAndSave,
  newUserOnGd1,
  recordSet,
  startDayFromToday,
  todayDayRow,
  waitForWorkoutScreen,
} from "./workout-helpers";

/*
 * The workout and the user's gym (Minha academia): loads move the way each
 * apparatus does — "Este aparelho sobe de…" sets a machine's own step and the
 * suggestion follows — and an exercise whose machine the gym doesn't have
 * gets a stand-in the gym can do: "Não tenho este aparelho" in the Trocar
 * sheet (with "Desfazer"), or the warning on an exercise already marked; the
 * pick replaces it in the plan for the coming weeks, not only today.
 *
 * Needs the curated gear map (lib/exercises/gear-map.generated.ts): GD 1's
 * Agachamento Hack on the "Hack" (hack-squat) and Cadeira Extensora on the
 * leg-extension machine.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use({ ...iPhone, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 180_000 });

/** GD 1's Tuesday: Agachamento Hack first, Cadeira Extensora second (also on Friday). */
const TERCA = "Terça — Inferior (quadríceps, pesado)";
const HACK = "Agachamento Hack";
const EXTENSORA = "Cadeira Extensora";
/** GD 1 Quinta's first exercise: a cable, 3 × 8–12 (stack 5 kg at a time by default). */
const PULLDOWN = "Puxada Alta Unilateral no Pulley";

const heading = (page: Page) => page.getByRole("heading", { level: 1 });

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The swap sheet's first offered exercise, once its list has settled: its name and its button. */
async function firstOption(page: Page, verb: "Trocar por" | "Trocar no plano por" | "Adicionar") {
  const sheet = page.locator("[data-swap-sheet]");
  await expect(sheet.locator("ul.opacity-60")).toHaveCount(0, { timeout: 20_000 });
  const option = sheet.getByRole("button", { name: new RegExp(`^${verb} `) }).first();
  await expect(option).toBeVisible({ timeout: 20_000 });
  const label = (await option.getAttribute("aria-label")) ?? "";
  return { option, name: label.slice(verb.length + 1) };
}

/** The sheet's list fetched again (after a gear note, the server leaves out what the gym can't do). */
function relisted(page: Page) {
  return page.waitForResponse((r) => r.url().includes("/api/workout/exercises") && r.ok(), { timeout: 20_000 });
}

/** The gear the user's gym doesn't have, as Settings → Minha academia stores it. */
function missingGearOf(userId: string): string[] {
  return sql(`SELECT array_to_string("missingGear", ',') FROM "Profile" WHERE "userId" = ${sqlText(userId)}`)
    .split(",")
    .filter(Boolean);
}

/** The workout's program, row by row: day, position, exercise, its slug and note. */
async function planOf(sessionId: string) {
  const { rows } = await db.query<{ dayIndex: number; sortOrder: number; exerciseId: string; slug: string; notes: string | null }>(
    `select d."dayIndex", pe."sortOrder", pe."exerciseId", x.slug, pe.notes
       from "WorkoutSession" s
       join "UserProgramDay" d on d."programId" = s."programId"
       join "UserProgramExercise" pe on pe."dayId" = d.id
       join "Exercise" x on x.id = pe."exerciseId"
      where s.id = $1
      order by d."dayIndex", pe."sortOrder"`,
    [sessionId],
  );
  return rows;
}

/** The exercise a workout's log holds at a position. */
async function logExerciseAt(sessionId: string, sortOrder: number) {
  const { rows } = await db.query<{ exerciseId: string; substitutedFromExerciseId: string | null }>(
    `select "exerciseId", "substitutedFromExerciseId" from "WorkoutExerciseLog" where "sessionId" = $1 and "sortOrder" = $2`,
    [sessionId, sortOrder],
  );
  return rows[0];
}

/** Opens the day again from Today ("Refazer" → confirm). */
async function redoFromToday(page: Page, dayName: string) {
  await page.goto("/app/today");
  const row = todayDayRow(page, dayName);
  await row.getByRole("button", { name: "Refazer" }).click();
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    row.getByRole("button", { name: "Sim, treinar de novo" }).click(),
  ]);
  await waitForWorkoutScreen(page);
}

test("'Não tenho este aparelho' on the Hack: noted (and undone), and the pick takes its place in the plan for the coming weeks", async ({
  page,
}) => {
  await newUserOnGd1(page, "gear-hack");
  const userId = await userIdOf(page);
  const sessionId = await startDayFromToday(page, TERCA);
  await expect(heading(page)).toHaveText(HACK);
  // As far as the app knows, the gym has it: no warning.
  await expect(page.locator("[data-missing-gear]")).toHaveCount(0);

  await page.getByRole("button", { name: "Trocar", exact: true }).click();
  const sheet = page.locator("[data-swap-sheet]");
  const gear = sheet.locator("[data-swap-gear]");
  await expect(gear).toContainText("Aparelho: Hack");
  // A plain swap first (the machine may only be taken): for today.
  await firstOption(page, "Trocar por");

  // "Não tenho este aparelho": noted in Minha academia, said so, with the way back.
  let list = relisted(page);
  await gear.getByRole("button", { name: "Não tenho este aparelho" }).click();
  await list;
  await expect(gear).toContainText("Anotado: sua academia não tem Hack");
  await expect(gear).toContainText("O escolhido entra no lugar dele no seu plano — hoje e nas próximas semanas.");
  expect(missingGearOf(userId)).toContain("hack-squat");
  // The stand-ins now go into the plan.
  await firstOption(page, "Trocar no plano por");

  // "Desfazer": the gym has it again — a plain swap again.
  list = relisted(page);
  await gear.getByRole("button", { name: "Desfazer" }).click();
  await list;
  await expect(gear.getByRole("button", { name: "Não tenho este aparelho" })).toBeVisible();
  await expect(gear).not.toContainText("Anotado");
  expect(missingGearOf(userId)).not.toContain("hack-squat");
  await firstOption(page, "Trocar por");

  // For real: noted again, and a stand-in picked.
  list = relisted(page);
  await gear.getByRole("button", { name: "Não tenho este aparelho" }).click();
  await list;
  await expect(gear).toContainText("Anotado: sua academia não tem Hack");
  const { option, name: picked } = await firstOption(page, "Trocar no plano por");
  expect(picked).not.toBe(HACK);
  await option.click();
  await expect(sheet).toHaveCount(0, { timeout: 20_000 });
  await expect(heading(page)).toHaveText(picked);
  await expect(page.locator("[data-substituted]")).toContainText(`no lugar de ${HACK}`);
  // GD 1 asks for the Hack on Tuesdays only.
  await expect(page.locator('[data-plan-swap="done"]')).toContainText(
    new RegExp(`Trocado no seu plano: ${escapeRegExp(picked)} no lugar de ${HACK} em 1 dia`),
    { timeout: 20_000 },
  );

  // The plan: Tuesday's first row is the stand-in (the Hack's coaching note gone with it); no day asks for the Hack.
  const standIn = await logExerciseAt(sessionId, 0);
  const plan = await planOf(sessionId);
  expect(plan.filter((r) => r.slug === "hack-squat")).toEqual([]);
  expect(plan.find((r) => r.dayIndex === 1 && r.sortOrder === 0)).toMatchObject({ exerciseId: standIn.exerciseId, notes: null });

  // This workout: a set on the stand-in, then the summary agrees it is in the program.
  await page.getByLabel("Série 1 — kg", { exact: true }).fill("40");
  await page.getByRole("textbox", { name: /^Série 1 — (repetições|segundos)$/ }).fill("10");
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  await expectSetSaved(page, "Série 1");
  await finishAndSave(page);
  const swap = page.locator("[data-swap]");
  await expect(swap).toContainText(`no lugar de ${HACK}`);
  await expect(swap.getByText("No programa ✓")).toBeVisible();
  await expect(swap.getByRole("button", { name: "Usar no programa" })).toHaveCount(0);

  // The coming weeks: Tuesday opens with the stand-in as the plan's own exercise.
  await redoFromToday(page, TERCA);
  await expect(heading(page)).toHaveText(picked);
  await expect(page.locator("[data-substituted]")).toHaveCount(0);
  await expect(page.locator("[data-missing-gear]")).toHaveCount(0);
});

test("an exercise whose machine the gym lacks says so; its Trocar puts the pick in the plan — after the set already done", async ({
  page,
}) => {
  await newUserOnGd1(page, "gear-warning");
  const userId = await userIdOf(page);
  // Settings → Minha academia → Aparelhos, as saved there: no leg extension machine.
  sql(`UPDATE "Profile" SET "missingGear" = ARRAY['leg-extension'] WHERE "userId" = ${sqlText(userId)}`);
  const sessionId = await startDayFromToday(page, TERCA);
  // The Hack is there: no warning on it.
  await expect(heading(page)).toHaveText(HACK);
  await expect(page.locator("[data-missing-gear]")).toHaveCount(0);
  await page.getByRole("button", { name: "Próximo exercício" }).first().click();
  await expect(heading(page)).toHaveText(EXTENSORA);
  const warning = page.locator("[data-missing-gear]");
  await expect(warning).toContainText("Sua academia não tem: Cadeira extensora");

  // A set was logged anyway (done on something else): the pick goes after it, and the set stays.
  await recordSet(page, 1, "30", "12");
  const fridayBefore = (await planOf(sessionId)).filter((r) => r.dayIndex === 4).map((r) => r.exerciseId);

  await warning.getByRole("button", { name: /^Trocar/ }).click();
  const sheet = page.locator("[data-swap-sheet]");
  await expect(sheet.locator("[data-swap-has-data]")).toBeVisible();
  const gear = sheet.locator("[data-swap-gear]");
  await expect(gear).toContainText("Sua academia não tem: Cadeira extensora");
  await expect(gear).toContainText("hoje e nas próximas semanas");
  const { option, name: picked } = await firstOption(page, "Trocar no plano por");
  await option.click();
  await expect(sheet).toHaveCount(0, { timeout: 20_000 });
  await expect(heading(page)).toHaveText(picked);
  // Today: after the extensora, which keeps its set.
  await expect(page.getByText(/Exercício 3 de 7/)).toBeVisible();
  await expect(page.locator("[data-substituted]")).toContainText(`no lugar de ${EXTENSORA}`);

  // The plan: Tuesday and Friday ask for the extensora — Friday keeps it only if it already has the pick.
  const standIn = await logExerciseAt(sessionId, 2);
  expect(standIn.substitutedFromExerciseId).not.toBeNull();
  const fridayHadIt = fridayBefore.includes(standIn.exerciseId);
  const days = fridayHadIt ? 1 : 2;
  await expect(page.locator('[data-plan-swap="done"]')).toContainText(
    new RegExp(`Trocado no seu plano: ${escapeRegExp(picked)} no lugar de ${EXTENSORA} em ${days} ${days === 1 ? "dia" : "dias"}`),
    { timeout: 20_000 },
  );
  const plan = await planOf(sessionId);
  expect(plan.find((r) => r.dayIndex === 1 && r.sortOrder === 1)).toMatchObject({ exerciseId: standIn.exerciseId, notes: null });
  const friday = plan.find((r) => r.dayIndex === 4 && r.sortOrder === 3);
  if (fridayHadIt) expect(friday?.slug).toBe("leg-extensions");
  else expect(friday).toMatchObject({ exerciseId: standIn.exerciseId, notes: null });
  expect(plan.filter((r) => r.slug === "leg-extensions")).toHaveLength(fridayHadIt ? 1 : 0);
  // The set done on the extensora is still there.
  const { rows: done } = await db.query<{ n: string }>(
    `select count(*)::text as n from "SetLog" l join "WorkoutExerciseLog" e on e.id = l."exerciseLogId"
      where l."sessionId" = $1 and e."sortOrder" = 1 and l."isCompleted"`,
    [sessionId],
  );
  expect(done[0].n).toBe("1");
});

test("'Este aparelho sobe de…': the machine's own step moves the suggestion, and the default takes it back", async ({ page }) => {
  await newUserOnGd1(page, "gear-step");
  const userId = await userIdOf(page);
  await startDayFromToday(page, QUINTA);
  await expect(heading(page)).toHaveText(PULLDOWN);
  // A first time says how the load moves too — under the sets, which stay in view.
  await expect(page.locator("[data-load-grid]")).toContainText("Pesos · sobe de 5 kg em 5 kg");
  // 3 × 40 kg × 12 at RIR 3: the top of 8–12 at week 1's target.
  for (let n = 1; n <= 3; n++) {
    await page.getByLabel(`Série ${n} — kg`, { exact: true }).fill("40");
    await page.getByLabel(`Série ${n} — repetições`, { exact: true }).fill("12");
    await page.getByLabel(`Série ${n} — RIR`, { exact: true }).fill("3");
    await page.getByRole("button", { name: `Concluir série ${n}`, exact: true }).click();
    await expectSetSaved(page, `Série ${n}`);
  }
  await finishAndSave(page);
  await redoFromToday(page, QUINTA);
  await expect(heading(page)).toHaveText(PULLDOWN);

  const advice = page.locator("[data-advice]");
  const grid = page.locator("[data-load-grid]");
  const reps1 = page.getByLabel("Série 1 — repetições", { exact: true });
  const kg1 = page.getByLabel("Série 1 — kg", { exact: true });
  // The gym's cable: 5 kg at a time — 45 kg is a +12,5% jump, so first more reps at 40.
  await expect(grid).toContainText("Pesos · sobe de 5 kg em 5 kg");
  await expect(advice).toContainText(/Mantenha 40\skg · busque 14 reps/);
  await expect(reps1).toHaveAttribute("placeholder", "14");

  /** Opens the sheet and picks a step (a chip) — or, `null`, the default. */
  async function setStep(radio: string | null) {
    await grid.getByRole("button", { name: "Ajustar quanto este aparelho sobe" }).click();
    const sheet = page.getByRole("dialog", { name: /Este aparelho sobe de/ });
    await expect(sheet).toBeVisible();
    if (radio) await sheet.getByRole("radio", { name: radio, exact: true }).click();
    else await sheet.getByRole("button", { name: /^Usar o padrão da academia/ }).click();
    // Saved: the sheet closes and the workout is read again.
    await expect(sheet).toHaveCount(0, { timeout: 15_000 });
  }

  // The sheet says what it follows now.
  await grid.getByRole("button", { name: "Ajustar quanto este aparelho sobe" }).click();
  const sheet = page.getByRole("dialog", { name: /Este aparelho sobe de/ });
  await expect(sheet).toContainText("Hoje: sobe de 5 kg em 5 kg — o padrão da sua academia.");
  // Following the default, no step is picked — and there is nothing to go back to.
  await expect(sheet.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: /^Usar o padrão da academia/ })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(sheet).toHaveCount(0);

  // This pulley's stack goes 10 kg at a time: the next load, 50 kg, is +25% — more reps first.
  await setStep("10 quilos");
  await expect(grid).toContainText("Pesos · sobe de 10 kg em 10 kg · ajustado por você");
  await expect(advice).toContainText(/Mantenha 40\skg · busque 19 reps/);
  await expect(advice).toContainText(/O próximo peso, 50\skg, é um salto de \+25%: com 19 reps aqui você chega a 8\+ lá/);
  await expect(reps1).toHaveAttribute("placeholder", "19");
  expect(sql(`SELECT "stepKg"::text FROM "ExerciseLoadStep" WHERE "userId" = ${sqlText(userId)}`)).toBe("10");
  // Kept for the exercise: a reload reads it again.
  await page.reload();
  await waitForWorkoutScreen(page);
  await expect(grid).toContainText("sobe de 10 kg em 10 kg");

  // Fine steps (2,5 kg): 42,5 kg is in reach of the range — go up.
  await setStep("2,5 quilos");
  await expect(grid).toContainText("Pesos · sobe de 2,5 kg em 2,5 kg · ajustado por você");
  await expect(advice).toHaveAttribute("data-advice", "increase");
  await expect(advice).toContainText("Suba para 42,5");
  await expect(kg1).toHaveAttribute("placeholder", "42,5");
  await expect(reps1).toHaveAttribute("placeholder", "8");
  // The warm-ups follow: ~50% of 42,5 lands on 22,5.
  await expect(page.getByRole("region", { name: "Aquecimento" })).toContainText(/~22,5\s?kg × 8 · ~30\s?kg × 4/);

  // Back to the gym's default: 5 kg again, and the exercise's own step is gone.
  await setStep(null);
  await expect(grid).toContainText("Pesos · sobe de 5 kg em 5 kg");
  await expect(grid).not.toContainText("ajustado por você");
  await expect(advice).toContainText(/Mantenha 40\skg · busque 14 reps/);
  expect(sql(`SELECT count(*) FROM "ExerciseLoadStep" WHERE "userId" = ${sqlText(userId)}`)).toBe("0");
});
