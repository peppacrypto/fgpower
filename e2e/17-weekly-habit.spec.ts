import { execSync } from "node:child_process";
import { devices, expect, test, type Page } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";
import { finishAndSave, recordSet, startDayFromToday, uniqueEmail } from "./workout-helpers";

/*
 * Batch 3, cluster A — the weekly habit on Today: the week strip and a weekly
 * (never daily) streak, the last workout and a welcome back after a gap, a
 * rest day after a workout, the days left over from last week (continue or
 * start over), the program week's guidance, and the end of a block.
 *
 * Past weeks are seeded straight into the local database (finished workouts
 * without set rows — all the streak and the rotation read), dated on the São
 * Paulo calendar relative to this week, so every check holds on any weekday.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use({ ...iPhone, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 120_000 });

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

/** 18:00 in São Paulo, `week` weeks from this Monday (0 = this week, -1 = last week) and `day` days after Monday, as stored (UTC). */
const spAt = (week: number, day: number, hour = 18) =>
  `(((date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') + interval '${week * 7 + day} days' + interval '${hour} hours') AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC')`;

interface Seeded {
  /** Weeks from this Monday. */
  week: number;
  /** Days after that Monday. */
  day: number;
  dayIndex: number;
  programWeek: number;
}

/** A new user, onboarded, on a template. Returns their id. */
async function newUserOn(page: Page, label: string, slug: string) {
  const email = uniqueEmail(label);
  await loginAsTestUser(page, email);
  await completeOnboarding(page);
  await page.goto(`/app/programs/templates/${slug}`);
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Ativar programa" }).first().click(),
  ]);
  return sql(`SELECT id FROM "user" WHERE email = '${email}'`);
}

/** Finished workouts of the active enrollment (no set rows), and its counters and start. */
function seedProgram(
  userId: string,
  p: { startWeek: number; startDay?: number; currentWeek: number; nextDayIndex: number; workouts: Seeded[] },
) {
  const [enrollmentId, programId] = sql(
    `SELECT id || '|' || "programId" FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`,
  ).split("|");
  const days = sql(`SELECT "dayIndex" || '|' || id FROM "UserProgramDay" WHERE "programId" = '${programId}' ORDER BY "dayIndex"`)
    .split("\n")
    .map((l) => l.split("|"));
  const values = p.workouts.map((w, i) => {
    const dayId = days.find((d) => Number(d[0]) === w.dayIndex)![1];
    const at = spAt(w.week, w.day);
    return `('e2e17-${enrollmentId}-${i}', '${userId}', '${enrollmentId}', '${programId}', '${dayId}',
      (SELECT name FROM "UserProgramDay" WHERE id = '${dayId}'), 'COMPLETED', ${at} - interval '1 hour', ${at}, 3600,
      ${w.programWeek}, ${w.dayIndex}, 15, 1500, 150, now(), now())`;
  });
  if (values.length > 0) {
    sql(`INSERT INTO "WorkoutSession" (id, "userId", "enrollmentId", "programId", "programDayId", name, status, "startedAt",
      "finishedAt", "durationSeconds", "programWeek", "programDayIndex", "totalWorkingSets", "totalVolumeKg", "totalReps",
      "createdAt", "updatedAt") VALUES ${values.join(",")};`);
  }
  sql(`UPDATE "ProgramEnrollment" SET "startedAt" = ${spAt(p.startWeek, p.startDay ?? 0, 9)}, "currentWeek" = ${p.currentWeek},
    "nextDayIndex" = ${p.nextDayIndex}, "completedSessions" = ${p.workouts.length} WHERE id = '${enrollmentId}'`);
  return { enrollmentId, programId };
}

/** GD 1's five days, Monday to Friday, in the week `week` weeks from this one. */
const fullWeek = (week: number, programWeek: number): Seeded[] =>
  [0, 1, 2, 3, 4].map((d) => ({ week, day: d, dayIndex: d, programWeek }));

/** Today (São Paulo) is Thursday–Sunday: an entry week can be running. */
const thursdayOrLater = () => {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(new Date());
  return ["Thu", "Fri", "Sat", "Sun"].includes(day);
};

const hero = (page: Page) => page.locator(".panel-raised").first();
const weekCard = (page: Page) => page.locator("[data-week-card]");
const programCard = (page: Page) => page.locator("[data-program-card]");

test("weekly streak, the last workout and the week strip: weeks on target in a row, never days", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const userId = await newUserOn(page, "habit-streak", "gd-1");
  seedProgram(userId, {
    startWeek: -3,
    currentWeek: 3,
    nextDayIndex: 0,
    workouts: [...fullWeek(-3, 1), ...fullWeek(-2, 2), ...fullWeek(-1, 3)],
  });
  await page.goto("/app/today");

  // "ÚLTIMO TREINO · SEXTA — PERNAS … · HÁ N DIAS" under the greeting.
  await expect(page.locator("[data-last-workout]")).toContainText(/Último treino · Sexta — Pernas .* · há \d+ dias/i);
  // Three weeks on target; this week, still open, doesn't break it.
  await expect(weekCard(page).locator("[data-streak]")).toHaveText(/^3 semanas seguidas$/i);
  // Seven days, Monday first; GD 1's days are Monday to Friday.
  const cells = weekCard(page).getByRole("list", { name: "Dias desta semana" }).getByRole("listitem");
  await expect(cells).toHaveCount(7);
  await expect(cells.first()).toHaveAttribute("aria-label", /^segunda/);
  await expect(weekCard(page).locator("[aria-current=date]")).toHaveCount(1);
  const states = await cells.evaluateAll((els) => els.map((e) => e.getAttribute("data-day-state")));
  const today = await cells.evaluateAll((els) => els.findIndex((e) => e.getAttribute("aria-current") === "date"));
  expect(states.slice(0, 5)).toEqual(Array(5).fill("planned"));
  // The hero's day is a training day on the strip too: on a weekend, catching up today.
  expect(states[today]).toBe("planned");
  expect(states.slice(5).filter((st) => st !== "rest")).toHaveLength(today >= 5 ? 1 : 0);
  // Never a guilt line: no "perder", no daily count.
  await expect(page.locator("main")).not.toContainText(/perder|dias seguidos/i);

  // The program week the next workout counts in (week 4 of GD 1: RIR 2), with its instructions folded.
  await expect(programCard(page).locator("[data-week-line]")).toHaveText(/Semana 4 de 13\s*·\s*RIR alvo 2/i);
  const details = programCard(page).locator("[data-week-guidance]");
  await expect(details.getByText(/Meio da onda/)).toBeHidden();
  await details.locator("summary").click();
  await expect(details.getByText(/Meio da onda/)).toBeVisible();
  await expect(details.getByRole("link", { name: /Entenda o RIR/ })).toHaveAttribute("href", "/app/science/rir");
  // W-125: workouts done of the block and adherence, and the way to the program.
  await expect(programCard(page)).toContainText("15 de 65 treinos");
  await expect(programCard(page)).not.toContainText("aderência");
  await expect(programCard(page).getByRole("link", { name: /GD 1/ })).toHaveAttribute("href", /^\/app\/programs\/[^/]+$/);
});

test("after a gap of 10+ days: a welcome back with the way back in, not a warning", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const userId = await newUserOn(page, "habit-welcome", "gd-1");
  seedProgram(userId, { startWeek: -3, currentWeek: 1, nextDayIndex: 1, workouts: [{ week: -3, day: 0, dayIndex: 0, programWeek: 1 }] });
  await page.goto("/app/today");
  const note = page.locator("[data-welcome-back]");
  await expect(note).toContainText("Bem-vindo de volta");
  await expect(note).toContainText("~90% das cargas");
  await expect(note).toContainText("RIR +1");
  await expect(note.getByRole("link", { name: "Por quê?" })).toHaveAttribute("href", "/app/science/deloads");
  // A streak that ended isn't mourned: nothing about it.
  await expect(weekCard(page).locator("[data-streak]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Iniciar treino" })).toBeVisible();
});

test("a workout done today makes today a rest day: what's next and when, and 'Treinar mesmo assim'", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const userId = await newUserOn(page, "habit-rest", "fgpower-adaptation");
  // Started two weeks ago: a full week (an entry week would already be done with one workout).
  sql(`UPDATE "ProgramEnrollment" SET "startedAt" = now() - interval '14 days' WHERE "userId" = '${userId}'`);
  await startDayFromToday(page, "Sessão A");
  await recordSet(page, 1, "40", "8");
  await finishAndSave(page);

  await page.goto("/app/today");
  const rest = page.locator('[data-hero="rest"]');
  await expect(rest).toContainText("Descanso hoje");
  await expect(rest).toContainText("Treino de hoje feito");
  // The rotation carries on: Sessão B next, dated on the user's week (never today).
  await expect(rest.getByRole("heading", { level: 2 })).toHaveText("Sessão B");
  await expect(rest).toContainText(/Sugerido para (amanhã · )?(SEG|TER|QUA|QUI|SEX|SÁB|DOM) · \d{2} [A-Z]{3}/i);
  await expect(rest.getByRole("link", { name: "Ver treino de hoje" })).toHaveAttribute("href", /\/summary$/);
  await expect(page.locator("[data-last-workout]")).toContainText(/Último treino · Sessão A · hoje/i);
  // Today's cell is done.
  await expect(weekCard(page).locator("[aria-current=date]")).toHaveAttribute("data-day-state", "done");

  // Training anyway opens the next day of the plan.
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    rest.getByRole("button", { name: "Treinar mesmo assim" }).click(),
  ]);
  expect(sql(`SELECT name FROM "WorkoutSession" WHERE "userId" = '${userId}' AND status = 'IN_PROGRESS'`)).toBe("Sessão B");
});

test("a new week after one that stopped mid-plan: the days left over, continue by default for a 3×/week user, or start over", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  const userId = await newUserOn(page, "habit-continue", "gd-1");
  // Segunda, Terça and Quarta every week: Quinta and Sexta never came.
  const workouts = [-3, -2, -1].flatMap((w, i) => [0, 1, 2].map((d) => ({ week: w, day: d, dayIndex: d, programWeek: i + 1 })));
  seedProgram(userId, { startWeek: -3, currentWeek: 3, nextDayIndex: 3, workouts });
  await page.goto("/app/today");

  const choice = page.locator("[data-week-start]");
  await expect(choice).toContainText("Da semana passada ficaram");
  await expect(choice.getByRole("listitem")).toHaveText(["Quinta — Puxar (moderado)", "Sexta — Pernas (posterior de coxa e glúteos)"]);
  // The user's real frequency (3) is below the plan's 5 days: the sequence goes on.
  await expect(hero(page).getByRole("heading", { level: 2 })).toHaveText("Quinta — Puxar (moderado)");
  await expect(hero(page)).toContainText(/Dia 4 de 5/i);
  await expect(choice.getByRole("button", { name: "Continuar a sequência" })).toHaveAttribute("aria-pressed", "true");

  await choice.getByRole("button", { name: /^Recomeçar/ }).click();
  await expect(hero(page).getByRole("heading", { level: 2 })).toHaveText("Segunda — Superior (pesado)", { timeout: 30_000 });
  await expect(page.locator("[data-week-start]").getByRole("button", { name: /^Recomeçar/ })).toHaveAttribute("aria-pressed", "true");
  // Kept for this week (a reload shows the same).
  await page.reload();
  await expect(hero(page).getByRole("heading", { level: 2 })).toHaveText("Segunda — Superior (pesado)");
});

test("after a workout the day before the new week, the week continues — never the same heavy day twice in a row", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  const userId = await newUserOn(page, "habit-sunday", "gd-1");
  // Full weeks, then last week stalled: only Segunda, caught up on Sunday.
  seedProgram(userId, {
    startWeek: -3,
    currentWeek: 3,
    nextDayIndex: 1,
    workouts: [...fullWeek(-3, 1), ...fullWeek(-2, 2), { week: -1, day: 6, dayIndex: 0, programWeek: 3 }],
  });
  await page.goto("/app/today");
  const choice = page.locator("[data-week-start]");
  await expect(choice.getByRole("listitem")).toHaveCount(4);
  // A user who usually does all five still goes on with Terça: Segunda was yesterday's (last) workout.
  await expect(choice.getByRole("button", { name: "Continuar a sequência" })).toHaveAttribute("aria-pressed", "true");
  await expect(hero(page).getByRole("heading", { level: 2 })).toHaveText("Terça — Inferior (quadríceps, pesado)");
});

test("a GD block's last week is its test week, and the finished block offers the next one or repeating it", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const userId = await newUserOn(page, "habit-block", "gd-1");
  seedProgram(userId, {
    startWeek: -12,
    currentWeek: 12,
    nextDayIndex: 0,
    workouts: Array.from({ length: 12 }, (_, i) => fullWeek(i - 12, i + 1)).flat(),
  });
  await page.goto("/app/today");
  await expect(programCard(page).locator("[data-week-line]")).toHaveText(/Semana 13 de 13\s*·\s*Semana de teste/i);
  // The week card says it the same way: the test week, not a deload (its nudge shows from Thursday).
  await expect(weekCard(page)).not.toContainText(/Semana de deload/i);
  if (thursdayOrLater()) await expect(weekCard(page)).toContainText("Semana de teste: 1 treino já conta.");
  // Progress and the program library read the week as Today does (nothing done yet this week: week 13).
  await page.goto("/app/programs");
  await expect(page.locator('a[href^="/app/programs/"]').filter({ hasText: "Ativo" }).first()).toContainText("Sem. 13/13");
  await page.goto("/app/progress");
  await expect(page.getByText("Sem. 13/13").first()).toBeVisible();
  await page.goto("/app/today");
  await programCard(page).locator("[data-week-guidance] summary").click();
  await expect(programCard(page).getByRole("link", { name: /Por que semanas leves/ })).toHaveAttribute("href", "/app/science/deloads");

  // Its 13th week done (last week): the Monday after, the block is over.
  sql(`INSERT INTO "WorkoutSession" (id, "userId", "enrollmentId", "programId", "programDayId", name, status, "startedAt",
      "finishedAt", "durationSeconds", "programWeek", "programDayIndex", "totalWorkingSets", "createdAt", "updatedAt")
    SELECT 'e2e17-last-' || e.id, e."userId", e.id, e."programId", d.id, d.name, 'COMPLETED', ${spAt(-1, 4)} - interval '1 hour',
      ${spAt(-1, 4)}, 3600, 13, d."dayIndex", 15, now(), now()
    FROM "ProgramEnrollment" e JOIN "UserProgramDay" d ON d."programId" = e."programId" AND d."dayIndex" = 4
    WHERE e."userId" = '${userId}' AND e.status = 'ACTIVE';
    UPDATE "ProgramEnrollment" SET "currentWeek" = 13 WHERE "userId" = '${userId}' AND status = 'ACTIVE';`);
  await page.goto("/app/today");
  const block = page.locator('[data-hero="block-complete"]');
  await expect(block).toContainText("Bloco concluído");
  await expect(block.getByRole("heading", { level: 2 })).toHaveText("GD 1");
  await expect(block).toContainText(/Bloco 2 de 9/i);
  await expect(block.getByRole("button", { name: "Repetir bloco" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    block.getByRole("button", { name: /^Começar GD 2/ }).click(),
  ]);
  await expect(programCard(page)).toContainText("GD 2");
  await expect(page.locator('[data-hero="block-complete"]')).toHaveCount(0);
});

test("an entry week short of its target is neutral: the streak from the program before it stands", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const userId = await newUserOn(page, "habit-entry-neutral", "gd-1");
  // Three full GD 1 weeks…
  const gd1 = seedProgram(userId, {
    startWeek: -4,
    currentWeek: 3,
    nextDayIndex: 0,
    workouts: [...fullWeek(-4, 1), ...fullWeek(-3, 2), ...fullWeek(-2, 3)],
  });
  // …then a switch to GD Adaptação on last week's Thursday, with one workout that day.
  await page.goto("/app/programs/templates/gd-adaptacao");
  await page.getByText("Trocar para este programa").first().click();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Trocar", exact: true }).filter({ visible: true }).first().click(),
  ]);
  sql(`UPDATE "ProgramEnrollment" SET "endedAt" = ${spAt(-1, 3, 8)} WHERE id = '${gd1.enrollmentId}'`);
  seedProgram(userId, { startWeek: -1, startDay: 3, currentWeek: 1, nextDayIndex: 1, workouts: [{ week: -1, day: 3, dayIndex: 0, programWeek: 1 }] });

  // The entry week asked for 4 (Thursday to Sunday) and got 1: never a miss — the three weeks stand.
  await page.goto("/app/today");
  await expect(weekCard(page).locator("[data-streak]")).toHaveText(/^3 semanas seguidas$/i);
  await page.goto("/app/history/all");
  await expect(page.getByText(/^Semana de entrada · GD Adaptação · 1\/4$/i)).toBeVisible();
});

test("a switch midweek: the week is the new program's entry week — the history's count is Today's, never the old program's", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  const userId = await newUserOn(page, "habit-entry-switch", "gd-1");
  // Three full GD 1 weeks, then GD 1 on Monday and Tuesday last week…
  const gd1 = seedProgram(userId, {
    startWeek: -4,
    currentWeek: 4,
    nextDayIndex: 2,
    workouts: [
      ...fullWeek(-4, 1),
      ...fullWeek(-3, 2),
      ...fullWeek(-2, 3),
      { week: -1, day: 0, dayIndex: 0, programWeek: 4 },
      { week: -1, day: 1, dayIndex: 1, programWeek: 4 },
    ],
  });
  // …a switch to GD Adaptação on Thursday, and one Adaptação workout on Saturday.
  await page.goto("/app/programs/templates/gd-adaptacao");
  await page.getByText("Trocar para este programa").first().click();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Trocar", exact: true }).filter({ visible: true }).first().click(),
  ]);
  sql(`UPDATE "ProgramEnrollment" SET "endedAt" = ${spAt(-1, 3, 8)} WHERE id = '${gd1.enrollmentId}'`);
  seedProgram(userId, { startWeek: -1, startDay: 3, currentWeek: 1, nextDayIndex: 1, workouts: [{ week: -1, day: 5, dayIndex: 0, programWeek: 1 }] });

  // The Adaptação's entry week (Thursday–Sunday: 4) at 1 — as Today showed it — and neutral: the run stands.
  await page.goto("/app/history/all");
  await expect(page.getByText(/^Semana de entrada · GD Adaptação · 1\/4$/i)).toBeVisible();
  await expect(page.locator("[data-week-mark]").filter({ hasText: "2/5" })).toHaveCount(0);
  await page.goto("/app/today");
  await expect(weekCard(page).locator("[data-streak]")).toHaveText(/^3 semanas seguidas$/i);
});

test("a Thursday–Sunday entry week aims at the days from the activation day, all week long", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  test.skip(!thursdayOrLater(), "an entry week runs Thursday–Sunday");
  const userId = await newUserOn(page, "habit-entry-target", "gd-1");
  const { enrollmentId, programId } = seedProgram(userId, { startWeek: 0, startDay: 3, currentWeek: 1, nextDayIndex: 2, workouts: [] });
  // Activated this Thursday; Segunda and Terça done since (never in the future).
  sql(`INSERT INTO "WorkoutSession" (id, "userId", "enrollmentId", "programId", "programDayId", name, status, "startedAt",
      "finishedAt", "durationSeconds", "programWeek", "programDayIndex", "totalWorkingSets", "createdAt", "updatedAt")
    SELECT 'e2e17-entry-' || d.id, '${userId}', '${enrollmentId}', '${programId}', d.id, d.name, 'COMPLETED',
      LEAST(${spAt(0, 3, 10)}, now() - interval '2 hours') + d."dayIndex" * interval '1 minute' - interval '1 hour',
      LEAST(${spAt(0, 3, 10)}, now() - interval '2 hours') + d."dayIndex" * interval '1 minute', 3600, 1, d."dayIndex", 15, now(), now()
    FROM "UserProgramDay" d WHERE d."programId" = '${programId}' AND d."dayIndex" < 2;`);

  await page.goto("/app/today");
  // 5 a week, activated Thursday: 4 — the same on Sunday as on Thursday, and never "1 / 1" with two done.
  await expect(weekCard(page)).toContainText("Semana de entrada");
  await expect(weekCard(page).locator("p.text-2xl")).toHaveText(/^2\s*\/\s*4\s*treinos$/i);
  await expect(page.locator('[data-hero="week-complete"]')).toHaveCount(0);
  await expect(page.getByText("Semana de entrada concluída")).toHaveCount(0);
  // The history judges the week the same.
  await page.goto("/app/history/all");
  await expect(page.getByText(/^Semana de entrada · GD 1 · 2\/4$/i)).toBeVisible();
});
