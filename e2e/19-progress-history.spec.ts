import { execSync } from "node:child_process";
import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";
import { newUserOnGd1, uniqueEmail } from "./workout-helpers";

/**
 * Batch 3 — the long game on Progress and in the history (W-051, W-055–W-058,
 * W-084, W-116–W-119, W-121, W-123–W-126): weeks on target measured like
 * Today's streak (never "4%" for a new user), a program card with its week
 * and workouts (no adherence: it would sit beside the weeks on target), an
 * "Evolução" that compares fairly (e1RM, reps at the same
 * load, bodyweight reps) with drops never shown as gains, exercise histories
 * drawn on the server as data-driven SVG with text alternatives, counting
 * only sessions where the exercise was done, a Monday-first calendar with
 * same-day workouts reachable, a full list grouped by week, and empty states
 * that say what to do next.
 */

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium", timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 120_000 });

/** Runs SQL on the local dev database (docker compose's fgpower-postgres) — test users only. */
function sql(query: string): string {
  return execSync(`docker exec -i fgpower-postgres sh -c 'psql -U "$POSTGRES_USER" -d fgpower -At -v ON_ERROR_STOP=1'`, {
    encoding: "utf8",
    input: query,
  }).trim();
}

const NBSP = " ";
/** A São Paulo wall-clock instant: `week` weeks from this Monday (0 = this week), `day` 0–6 from Monday, at `hour`. */
const spAt = (week: number, day: number, hour = 12) =>
  `((date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') + interval '${week * 7 + day} days' + interval '${hour} hours') AT TIME ZONE 'America/Sao_Paulo')`;

type SetRow = [kg: number | null, reps: number | null, done?: boolean];

interface Seeded {
  userId: string;
  enrollmentId: string;
  programId: string;
  days: string[];
}

let seq = 0;
/**
 * A finished workout with some exercises' sets, straight into the database
 * (what the UI would write when finishing). `at` is a SQL timestamptz.
 */
function insertSession(
  s: Seeded,
  opts: { at: string; dayIndex?: number; week?: number; name?: string; exercises: { slug: string; sets: SetRow[] }[] },
): string {
  const id = `b3c${Date.now().toString(36)}${(seq++).toString(36)}`;
  const program = opts.dayIndex != null;
  const dayId = program ? `'${s.days[opts.dayIndex!]}'` : "NULL";
  const name = opts.name ?? (program ? `(SELECT name FROM "UserProgramDay" WHERE id = ${dayId})` : "'Treino livre'");
  const working = opts.exercises.reduce((n, e) => n + e.sets.filter((x) => x[2] !== false).length, 0);
  const volume = opts.exercises.reduce(
    (v, e) => v + e.sets.filter((x) => x[2] !== false).reduce((t, [kg, reps]) => t + (kg ?? 0) * (reps ?? 0), 0),
    0,
  );
  let q = `INSERT INTO "WorkoutSession" (id, "userId", "enrollmentId", "programId", "programDayId", name, status, "startedAt", "finishedAt",
      "durationSeconds", "programWeek", "programDayIndex", "totalWorkingSets", "totalVolumeKg", "updatedAt")
    VALUES ('${id}', '${s.userId}', ${program ? `'${s.enrollmentId}'` : "NULL"}, ${program ? `'${s.programId}'` : "NULL"}, ${dayId},
      ${name}, 'COMPLETED', ${opts.at} - interval '50 minutes', ${opts.at}, 3000, ${program ? opts.week ?? "NULL" : "NULL"},
      ${program ? opts.dayIndex : "NULL"}, ${working}, ${volume}, now());`;
  opts.exercises.forEach((e, i) => {
    const log = `${id}l${i}`;
    q += `INSERT INTO "WorkoutExerciseLog" (id, "sessionId", "userId", "exerciseId", "sortOrder", "prescribedSets", "repMin", "repMax", "restSeconds")
      VALUES ('${log}', '${id}', '${s.userId}', (SELECT id FROM "Exercise" WHERE slug = '${e.slug}'), ${i}, 3, 8, 12, 90);`;
    e.sets.forEach(([kg, reps, done], n) => {
      q += `INSERT INTO "SetLog" (id, "userId", "sessionId", "exerciseLogId", "exerciseId", "setNumber", "weightKg", reps, "isCompleted", "completedAt", "updatedAt")
        VALUES ('${log}s${n}', '${s.userId}', '${id}', '${log}', (SELECT id FROM "Exercise" WHERE slug = '${e.slug}'), ${n + 1},
          ${kg ?? "NULL"}, ${reps ?? "NULL"}, ${done !== false}, ${done !== false ? opts.at : "NULL"}, now());`;
    });
  });
  sql(q);
  return id;
}

async function userIdOf(page: Page): Promise<string> {
  const res = await page.request.get("/api/auth/get-session");
  return (await res.json()).user.id as string;
}

test("a new user sees no false numbers, a preview and a way forward — and every empty state says what to do", async ({
  page,
}) => {
  await newUserOnGd1(page, "b3c-empty");

  await page.goto("/app/progress");
  const consistency = page.locator("[data-consistency]");
  await expect(consistency).toHaveAttribute("data-consistency", "not-started");
  await expect(consistency).toContainText("Semanas na meta");
  await expect(consistency).toContainText("Começa no seu primeiro treino.");
  await expect(consistency).not.toContainText("%");
  await expect(page.getByText("Sua evolução aparece aqui")).toBeVisible();
  await expect(page.getByText(/Depois de 2 treinos do mesmo exercício/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver próximo treino" })).toHaveAttribute("href", "/app/today");
  await expect(page.getByText(/primeira sessão de cada exercício vira a marca inicial/)).toBeVisible();
  // The program card: its week, and a link to the program.
  const program = page.locator("[data-program-progress]");
  await expect(program).toContainText("GD 1");
  await expect(page.getByRole("link", { name: /Programa atual: GD 1/ })).toHaveAttribute("href", /^\/app\/programs\/[^/]+$/);

  await page.goto("/app/progress/exercises");
  await expect(page.getByText("Nenhum exercício treinado ainda")).toBeVisible();

  await page.goto("/app/history");
  await expect(page.locator("main").getByText("SEG", { exact: true })).toBeVisible();
  await expect(page.locator("[data-today]")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Ir para Hoje" })).toHaveAttribute("href", "/app/today");
  await page.goto("/app/history/all");
  await expect(page.getByRole("link", { name: "Histórico", exact: true })).toHaveAttribute("href", "/app/history");
  await expect(page.getByRole("link", { name: "Ir para Hoje" })).toBeVisible();

  await page.goto("/app/notifications");
  await expect(page.getByText(/Aqui aparecem os FGs/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Encontrar pessoas" })).toHaveAttribute("href", "/app/discover");
  await page.goto("/app/discover");
  await expect(page.getByText("Encontre amigos pelo nome ou @usuário.")).toBeVisible();
  await page.goto("/app/profile");
  await expect(page.getByRole("link", { name: "Ver exercícios" })).toHaveAttribute("href", "/app/exercises");

  // Their own public profile explains why it is empty (workouts are private until shared).
  const username = sql(`SELECT username FROM "user" WHERE id = '${await userIdOf(page)}'`);
  if (username) {
    await page.goto(`/u/${username}`);
    await expect(page.getByText("Seus treinos são privados.")).toBeVisible();
  }

  // "Meu histórico" is a real button (≥ 44 px), not a tiny link.
  await page.goto("/app/exercises/pushups");
  const mine = page.getByRole("link", { name: "Meu histórico" });
  await expect(mine).toHaveAttribute("href", "/app/exercises/pushups/history");
  expect((await mine.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test.describe.serial("a lifter four weeks into GD 1", () => {
  let page: Page;
  let seeded: Seeded;
  let skippedBench: string;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    const context = await browser.newContext({ ...devices["iPhone 13"], timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
    page = await context.newPage();
    await loginAsTestUser(page, uniqueEmail("b3c-lifter"));
    await completeOnboarding(page);
    await page.goto("/app/programs/templates/gd-1");
    await Promise.all([
      page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
      page.getByRole("button", { name: "Ativar programa" }).first().click(),
    ]);
    const userId = await userIdOf(page);
    const [enrollmentId, programId] = sql(
      `SELECT id || '|' || "programId" FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`,
    ).split("|");
    const days = sql(`SELECT id FROM "UserProgramDay" WHERE "programId" = '${programId}' ORDER BY "dayIndex"`).split("\n");
    seeded = { userId, enrollmentId, programId, days };
    // Started on the Monday three weeks ago; this is its 4th week.
    sql(`UPDATE "ProgramEnrollment" SET "startedAt" = ${spAt(-3, 0, 8)}, "currentWeek" = 4 WHERE id = '${enrollmentId}'`);

    // Week 1 (5/5): the first bench, triceps and push-up sessions.
    insertSession(seeded, { at: spAt(-3, 0), dayIndex: 0, week: 1, exercises: [{ slug: "barbell-bench-press-medium-grip", sets: [[60, 12], [60, 12], [60, 11]] }] });
    insertSession(seeded, { at: spAt(-3, 1), dayIndex: 1, week: 1, exercises: [{ slug: "cable-rope-overhead-triceps-extension", sets: [[25, 8], [25, 8]] }] });
    insertSession(seeded, { at: spAt(-3, 2), dayIndex: 2, week: 1, exercises: [{ slug: "pushups", sets: [[0, 10], [0, 9]] }] });
    for (const d of [3, 4]) insertSession(seeded, { at: spAt(-3, d), dayIndex: d, week: 1, exercises: [{ slug: "barbell-squat", sets: [[80, 5]] }] });
    // Week 2 (5/5): bench left untouched in one workout (an empty log must not count as a session of it).
    skippedBench = insertSession(seeded, {
      at: spAt(-2, 0),
      dayIndex: 0,
      week: 2,
      exercises: [
        { slug: "barbell-squat", sets: [[80, 5]] },
        { slug: "barbell-bench-press-medium-grip", sets: [[null, null, false], [null, null, false]] },
      ],
    });
    for (const d of [1, 2, 3, 4]) insertSession(seeded, { at: spAt(-2, d), dayIndex: d, week: 2, exercises: [{ slug: "barbell-squat", sets: [[80, 5]] }] });
    // Week 3 (3/5): a rep more on the bench at 60 kg, a lighter triceps, more push-ups.
    const benchPr = insertSession(seeded, { at: spAt(-1, 0), dayIndex: 0, week: 3, exercises: [{ slug: "barbell-bench-press-medium-grip", sets: [[60, 13], [60, 12], [60, 12]] }] });
    insertSession(seeded, { at: spAt(-1, 1), dayIndex: 1, week: 3, exercises: [{ slug: "cable-rope-overhead-triceps-extension", sets: [[22.5, 8], [22.5, 8]] }] });
    insertSession(seeded, { at: spAt(-1, 2), dayIndex: 2, week: 3, exercises: [{ slug: "pushups", sets: [[0, 12], [0, 10]] }] });
    sql(`INSERT INTO "ExercisePersonalRecord" (id, "userId", "exerciseId", kind, value, "weightKg", reps, "sessionId", "achievedAt")
      VALUES ('${benchPr}pr', '${userId}', (SELECT id FROM "Exercise" WHERE slug = 'barbell-bench-press-medium-grip'),
        'MAX_REPS_AT_WEIGHT', 13, 60, 13, '${benchPr}', ${spAt(-1, 0)})`);
    // An old bench session, before the 8-week window.
    insertSession(seeded, { at: "now() - interval '70 days'", exercises: [{ slug: "barbell-bench-press-medium-grip", sets: [[57.5, 12]] }] });
    // This week: two workouts today.
    insertSession(seeded, { at: "now() - interval '3 minutes'", dayIndex: 0, week: 4, exercises: [{ slug: "barbell-squat", sets: [[82.5, 5]] }] });
    insertSession(seeded, { at: "now() - interval '2 minutes'", dayIndex: 1, week: 4, exercises: [{ slug: "barbell-squat", sets: [[82.5, 5]] }] });
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("Progress: weeks on target like Today's, the program's week and workouts, and a fair Evolução", async () => {
    await page.goto("/app/progress");
    // The last 8 full weeks, since the first workout 10 weeks ago: 5 empty weeks, then
    // week 1 (5/5), week 2 (5/5) and week 3 (3/5) — 2 of 8. This week (2/5) doesn't count yet.
    const consistency = page.locator("[data-consistency]");
    await expect(consistency).toHaveAttribute("data-consistency", "ratio");
    await expect(consistency).toContainText("2/8");
    await page.getByRole("link", { name: "4 semanas", exact: true }).click();
    await expect(consistency).toContainText("2/4");
    await page.goto("/app/progress");
    // The program lifecycle's own count (the programs page shows the same):
    // 5 + 5 + 3 + 2 of 65 — without the adherence, which counts only the weeks
    // trained and would read high beside "semanas na meta".
    const program = page.locator("[data-program-progress]");
    await expect(program).toContainText("Sem. 4/13");
    await expect(program).toContainText("15 de 65 treinos");
    await expect(program).not.toContainText("aderência");
    await expect(page.getByRole("link", { name: /Programa atual: GD 1/ })).toHaveAttribute(
      "href",
      `/app/programs/${seeded.programId}`,
    );

    const rows = page.locator('section[aria-labelledby="evolucao"] a[href*="/history"]').filter({ has: page.locator("[data-direction]") });
    await expect(rows).toHaveCount(4);
    // Biggest gain first: bodyweight reps count (+20%), then a rep more at the same load (+8%)…
    await expect(rows.nth(0)).toContainText("Flexão de Braço");
    await expect(rows.nth(0)).toContainText("10 → 12 reps");
    await expect(rows.nth(0).locator("[data-direction]")).toHaveText("+20%");
    await expect(rows.nth(1)).toContainText("Supino Reto com Barra");
    await expect(rows.nth(1)).toContainText(`+1 rep com 60${NBSP}kg`);
    await expect(rows.nth(1).locator("[data-direction]")).toHaveText("+8%");
    await expect(rows.nth(1).getByRole("img")).toHaveAttribute("aria-label", /^Últimas 2 sessões/);
    // …then the squat's e1RM (80 × 5 → 82,5 × 5: +3%)…
    await expect(rows.nth(2)).toContainText("Agachamento com Barra");
    await expect(rows.nth(2).locator("[data-direction]")).toHaveText("+3%");
    // …and a drop is muted with a true minus, never green.
    await expect(rows.nth(3)).toContainText(`25${NBSP}kg × 8 → 22,5${NBSP}kg × 8`);
    const drop = rows.nth(3).locator("[data-direction]");
    await expect(drop).toHaveAttribute("data-direction", "down");
    await expect(drop).toHaveText("−10%");
    await expect(drop).not.toHaveClass(/text-success/);
    await expect(rows.nth(1)).toHaveAttribute("href", /\/app\/exercises\/barbell-bench-press-medium-grip\/history\?period=8w$/);

    // Recent records: linked, dated, labelled.
    const pr = page.locator('section[aria-labelledby="recordes"] a').first();
    await expect(pr).toHaveAttribute("href", "/app/exercises/barbell-bench-press-medium-grip/history");
    await expect(pr).toContainText(`Repetições 13 reps com 60${NBSP}kg`);

    // No overflow at 320 px.
    await page.setViewportSize({ width: 320, height: 700 });
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await page.setViewportSize({ width: 390, height: 664 });
  });

  test("an exercise's history: server-drawn charts that follow the data, only sessions where it was done", async () => {
    await page.goto("/app/exercises/barbell-bench-press-medium-grip/history");
    // The untouched bench in week 2 is not a session of it: 3 = week 1, week 3 and the old one.
    await expect(page.getByText(/^3 sessões · última em/)).toBeVisible();
    await expect(page.locator(".recharts-wrapper")).toHaveCount(0);
    const load = page.locator('[data-chart="Melhor carga por sessão"]');
    await expect(load.getByRole("img")).toHaveAttribute("aria-label", new RegExp(`^Melhor carga por sessão: de 57,5${NBSP}kg para 60${NBSP}kg entre`));
    await expect(load).toContainText(`57,5 → 60${NBSP}kg · +2,5${NBSP}kg (+4%)`);
    // The scale follows the data instead of starting at 0.
    const ticks = (await load.locator("[data-tick]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-tick")))));
    expect(Math.min(...ticks)).toBeGreaterThan(40);
    // Sets of 11–13 reps give no reliable e1RM: said so instead of a blank chart.
    await expect(page.getByText("1RM estimado: só de séries com até 10 reps — nenhuma neste período.")).toBeVisible();
    // Best marks carry the day they were set; the ledger is folded away below the charts.
    const heaviest = page.locator(".reg-frame").filter({ hasText: "Maior carga" });
    await expect(heaviest).toContainText(`60${NBSP}kg × 13`);
    await expect(heaviest).toContainText(/em \d{2} [A-Z]{3}/);
    await expect(page.getByText(`13 reps com 60${NBSP}kg`)).toBeHidden();
    await page.getByText("Linha do tempo de recordes").click();
    await expect(page.getByText(`13 reps com 60${NBSP}kg`)).toBeVisible();
    // Each session opens its workout; the one that set a record is marked.
    const sessions = page.locator('a[href$="/summary"]');
    await expect(sessions).toHaveCount(3);
    await expect(sessions.first()).toContainText("recorde");
    await expect(page.locator(`a[href="/app/workout/${skippedBench}/summary"]`)).toHaveCount(0);
    // The period chips narrow charts and list (the old session is 70 days back).
    await page.getByRole("link", { name: "4 semanas", exact: true }).click();
    await expect(page).toHaveURL(/period=4w/);
    await expect(sessions).toHaveCount(2);
    await expect(load).toContainText(`60 → 60${NBSP}kg · mesma marca`);

    // A loaded exercise with 8-rep sets gets its e1RM chart.
    await page.goto("/app/exercises/cable-rope-overhead-triceps-extension/history");
    await expect(page.locator('[data-chart="1RM estimado"]').getByRole("img")).toHaveAttribute("aria-label", /^1RM estimado: de /);

    // Bodyweight: reps, never a flat 0 kg; its sets read "PC × 12" (peso corporal).
    await page.goto("/app/exercises/pushups/history");
    await expect(page.locator('[data-chart="Mais reps por sessão"]')).toContainText("10 → 12 reps · +2 reps (+20%)");
    await expect(page.locator('[data-chart="Reps totais por sessão"]')).toBeVisible();
    await expect(page.getByText("Mais repetições", { exact: true })).toBeVisible();
    await expect(page.locator('a[href$="/summary"]').first()).toContainText(`PC${NBSP}×${NBSP}12`);
    await expect(page.getByText("PC = peso corporal")).toBeVisible();
    await expect(page.locator("main")).not.toContainText("kg");
  });

  test("the chart readout stays inside the plot at 320 px, never over its point, and clears after a tap", async () => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/app/exercises/barbell-bench-press-medium-grip/history");
    const chart = page.locator('[data-chart="Melhor carga por sessão"]');
    const plot = chart.locator("[data-chart-scrubber]");
    // Mid-screen: at the bottom edge the tab bar would take the tap.
    await plot.evaluate((el) => el.scrollIntoView({ block: "center" }));
    for (const f of [0.02, 0.35, 0.5, 0.65, 0.98]) {
      const readout = chart.locator("[data-chart-readout]");
      // Tapped again until the page is hydrated (the scrubber is its one client
      // piece) — centred and measured on every try: hydration can swap the
      // element or move the page.
      await expect(async () => {
        await plot.evaluate((el) => el.scrollIntoView({ block: "center" }));
        const b = await plot.boundingBox();
        expect(b).not.toBeNull();
        await page.touchscreen.tap(b!.x + b!.width * f, b!.y + b!.height / 2);
        await expect(readout).toBeVisible({ timeout: 500 });
      }).toPass({ timeout: 15_000 });
      const box = (await plot.boundingBox())!;
      const r = (await readout.boundingBox())!;
      // The plot reaches 6 px past the scrubber on each side.
      expect(r.x).toBeGreaterThanOrEqual(box.x - 6.5);
      expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width + 6.5);
      const dot = (await chart.locator("[data-chart-cursor]").boundingBox())!;
      const [cx, cy] = [dot.x + dot.width / 2, dot.y + dot.height / 2];
      expect(cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    }
    await expect(chart.locator("[data-chart-readout]")).toHaveCount(0, { timeout: 5_000 });
    await page.setViewportSize({ width: 390, height: 664 });
  });

  test("Meus exercícios lists every trained exercise, most recent first, each with its trend", async () => {
    await page.goto("/app/progress");
    await page.getByRole("link", { name: "Meus exercícios" }).click();
    await expect(page).toHaveURL(/\/app\/progress\/exercises$/);
    const rows = page.locator('main a[href^="/app/exercises/"]');
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText("Agachamento com Barra");
    await expect(page.locator('main a[href="/app/exercises/pushups/history"]').getByRole("img")).toHaveAttribute(
      "aria-label",
      /^Mais reps nas últimas 2 sessões: de 10 reps para 12 reps$/,
    );
  });

  test("the calendar starts on Monday, marks today and opens a day with two workouts; the full list goes week by week", async () => {
    await page.goto("/app/history");
    await expect(page.locator("[data-month-summary]")).toContainText("treinos");
    const today = page.locator("a[data-today]");
    // The day says what opening it shows: "Ver 2 treinos de 28 de setembro, segunda (hoje)".
    await expect(today).toHaveAttribute("aria-label", /^Ver 2 treinos de \d+ de .+ \(hoje\)(, com recorde)?$/);
    await today.click();
    await expect(page).toHaveURL(/day=\d+/);
    await expect(page.getByRole("heading", { name: /^Treinos de \d+ de / })).toBeVisible();
    await expect(page.locator("[data-session-row]")).toHaveCount(2);

    await page.goto("/app/history/all");
    const week = (n: number) => page.locator("section").filter({ hasText: new RegExp(`^Semana ${n} · GD 1`) });
    await expect(week(4)).toContainText("2/5");
    await expect(week(3)).toContainText("3/5");
    await expect(week(2)).toContainText("5/5");
    await expect(week(2)).toContainText("semana na meta");
    await expect(week(2).locator("[data-session-row]")).toHaveCount(5);
    await expect(page.locator("section").filter({ hasText: /^Sem programa/ })).toHaveCount(1);
  });
});

/**
 * Weeks as Today counts them: a program activated on a Thursday whose entry
 * week had no workout starts at week 1 on the Monday after (history and the
 * program card agree with Today), "semanas na meta" shows its ratio from the
 * third week, a planned deload week reads "descarga", and a met week that
 * spills into the next month keeps its ✓ in both months of the calendar.
 */
test.describe("weeks as Today counts them", () => {
  async function seed(page: Page, label: string): Promise<Seeded> {
    await newUserOnGd1(page, label);
    const userId = await userIdOf(page);
    const [enrollmentId, programId] = sql(
      `SELECT id || '|' || "programId" FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`,
    ).split("|");
    const days = sql(`SELECT id FROM "UserProgramDay" WHERE "programId" = '${programId}' ORDER BY "dayIndex"`).split("\n");
    return { userId, enrollmentId, programId, days };
  }
  const squat = [{ slug: "barbell-squat", sets: [[80, 5]] as SetRow[] }];

  test("activated on a Thursday, first trained on the Monday after: week 1 there, and the ratio from week 3", async ({ page }) => {
    const s = await seed(page, "b3c-thu");
    // Activated on the Thursday three weeks back; nothing that week.
    sql(`UPDATE "ProgramEnrollment" SET "startedAt" = ${spAt(-3, 3, 9)}, "currentWeek" = 2 WHERE id = '${s.enrollmentId}'`);
    // Its first full week so far: 5/5 last week (the counter's week 2 is it only once week 1 exists — see below).
    for (const d of [0, 1, 2, 3, 4]) insertSession(s, { at: spAt(-1, d), dayIndex: d, week: 2, exercises: squat });

    // One week behind the user: too early for a ratio.
    await page.goto("/app/progress");
    const consistency = page.locator("[data-consistency]");
    await expect(consistency).toHaveAttribute("data-consistency", "early");
    await expect(consistency).toContainText("Segunda semana");

    // Two weeks behind: 5/5 and 5/5 → 2/2 (not "Segunda semana" any more).
    for (const d of [0, 1, 2, 3, 4]) insertSession(s, { at: spAt(-2, d), dayIndex: d, week: 1, exercises: squat });
    insertSession(s, { at: "now() - interval '2 minutes'", dayIndex: 0, week: 3, exercises: squat });
    sql(`UPDATE "ProgramEnrollment" SET "currentWeek" = 3, "completedSessions" = 11 WHERE id = '${s.enrollmentId}'`);
    await page.reload();
    await expect(consistency).toHaveAttribute("data-consistency", "ratio");
    await expect(consistency).toContainText("2/2");
    // The program card counts the same weeks as Today: week 3, 11 workouts.
    const program = page.locator("[data-program-progress]");
    await expect(program).toContainText("Sem. 3/13");
    await expect(program).toContainText("11 de 65 treinos");

    // The full list numbers the weeks like Today — no "Semana de entrada" for an untrained entry week.
    await page.goto("/app/history/all");
    const heads = page.locator("main section[aria-label]");
    await expect(heads).toHaveCount(3);
    await expect(heads.nth(0)).toHaveAttribute("aria-label", /^Semana 3 · GD 1,/);
    await expect(heads.nth(1)).toHaveAttribute("aria-label", /^Semana 2 · GD 1,/);
    await expect(heads.nth(1)).toContainText("5/5");
    await expect(heads.nth(2)).toHaveAttribute("aria-label", /^Semana 1 · GD 1,/);
    await expect(page.getByText("Semana de entrada")).toHaveCount(0);
  });

  test("a planned deload week reads 'descarga', not '1/5 ✓'", async ({ page }) => {
    const s = await seed(page, "b3c-deload");
    // GD 1's week 13 is its planned deload; one workout in it last week.
    sql(`UPDATE "ProgramEnrollment" SET "startedAt" = ${spAt(-13, 0, 8)}, "currentWeek" = 13 WHERE id = '${s.enrollmentId}'`);
    insertSession(s, { at: spAt(-1, 1), dayIndex: 0, week: 13, exercises: squat });
    await page.goto("/app/history/all");
    const week = page.locator("main section[aria-label]").first();
    await expect(week).toHaveAttribute("aria-label", /^Semana 13 · GD 1,/);
    const mark = week.locator("[data-week-mark]");
    await expect(mark).toContainText("descarga");
    await expect(mark).toContainText("semana de descarga, na meta");
    await expect(mark).not.toContainText("1/5");
  });

  test("a met week across two months keeps its ✓ in both months", async ({ page }) => {
    const s = await seed(page, "b3c-cal");
    // The latest past week that starts in one month and ends in the next.
    const [monday, prevYear, prevMonth, nextYear, nextMonth] = sql(`
      SELECT to_char(date_trunc('week', m), 'YYYY-MM-DD') || '|' || extract(year from date_trunc('week', m)) || '|' ||
        (extract(month from date_trunc('week', m)) - 1) || '|' || extract(year from m) || '|' || (extract(month from m) - 1)
      FROM generate_series(date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - interval '4 months',
        date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo'), interval '1 month') m
      WHERE extract(isodow from m) <> 1
        AND date_trunc('week', m) + interval '7 days' <= date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')
      ORDER BY m DESC LIMIT 1`).split("|");
    const at = (d: number) => `(('${monday}'::timestamp + interval '${d} days 12 hours') AT TIME ZONE 'America/Sao_Paulo')`;
    sql(`UPDATE "ProgramEnrollment" SET "startedAt" = (('${monday}'::timestamp + interval '8 hours') AT TIME ZONE 'America/Sao_Paulo') WHERE id = '${s.enrollmentId}'`);
    // Wednesday to Sunday: the Sunday is always in the later month (its 1st isn't a Monday).
    [2, 3, 4, 5, 6].forEach((d, i) => insertSession(s, { at: at(d), dayIndex: i, week: 1, exercises: squat }));

    // The earlier month: the week is its grid's last row.
    await page.goto(`/app/history?year=${prevYear}&month=${prevMonth}`);
    const prevRows = page.locator("main .grid.items-center");
    await expect(prevRows.last()).toHaveAttribute("data-week-met", "true");
    await expect(prevRows.last()).toContainText("Semana na meta");
    // The later month: its first row.
    await page.goto(`/app/history?year=${nextYear}&month=${nextMonth}`);
    await expect(page.locator("main .grid.items-center").first()).toHaveAttribute("data-week-met", "true");
  });
});

/**
 * Batch 3 pre-deploy fixes: every Progress number covers the same weeks
 * ("desde" under both tiles), a bodyweight record reads once and never runs
 * over its label, private milestones read as stamps (no FG), the GD dossier's
 * block links never split a name, and resuming a stopped program says so.
 */
test.describe("one span, stamps and record rows", () => {
  async function seedGd1(page: Page, label: string): Promise<Seeded> {
    await newUserOnGd1(page, label);
    const userId = await userIdOf(page);
    const [enrollmentId, programId] = sql(
      `SELECT id || '|' || "programId" FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`,
    ).split("|");
    const days = sql(`SELECT id FROM "UserProgramDay" WHERE "programId" = '${programId}' ORDER BY "dayIndex"`).split("\n");
    return { userId, enrollmentId, programId, days };
  }
  const squat = [{ slug: "barbell-squat", sets: [[80, 5]] as SetRow[] }];

  test("the workouts tile and 'semanas na meta' count the same weeks, and no '100%' sits beside a skipped week", async ({ page }) => {
    const s = await seedGd1(page, "x2-span");
    sql(`UPDATE "ProgramEnrollment" SET "startedAt" = ${spAt(-9, 6, 8)}, "currentWeek" = 8 WHERE id = '${s.enrollmentId}'`);
    // The Sunday before the 8-week window: outside it.
    insertSession(s, { at: spAt(-9, 6, 20), dayIndex: 0, week: 1, exercises: squat });
    // A workout from last year, before the 400 days the weeks on target read: only "Tudo" counts it.
    insertSession(s, { at: "now() - interval '430 days'", exercises: squat });
    // Weeks −8…−1 at 5/5, except week −4 (skipped). The window's very first
    // workout is on its first Monday at 07:00 — "now − 56 days" used to miss it.
    let week = 1;
    for (const w of [-8, -7, -6, -5, -3, -2, -1]) {
      week += 1;
      for (const d of [0, 1, 2, 3, 4]) insertSession(s, { at: spAt(w, d, d === 0 ? 7 : 12), dayIndex: d, week, exercises: squat });
    }

    await page.goto("/app/progress");
    const workouts = page.getByRole("link", { name: /^Treinos concluídos: / });
    const consistency = page.locator("[data-consistency]");
    await expect(consistency).toContainText("7/8");
    await expect(workouts).toContainText("35");
    const since = async (loc: typeof workouts) => (await loc.getByText(/^desde /i).innerText()).toLowerCase();
    expect(await since(workouts)).toBe(await since(consistency));
    await expect(workouts).toHaveAttribute("aria-label", new RegExp(`^Treinos concluídos: 35 ${await since(consistency)} — ver histórico$`));
    // The block's card: its week and workouts, never "100% aderência" beside 7/8.
    const program = page.locator("[data-program-progress]");
    await expect(program).toContainText(/\d+ de 65 treinos/);
    await expect(program).not.toContainText("aderência");

    // 4 weeks: weeks −4…−1 → 15 workouts, 3 of 4 weeks — the same Monday under both.
    await page.getByRole("link", { name: "4 semanas", exact: true }).click();
    await expect(consistency).toContainText("3/4");
    await expect(workouts).toContainText("15");
    expect(await since(workouts)).toBe(await since(consistency));

    // "Tudo": every workout (37), dated from last year's week — the weeks on
    // target (400 days back at most) say where they start on their own.
    await page.getByRole("link", { name: "Tudo", exact: true }).click();
    await expect(page).toHaveURL(/period=all/);
    await expect(workouts).toContainText("37");
    expect(await since(workouts)).toMatch(/^desde \d{2} [a-zç]{3} \d{4}$/);
    expect(await since(consistency)).toMatch(/^desde \d{2} [a-zç]{3}$/);
    await expect(workouts).toHaveAttribute("aria-label", new RegExp(`^Treinos concluídos: 37 ${await since(workouts)} — ver histórico$`));

    // Side by side at 390 px, the two "desde" lines sit level (only one title wraps).
    await page.getByRole("link", { name: "8 semanas", exact: true }).click();
    await expect(consistency).toContainText("7/8");
    const tops = await Promise.all([workouts, consistency].map(async (l) => (await l.getByText(/^desde /i).boundingBox())!.y));
    expect(Math.abs(tops[0] - tops[1])).toBeLessThan(1);
  });

  test("a bodyweight record shows once in 'Melhores marcas', and no record row runs its value over its label at 320 px", async ({ page }) => {
    const s = await seedGd1(page, "x2-bw");
    [10, 12, 14].forEach((reps, i) => {
      const at = spAt(i - 3, 1);
      const id = insertSession(s, {
        at,
        exercises: [
          { slug: "pushups", sets: [[0, reps], [0, reps - 2]] },
          { slug: "barbell-bench-press-medium-grip", sets: [[100 + i * 1.25, 10 + i]] },
        ],
      });
      sql(`INSERT INTO "ExercisePersonalRecord" (id, "userId", "exerciseId", kind, value, "weightKg", reps, "sessionId", "achievedAt")
        VALUES ('${id}pu', '${s.userId}', (SELECT id FROM "Exercise" WHERE slug = 'pushups'), 'MAX_REPS_AT_WEIGHT', ${reps}, 0, ${reps}, '${id}', ${at})
        ${i === 2 ? `, ('${id}be', '${s.userId}', (SELECT id FROM "Exercise" WHERE slug = 'barbell-bench-press-medium-grip'), 'MAX_REPS_AT_WEIGHT', 12, 102.5, 12, '${id}', ${at})` : ""}`);
    });
    await page.setViewportSize({ width: 320, height: 700 });

    /** The label and value of every ledger row: side by side without touching, or the value on the next line. */
    const rowsClear = () =>
      page.locator("[data-record-row]").evaluateAll((rows) =>
        rows.map((row) => {
          const [label, value] = [...row.querySelectorAll(":scope > span:last-child > span")].map((e) => e.getBoundingClientRect());
          return value.left >= label.right || value.top >= label.bottom - 1;
        }),
      );

    await page.goto("/app/exercises/pushups/history");
    // "Mais repetições 14 reps" — not again as "Último recorde de reps 14 reps".
    await expect(page.locator(".reg-frame").filter({ hasText: "Mais repetições" })).toContainText("14 reps");
    await expect(page.getByText("Último recorde de reps")).toHaveCount(0);
    await page.getByText("Linha do tempo de recordes").click();
    const first = page.locator("[data-record-row]").first();
    await expect(first).toContainText("Repetições · peso corporal");
    await expect(first).toContainText("14 reps");
    await expect(first).not.toContainText("(peso corporal)");
    expect(await rowsClear()).toEqual([true, true, true]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

    // A loaded rep record set with the heaviest load ("102,5 kg × 12") is
    // noted on that tile, not repeated in a tile of its own; its long value
    // wraps under its label in the ledger.
    await page.goto("/app/exercises/barbell-bench-press-medium-grip/history");
    const heaviest = page.locator(".reg-frame").filter({ hasText: "Maior carga" });
    await expect(heaviest).toContainText(`102,5${NBSP}kg × 12`);
    await expect(heaviest).toContainText("Também seu último recorde de reps");
    await expect(page.getByText("Último recorde de reps", { exact: true })).toHaveCount(0);
    const marks = page.locator("section").filter({ hasText: "Melhores marcas" }).locator(".reg-frame");
    await expect(marks.filter({ hasText: "102,5" })).toHaveCount(1);
    await page.getByText("Linha do tempo de recordes").click();
    await expect(page.locator("[data-record-row]").filter({ hasText: `12 reps com 102,5${NBSP}kg` })).toHaveCount(1);
    expect((await rowsClear()).every(Boolean)).toBe(true);

    // Progress's recent records read the same way.
    await page.goto("/app/progress");
    await expect(page.locator('section[aria-labelledby="recordes"] a[href="/app/exercises/pushups/history"]')).toContainText(
      "Repetições · peso corporal 14 reps",
    );
  });

  test("private milestones read as stamps in the owner's feed — no FG — and open to the workout or the block", async ({ page, browser }) => {
    const s = await seedGd1(page, "x2-stamp");
    const tenth = insertSession(s, { at: "now() - interval '3 days'", name: "'Sexta — Inferior B'", exercises: squat });
    // The block's last workout: last Thursday (the stamp was written later, when the block was closed).
    insertSession(s, { at: spAt(-1, 3), dayIndex: 0, week: 1, exercises: squat });
    const lastDay = sql(`SELECT to_char((${spAt(-1, 3)}) AT TIME ZONE 'America/Sao_Paulo', 'DD')`);
    const summary = (o: object) => `'${JSON.stringify(o)}'::jsonb`;
    sql(`INSERT INTO "Activity" (id, "userId", type, visibility, summary, "createdAt", "updatedAt") VALUES
      ('${s.userId}m', '${s.userId}', 'MILESTONE', 'PRIVATE', ${summary({
        kind: "WORKOUT_COUNT", workoutName: "Dossiê nº 10 · Sexta — Inferior B", durationSeconds: null, totalWorkingSets: 1,
        totalVolumeKg: null, exercises: [], prs: [], count: 10, sessionId: tenth,
      })}, now() - interval '3 days', now()),
      ('${s.userId}b', '${s.userId}', 'PROGRAM_COMPLETED', 'PRIVATE', ${summary({
        kind: "BLOCK_COMPLETED", workoutName: "Bloco concluído · GD 1", durationSeconds: null, totalWorkingSets: 60,
        totalVolumeKg: null, exercises: [], prs: [], enrollmentId: s.enrollmentId, programName: "GD 1", templateSlug: "gd-1",
        weeks: 4, sessionsDone: 18, plannedSessions: 20,
      })}, now() - interval '1 day', now())`);

    await page.goto("/app/feed");
    const count = page.locator('[data-stamp="WORKOUT_COUNT"]');
    await expect(count).toContainText("Dossiê nº 10");
    await expect(count).toContainText("10 treinos registrados até aqui.");
    await expect(count).toContainText("10º treino: Sexta — Inferior B");
    await expect(count).toContainText("Só você vê");
    await expect(count.getByRole("link", { name: "Ver o treino" })).toHaveAttribute("href", `/app/workout/${tenth}/summary`);
    const block = page.locator('[data-stamp="BLOCK_COMPLETED"]');
    await expect(block).toContainText("GD 1 concluído");
    await expect(block).toContainText("4 semanas · 18 de 20 treinos");
    // Stamps, not workout cards: nothing to give an FG to.
    await expect(page.getByRole("button", { name: /FG/ })).toHaveCount(0);
    await expect(page.getByText("séries de trabalho")).toHaveCount(0);

    await block.getByRole("link", { name: "Ver o bloco" }).click();
    await expect(page).toHaveURL(`/app/activity/${s.userId}b`);
    const stamp = page.locator('[data-stamp="BLOCK_COMPLETED"]');
    await expect(stamp.getByRole("heading", { level: 1, name: "GD 1" })).toBeVisible();
    await expect(stamp).toContainText("18/20");
    await expect(stamp).toContainText(new RegExp(`Último treino do bloco em ${lastDay} de \\p{L}+\\.`, "u"));
    await expect(stamp.getByRole("link", { name: "Ver o programa" })).toHaveAttribute("href", `/app/programs/${s.programId}`);
    await expect(page.getByRole("button", { name: /FG/ })).toHaveCount(0);
    await expect(page.getByText(/^\d+ FGs?$/)).toHaveCount(0);

    await page.goto(`/app/activity/${s.userId}m`);
    await expect(page.locator('[data-stamp="WORKOUT_COUNT"]').getByRole("link", { name: "Ver o treino" })).toHaveAttribute(
      "href",
      `/app/workout/${tenth}/summary`,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

    // Still private: anyone else gets "not found".
    const other = await browser.newContext({ ...devices["iPhone 13"], timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
    const stranger = await other.newPage();
    await loginAsTestUser(stranger, uniqueEmail("x2-stranger"));
    await completeOnboarding(stranger);
    await stranger.goto(`/app/activity/${s.userId}b`);
    await expect(stranger.getByText("GD 1 concluído")).toHaveCount(0);
    await expect(stranger).toHaveTitle(/Página não encontrada/);
    await other.close();
  });

  test("the GD dossier's block links keep each name on one line at 320 px", async ({ page }) => {
    await loginAsTestUser(page, uniqueEmail("x2-dossier"));
    await completeOnboarding(page);
    await page.setViewportSize({ width: 320, height: 700 });
    for (const slug of ["gd-1", "gd-4", "gd-adaptacao", "gd-8"]) {
      await page.goto(`/app/programs/templates/${slug}`);
      const nav = page.getByRole("navigation", { name: "Blocos do Plano GD" });
      await expect(nav).toBeVisible();
      const lines = await nav.locator("a").evaluateAll((links) =>
        links.map((a) => {
          const range = document.createRange();
          range.selectNodeContents(a);
          // Text rects only (the arrow icon is 14 px wide).
          return new Set([...range.getClientRects()].filter((r) => r.width > 16).map((r) => Math.round(r.top))).size;
        }),
      );
      expect(lines.every((n) => n === 1), `${slug}: ${lines.join(",")}`).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    }
    // GD 8 (the last block): back to GD 7, and "Último bloco".
    const nav = page.getByRole("navigation", { name: "Blocos do Plano GD" });
    await expect(nav.getByRole("link", { name: "GD 7" })).toBeVisible();
    await expect(nav).toContainText("Último bloco");
  });

  test("'Retomar da semana N' lands on Today with '<programa> retomado · semana N', and the switch's undo", async ({ page }) => {
    const s = await seedGd1(page, "x2-resume");
    // GD 1: one workout in each of the last three weeks, then stopped last Thursday.
    sql(`UPDATE "ProgramEnrollment" SET "startedAt" = ${spAt(-3, 0, 8)}, "currentWeek" = 3, "completedSessions" = 3,
      status = 'ABANDONED', "endedAt" = ${spAt(-1, 3)} WHERE id = '${s.enrollmentId}';
      UPDATE "UserProgram" SET status = 'ARCHIVED', "archivedAt" = ${spAt(-1, 3)} WHERE id = '${s.programId}';`);
    for (const w of [-3, -2, -1]) insertSession(s, { at: spAt(w, 0), dayIndex: 0, week: w + 4, exercises: squat });
    // Another program runs meanwhile.
    await page.goto("/app/programs/templates/fgpower-adaptation");
    await Promise.all([
      page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
      page.getByRole("button", { name: "Ativar programa" }).first().click(),
    ]);

    await page.goto(`/app/programs/${s.programId}`);
    await page.getByText("Retomar da semana 4").first().click();
    await Promise.all([
      page.waitForURL(/\/app\/today\?retomado=1&anterior=/, { timeout: 30_000 }),
      page.getByRole("button", { name: "Trocar", exact: true }).filter({ visible: true }).first().click(),
    ]);
    await expect(page.getByText(/^GD 1 retomado · semana 4$/)).toBeVisible();
    await expect(page.getByText("Programa ativado")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Voltar para Adaptação FGPOWER/ })).toBeVisible();
  });
});
