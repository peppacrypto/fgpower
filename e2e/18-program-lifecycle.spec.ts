import { execSync } from "node:child_process";
import { devices, expect, test, type Page } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";
import { finishAndSave, programDayCard, recordSet, uniqueEmail, waitForWorkoutScreen } from "./workout-helpers";

/**
 * Batch 3 — a program's life after "Ativar" (W-004, W-015, W-039, W-040,
 * W-090, W-125, W-130): its days go onto the user's week, a block ends and
 * hands over to the next GD block, the 10th workout gets its stamp, an
 * archived program comes back where it stopped, a never-trained one can be
 * deleted, and the builder sets how often and for how long.
 */

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium", timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 120_000 });

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

async function newUser(page: Page, label: string) {
  const email = uniqueEmail(label);
  await loginAsTestUser(page, email);
  await completeOnboarding(page);
  return { email, userId: sql(`SELECT id FROM "user" WHERE email = '${email}'`) };
}

async function activate(page: Page, slug: string) {
  await page.goto(`/app/programs/templates/${slug}`);
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Ativar programa" }).first().click(),
  ]);
}

/** The user's program page, by the program's id. */
async function openProgram(page: Page, programId: string) {
  await page.goto(`/app/programs/${programId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
}

/** Starts a day from the program page, logs one set and saves: returns the summary URL. */
async function trainDay(page: Page, programId: string, dayName: string) {
  await openProgram(page, programId);
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    programDayCard(page, dayName).getByRole("button", { name: "Iniciar" }).click(),
  ]);
  await waitForWorkoutScreen(page);
  await recordSet(page, 1, "40", "8");
  return finishAndSave(page);
}

/** The program page's "⋯" menu. */
function menu(page: Page) {
  return page.getByTestId("program-menu");
}

test("activation lays the days onto the user's week and makes the program's frequency the profile's", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b3-layout");
  await activate(page, "fgpower-adaptation");
  const weekdays = () =>
    sql(`SELECT string_agg(coalesce(d.weekday::text, '-'), ',' ORDER BY d."dayIndex") FROM "UserProgramDay" d
      JOIN "UserProgram" p ON p.id = d."programId" WHERE p."userId" = '${userId}' AND p.status = 'ACTIVE'`);
  // No days picked in onboarding: 3 days at 3× go on seg · qua · sex.
  expect(weekdays()).toBe("1,3,5");
  expect(sql(`SELECT "daysPerWeek" FROM "Profile" WHERE "userId" = '${userId}'`)).toBe("3");

  // A plan named by weekday keeps its own weekdays; the profile follows its 5×.
  await page.goto("/app/programs/templates/gd-1");
  await page.getByText("Trocar para este programa").first().click();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Trocar", exact: true }).filter({ visible: true }).first().click(),
  ]);
  expect(weekdays()).toBe("1,2,3,4,5");
  expect(sql(`SELECT "daysPerWeek" FROM "Profile" WHERE "userId" = '${userId}'`)).toBe("5");
});

test("finishing a block's last week completes it once and hands over to the next GD block", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b3-block");
  await activate(page, "gd-adaptacao");
  const [enrollmentId, programId] = sql(
    `SELECT id || '|' || "programId" FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`,
  ).split("|");
  // The block's last week (4 of 4, started on a Monday), Monday–Thursday already done.
  sql(`
    UPDATE "ProgramEnrollment" SET "currentWeek" = 4,
      "startedAt" = (date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') - interval '21 days' + interval '12 hours') AT TIME ZONE 'America/Sao_Paulo'
    WHERE id = '${enrollmentId}';
    INSERT INTO "WorkoutSession" (id, "userId", "enrollmentId", "programId", "programDayId", name, status, "startedAt", "finishedAt", "totalWorkingSets", "programWeek", "updatedAt")
    SELECT 'b3e2e-' || d.id, '${userId}', '${enrollmentId}', '${programId}', d.id, d.name, 'COMPLETED',
      now() - (5 - d."dayIndex") * interval '20 seconds' - interval '1 hour', now() - (5 - d."dayIndex") * interval '20 seconds', 3, 4, now()
    FROM "UserProgramDay" d WHERE d."programId" = '${programId}' AND d."dayIndex" < 4;
  `);

  const summaryUrl = await trainDay(page, programId, "Sexta — Inferior B (hack e glúteos)");
  const done = page.getByTestId("block-done");
  await expect(done).toBeVisible();
  await expect(done).toContainText("Bloco concluído");
  await expect(done).toContainText("Bloco 1 de 9");
  await expect(done.getByRole("heading", { name: "GD Adaptação" })).toBeVisible();
  await expect(done).toContainText("5/20");
  await expect(done.getByRole("button", { name: "Repetir bloco" })).toBeVisible();
  // "Próximo treino" of a block that no longer runs is gone.
  await expect(page.getByText(/^Próximo treino/)).toHaveCount(0);

  expect(sql(`SELECT status || '|' || ("endedAt" IS NOT NULL) FROM "ProgramEnrollment" WHERE id = '${enrollmentId}'`)).toBe(
    "COMPLETED|true",
  );
  expect(sql(`SELECT status FROM "UserProgram" WHERE id = '${programId}'`)).toBe("ARCHIVED");
  expect(sql(`SELECT count(*) || '|' || min(visibility::text) FROM "Activity" WHERE "userId" = '${userId}' AND type = 'PROGRAM_COMPLETED'`)).toBe(
    "1|PRIVATE",
  );
  expect(sql(`SELECT count(*) FROM "Notification" WHERE "recipientId" = '${userId}' AND type = 'PROGRAM_COMPLETED'`)).toBe("1");

  await Promise.all([
    page.waitForURL(/\/app\/today\?ativado=1/, { timeout: 30_000 }),
    done.getByRole("button", { name: /Começar GD 1/ }).click(),
  ]);
  expect(
    sql(`SELECT p.name FROM "ProgramEnrollment" e JOIN "UserProgram" p ON p.id = e."programId"
      WHERE e."userId" = '${userId}' AND e.status = 'ACTIVE'`),
  ).toBe("GD 1");

  // Back on the old summary: the next block is running, so no second hand-over (and no second completion).
  await page.goto(summaryUrl);
  await expect(page.getByText("Treino concluído")).toBeVisible();
  await expect(page.getByTestId("block-done")).toHaveCount(0);
  expect(sql(`SELECT count(*) FROM "Activity" WHERE "userId" = '${userId}' AND type = 'PROGRAM_COMPLETED'`)).toBe("1");

  // The finished block waits in "Arquivados" as "Concluído".
  await page.goto("/app/programs");
  const archived = page.getByTestId("archived-programs");
  await archived.locator("summary").click();
  await expect(archived.getByRole("listitem").filter({ hasText: "GD Adaptação" })).toContainText("Concluído");
});

/** Noon (São Paulo) `days` after this week's Monday, as SQL. */
const spNoon = (days: number) =>
  `(date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') + interval '${days} days' + interval '12 hours') AT TIME ZONE 'America/Sao_Paulo'`;

test("activated on a Friday with no workout that week, the first full week is week 1", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b3-entry");
  await activate(page, "fgpower-adaptation");
  const [enrollmentId, programId] = sql(
    `SELECT id || '|' || "programId" FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`,
  ).split("|");
  // Activated last Friday; nothing done in that entry week.
  sql(`UPDATE "ProgramEnrollment" SET "startedAt" = ${spNoon(-3)} WHERE id = '${enrollmentId}'`);

  await trainDay(page, programId, "Sessão A");
  // This week is the block's week 1 — as Today says — not the entry week.
  await expect(page.getByText("Treino concluído")).toBeVisible();
  await expect(page.getByText(/Semana 1\/4/).first()).toBeVisible();
  await expect(page.getByText(/Semana de entrada/i)).toHaveCount(0);
  expect(sql(`SELECT "programWeek" FROM "WorkoutSession" WHERE "enrollmentId" = '${enrollmentId}'`)).toBe("1");

  await page.goto("/app/programs");
  const card = page.locator(`a[href="/app/programs/${programId}"]`).first();
  await expect(card).toContainText("Sem. 1/4");
  await expect(card).not.toContainText(/Semana de entrada/i);
  // Its workout counts toward the plan.
  await expect(card).toContainText("1 de 12 treinos");
});

test("'Começar GD 1' on a finished block's page switches from the running program, with the undo", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b3-next");
  await activate(page, "gd-adaptacao");
  const [enrollmentId, gdProgramId] = sql(
    `SELECT id || '|' || "programId" FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`,
  ).split("|");
  // GD Adaptação finished yesterday; another program started since.
  sql(`
    UPDATE "ProgramEnrollment" SET status = 'COMPLETED', "currentWeek" = 4, "endedAt" = now() - interval '1 day' WHERE id = '${enrollmentId}';
    UPDATE "UserProgram" SET status = 'ARCHIVED', "archivedAt" = now() - interval '1 day' WHERE id = '${gdProgramId}';
  `);
  await activate(page, "fgpower-adaptation");

  await openProgram(page, gdProgramId);
  await page.getByText("Começar GD 1").first().click();
  await expect(page.getByText(/Isso encerra/).filter({ visible: true })).toContainText("Adaptação FGPOWER");
  await Promise.all([
    page.waitForURL(/\/app\/today\?ativado=1&anterior=/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Trocar", exact: true }).filter({ visible: true }).first().click(),
  ]);
  expect(
    sql(`SELECT p.name FROM "ProgramEnrollment" e JOIN "UserProgram" p ON p.id = e."programId"
      WHERE e."userId" = '${userId}' AND e.status = 'ACTIVE'`),
  ).toBe("GD 1");
  await expect(page.getByRole("button", { name: /Voltar para Adaptação FGPOWER/ })).toBeVisible();
});

test("a block stopped in its last week resumes at that week — it isn't closed on the spot", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b3-resume-last");
  await activate(page, "fgpower-adaptation");
  const [enrollmentId, programId] = sql(
    `SELECT id || '|' || "programId" FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`,
  ).split("|");
  // Weeks 1–4 of 4 trained (one workout each, the last one last week), then stopped.
  sql(`
    UPDATE "ProgramEnrollment" SET "startedAt" = ${spNoon(-28)}, "currentWeek" = 4, "completedSessions" = 4,
      status = 'ABANDONED', "endedAt" = ${spNoon(-5)} WHERE id = '${enrollmentId}';
    UPDATE "UserProgram" SET status = 'DRAFT' WHERE id = '${programId}';
    INSERT INTO "WorkoutSession" (id, "userId", "enrollmentId", "programId", "programDayId", name, status, "startedAt", "finishedAt", "totalWorkingSets", "programWeek", "updatedAt")
    SELECT 'b3e2e-r' || w || '-${enrollmentId}', '${userId}', '${enrollmentId}', '${programId}', d.id, d.name, 'COMPLETED',
      (date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') - (5 - w) * interval '7 days' + interval '11 hours') AT TIME ZONE 'America/Sao_Paulo',
      (date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo') - (5 - w) * interval '7 days' + interval '12 hours') AT TIME ZONE 'America/Sao_Paulo',
      3, w, now()
    FROM generate_series(1, 4) w JOIN "UserProgramDay" d ON d."programId" = '${programId}' AND d."dayIndex" = 0;
  `);

  await openProgram(page, programId);
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Retomar da semana 4" }).click(),
  ]);
  // Running again, in its last week — not "Bloco concluído".
  await expect(page.getByText(/Semana 4 de 4/i).first()).toBeVisible();
  await expect(page.getByText(/Bloco concluído/i)).toHaveCount(0);
  expect(sql(`SELECT status || '|' || "currentWeek" FROM "ProgramEnrollment" WHERE id = '${enrollmentId}'`)).toBe("ACTIVE|3");

  // Its next workout counts in week 4, and one workout doesn't finish the week.
  await trainDay(page, programId, "Sessão B");
  expect(
    sql(`SELECT e.status || '|' || e."currentWeek" || '|' || s."programWeek" FROM "ProgramEnrollment" e
      JOIN "WorkoutSession" s ON s."enrollmentId" = e.id AND s.id NOT LIKE 'b3e2e-r%' WHERE e.id = '${enrollmentId}'`),
  ).toBe("ACTIVE|4|4");
});

test("the 10th workout is stamped 'Dossiê nº 10', privately", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b3-stamp");
  await activate(page, "fgpower-adaptation");
  const programId = sql(`SELECT id FROM "UserProgram" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`);
  sql(`
    INSERT INTO "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "totalWorkingSets", "updatedAt")
    SELECT 'b3e2e-m' || g || '-${userId}', '${userId}', 'Treino livre', 'COMPLETED',
      now() - (20 - g) * interval '1 day' - interval '1 hour', now() - (20 - g) * interval '1 day', 3, now()
    FROM generate_series(1, 9) g;
  `);
  await trainDay(page, programId, "Sessão A");
  const stamp = page.getByTestId("dossier-stamp");
  await expect(stamp).toContainText("Dossiê nº 10");
  await expect(stamp).toContainText("10 treinos registrados");
  expect(
    sql(`SELECT count(*) || '|' || min(visibility::text) FROM "Activity" WHERE "userId" = '${userId}' AND type = 'MILESTONE'`),
  ).toBe("1|PRIVATE");
  // The stamp is never published; the workout goes to followers like every new account's (decision 10).
  expect(sql(`SELECT count(*) FROM "Activity" WHERE "userId" = '${userId}' AND type <> 'WORKOUT' AND visibility <> 'PRIVATE'`)).toBe("0");
  expect(sql(`SELECT visibility FROM "Activity" WHERE "userId" = '${userId}' AND type = 'WORKOUT'`)).toBe("FOLLOWERS");
});

test("archiving the active program asks first; it restores from 'Arquivados' and picks up where it stopped", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b3-archive");
  await activate(page, "fgpower-adaptation");
  const programId = sql(`SELECT id FROM "UserProgram" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`);
  const enrollmentId = sql(`SELECT id FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`);
  await trainDay(page, programId, "Sessão A");

  // The running program's card says where the block stands.
  await page.goto("/app/programs");
  const card = page.locator(`a[href="/app/programs/${programId}"]`).first();
  await expect(card).toContainText(/Semana de entrada|Sem\. 1\/4/);

  await openProgram(page, programId);
  await menu(page).locator("summary").first().click();
  await menu(page).getByText("Arquivar…").click();
  await expect(menu(page).getByRole("alert")).toContainText("Isto encerra o programa ativo e sua semana atual");
  await menu(page).getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(page.getByText("Arquivado", { exact: true })).toBeVisible({ timeout: 30_000 });
  expect(sql(`SELECT status FROM "ProgramEnrollment" WHERE id = '${enrollmentId}'`)).toBe("ABANDONED");

  await page.goto("/app/programs");
  const archived = page.getByTestId("archived-programs");
  await expect(archived).toContainText("Arquivados (1)");
  await archived.locator("summary").click();
  await Promise.all([
    page.waitForURL(new RegExp(`/app/programs/${programId}$`), { timeout: 30_000 }),
    archived.getByRole("button", { name: "Restaurar" }).click(),
  ]);
  // Trained this week: it goes on in the same week — or starts over.
  await expect(page.getByRole("button", { name: "Recomeçar" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Retomar da semana 1" }).click(),
  ]);
  expect(sql(`SELECT status || '|' || "completedSessions" FROM "ProgramEnrollment" WHERE id = '${enrollmentId}'`)).toBe(
    "ACTIVE|1",
  );
  expect(sql(`SELECT count(*) FROM "ProgramEnrollment" WHERE "userId" = '${userId}'`)).toBe("1");
});

test("a program never trained can be deleted from its menu", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b3-delete");
  await page.goto("/app/programs/new");
  await page.getByLabel("Nome do programa").fill("Rascunho para excluir");
  await Promise.all([
    page.waitForURL(/\/app\/programs\/[^/]+\/edit$/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Continuar" }).click(),
  ]);
  const programId = page.url().match(/\/app\/programs\/([^/]+)\/edit$/)![1];
  await openProgram(page, programId);
  await menu(page).locator("summary").first().click();
  await menu(page).getByText("Excluir…").click();
  await Promise.all([
    page.waitForURL(/\/app\/programs\?excluido=1/, { timeout: 30_000 }),
    menu(page).getByRole("button", { name: "Excluir", exact: true }).click(),
  ]);
  await expect(page.getByRole("status").filter({ hasText: "Programa excluído" })).toBeVisible();
  expect(sql(`SELECT count(*) FROM "UserProgram" WHERE "userId" = '${userId}'`)).toBe("0");
});

test("the builder sets workouts per week (at least one per day) and an optional duration", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  await newUser(page, "b3-cadence");
  await page.goto("/app/programs/new");
  await page.getByLabel("Nome do programa").fill("Full body 3x");
  await Promise.all([
    page.waitForURL(/\/app\/programs\/[^/]+\/edit$/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Continuar" }).click(),
  ]);
  const programId = page.url().match(/\/app\/programs\/([^/]+)\/edit$/)![1];

  // One day, trained as often as the profile says (3×), not once a week.
  const perWeek = page.getByLabel("Treinos por semana");
  const duration = page.getByLabel(/^Duração/);
  await expect(perWeek).toHaveValue("3");
  await expect(page.getByText("O mesmo treino, 3× por semana.")).toBeVisible();
  await duration.fill("8");
  await duration.blur();
  await page.getByRole("button", { name: "Salvar programa" }).click();
  await expect(page.getByRole("button", { name: "Salvo" })).toBeVisible({ timeout: 15_000 });
  expect(sql(`SELECT "daysPerWeek" || '|' || "durationWeeks" FROM "UserProgram" WHERE id = '${programId}'`)).toBe("3|8");

  // Four days: at least four a week; fewer can't be picked.
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Adicionar dia", exact: true }).click();
  await expect(perWeek).toHaveValue("4");
  await expect(page.getByRole("button", { name: "Menos um treino por semana" })).toBeDisabled();
  await page.getByRole("button", { name: "Mais um treino por semana" }).click();
  await expect(page.getByText(/4 dias em 5 treinos: os dias se alternam/)).toBeVisible();
  await duration.fill("");
  await duration.blur();
  await page.getByRole("button", { name: "Salvar programa" }).click();
  await expect(page.getByRole("button", { name: "Salvo" })).toBeVisible({ timeout: 15_000 });
  expect(
    sql(`SELECT "daysPerWeek" || '|' || coalesce("durationWeeks"::text, 'null') FROM "UserProgram" WHERE id = '${programId}'`),
  ).toBe("5|null");
});

/** Today (São Paulo) is Thursday–Sunday: an entry week can be running. */
const thursdayOrLater = () => {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(new Date());
  return ["Thu", "Fri", "Sat", "Sun"].includes(day);
};

/** A block that ran `weeks` full weeks (5 workouts each, the last one last week), as SQL. */
function seedFullWeeks(userId: string, enrollmentId: string, programId: string, weeks: number, perWeek = 5) {
  sql(`
    UPDATE "ProgramEnrollment" SET "startedAt" = ${spNoon(-7 * weeks)}, "currentWeek" = ${weeks}, "nextDayIndex" = 0,
      "completedSessions" = ${weeks * perWeek} WHERE id = '${enrollmentId}';
    INSERT INTO "WorkoutSession" (id, "userId", "enrollmentId", "programId", "programDayId", name, status, "startedAt", "finishedAt", "totalWorkingSets", "programWeek", "updatedAt")
    SELECT 'b3e2e-w' || w || '-' || d.id, '${userId}', '${enrollmentId}', '${programId}', d.id, d.name, 'COMPLETED',
      ${spNoon(0)} - (${weeks} + 1 - w) * interval '7 days' + d."dayIndex" * interval '1 day' - interval '1 hour',
      ${spNoon(0)} - (${weeks} + 1 - w) * interval '7 days' + d."dayIndex" * interval '1 day', 3, w, now()
    FROM generate_series(1, ${weeks}) w JOIN "UserProgramDay" d ON d."programId" = '${programId}' AND d."dayIndex" < ${perWeek};
  `);
}

test("a workout after a block's last week closes the block first: it counts in that week, never a week past the block", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b3-late");
  await activate(page, "gd-adaptacao");
  const [enrollmentId, programId] = sql(
    `SELECT id || '|' || "programId" FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`,
  ).split("|");
  // Weeks 1–4 of 4; the last one ended at 4 of 5 (no Sexta).
  seedFullWeeks(userId, enrollmentId, programId, 4);
  sql(`DELETE FROM "WorkoutSession" WHERE "enrollmentId" = '${enrollmentId}' AND "programWeek" = 4 AND "programDayId" =
    (SELECT id FROM "UserProgramDay" WHERE "programId" = '${programId}' AND "dayIndex" = 4);
    UPDATE "ProgramEnrollment" SET "completedSessions" = 19, "nextDayIndex" = 4 WHERE id = '${enrollmentId}';`);

  // This week, from the program page (Today would have closed the block on the calendar first).
  await trainDay(page, programId, "Sexta — Inferior B (hack e glúteos)");
  await expect(page.getByText(/· Semana 4\/4$/).first()).toBeVisible();
  const done = page.getByTestId("block-done");
  await expect(done).toContainText("Bloco concluído");
  await expect(done).toContainText("20/20");
  // What stays in the history is every workout saved — 20, as the history holds them.
  await expect(done).toContainText("20 treinos ficam no histórico");
  expect(
    sql(`SELECT e.status || '|' || e."currentWeek" || '|' || s."programWeek" FROM "ProgramEnrollment" e
      JOIN "WorkoutSession" s ON s."enrollmentId" = e.id AND s.id NOT LIKE 'b3e2e-%' WHERE e.id = '${enrollmentId}'`),
  ).toBe("COMPLETED|4|4");
  await page.goto("/app/history/all");
  await expect(page.getByText(/Semana 5 ·/i)).toHaveCount(0);
});

test("after a finished GD block, Today and the library go on with the next block — never back to the Adaptação", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b3-series");
  await activate(page, "gd-1");
  const [enrollmentId, programId] = sql(
    `SELECT id || '|' || "programId" FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`,
  ).split("|");
  // GD 1 finished 15 days ago: past Today's "Bloco concluído" window, nothing started since.
  sql(`
    UPDATE "ProgramEnrollment" SET status = 'COMPLETED', "currentWeek" = 13, "endedAt" = now() - interval '15 days' WHERE id = '${enrollmentId}';
    UPDATE "UserProgram" SET status = 'ARCHIVED', "archivedAt" = now() - interval '15 days' WHERE id = '${programId}';
  `);

  await page.goto("/app/today");
  const panel = page.getByTestId("recommended-panel");
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("GD 2");
  await expect(panel).not.toContainText("GD Adaptação");
  await expect(panel).not.toContainText(/\bGD 1\b/);

  await page.goto("/app/programs");
  await expect(page.getByTestId("recommended-panel").getByRole("heading", { level: 2 })).toHaveText("GD 2");
  const gd = page.locator('[data-series="gd"]');
  await expect(gd.getByRole("link", { name: "Continuar: GD 2" })).toHaveAttribute("href", "/app/programs/templates/gd-2");
  await expect(gd.getByRole("link", { name: /Começar pela Adaptação/ })).toHaveCount(0);
  // GD 1 carries a ✓ on the rail and "Concluído" in the list; GD 2 is the next block.
  await expect(gd.getByRole("img")).toHaveAttribute("aria-label", /GD 1 \(concluído\)/);
  // The list opens on its own when the library starts filtered by the profile.
  const toggle = gd.getByRole("button", { name: /^Ver os/ });
  if (await toggle.isVisible()) await toggle.click();
  await expect(gd.getByRole("listitem").filter({ hasText: /^1GD 1/ })).toContainText("Concluído");
  await expect(gd.getByRole("listitem").filter({ hasText: /^2GD 2/ })).toContainText("Próximo bloco");
});

test("after GD 8 — the whole plan — the GD card offers GD 8 again, never the start over at the Adaptação", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b3-plan-done");
  await activate(page, "gd-8");
  const [enrollmentId, programId] = sql(
    `SELECT id || '|' || "programId" FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`,
  ).split("|");
  // GD 8 finished 15 days ago: past Today's "Plano GD concluído" window, nothing started since.
  sql(`
    UPDATE "ProgramEnrollment" SET status = 'COMPLETED', "currentWeek" = 9, "endedAt" = now() - interval '15 days' WHERE id = '${enrollmentId}';
    UPDATE "UserProgram" SET status = 'ARCHIVED', "archivedAt" = now() - interval '15 days' WHERE id = '${programId}';
  `);

  await page.goto("/app/programs");
  const gd = page.locator('[data-series="gd"]');
  await expect(gd).toContainText("Plano concluído");
  await expect(gd.getByRole("link", { name: "Repetir GD 8" })).toHaveAttribute("href", `/app/programs/${programId}`);
  await expect(gd.getByRole("link", { name: /Começar pela Adaptação/ })).toHaveCount(0);
  const toggle = gd.getByRole("button", { name: /^Ver os/ });
  if (await toggle.isVisible()) await toggle.click();
  await expect(gd.getByText("Comece aqui")).toHaveCount(0);
  await expect(gd.getByRole("listitem").filter({ hasText: /^8GD 8/ })).toContainText("Concluído");
  // Its page repeats it.
  await gd.getByRole("link", { name: "Repetir GD 8" }).click();
  await expect(page.getByRole("button", { name: /Repetir bloco/ }).first()).toBeVisible({ timeout: 30_000 });
});

test("a GD block archived mid-way: Today leads with 'Retomar da semana N', the week Today, Progress and the archive ask all read", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b3-resume-series");
  await activate(page, "gd-1");
  const [enrollmentId, programId] = sql(
    `SELECT id || '|' || "programId" FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`,
  ).split("|");
  // Six full weeks, nothing yet this week: the next workout counts in week 7 — on every screen.
  seedFullWeeks(userId, enrollmentId, programId, 6);
  await page.goto("/app/today");
  await expect(page.locator("[data-program-card] [data-week-line]")).toHaveText(/^Semana 7 de 13/i);
  await page.goto("/app/progress");
  await expect(page.getByText("Sem. 7/13").first()).toBeVisible();
  await page.goto("/app/programs");
  await expect(page.locator(`a[href="/app/programs/${programId}"]`).first()).toContainText("Sem. 7/13");

  await openProgram(page, programId);
  await menu(page).locator("summary").first().click();
  await menu(page).getByText("Arquivar…").click();
  await expect(menu(page).getByRole("alert")).toContainText("(semana 7 de 13)");
  await menu(page).getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(page.getByText("Arquivado", { exact: true })).toBeVisible({ timeout: 30_000 });

  // Nothing running: Today offers GD 1 back where it stopped — not a fresh start at the Adaptação.
  await page.goto("/app/today");
  const resume = page.getByTestId("resume-program");
  await expect(resume.getByRole("heading", { level: 2 })).toHaveText("GD 1");
  await expect(page.getByTestId("recommended-panel")).toHaveCount(0);
  await page.goto("/app/programs");
  await expect(page.locator('[data-series="gd"]').getByRole("link", { name: "Retomar GD 1 · semana 7" })).toHaveAttribute(
    "href",
    `/app/programs/${programId}`,
  );
  // Under "Retomar", GD 1 isn't offered fresh; a 5×/week beginner who skipped the Adaptação may step back to it.
  const pick = page.getByTestId("recommended-panel");
  await expect(pick.getByRole("heading", { level: 2 })).toHaveText("GD Adaptação");
  await expect(pick.locator('a[href="/app/programs/templates/gd-1"]')).toHaveCount(0);
  await page.goto("/app/today");
  await Promise.all([
    page.waitForURL(/\/app\/today\?/, { timeout: 30_000 }),
    page.getByTestId("resume-program").getByRole("button", { name: "Retomar da semana 7" }).click(),
  ]);
  await expect(page.locator("[data-program-card] [data-week-line]")).toHaveText(/^Semana 7 de 13/i);
  expect(sql(`SELECT status || '|' || "completedSessions" FROM "ProgramEnrollment" WHERE id = '${enrollmentId}'`)).toBe("ACTIVE|30");
});

test("a new block started Thursday–Sunday in a week the finished one already met: that week is done, the block starts next week", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  test.skip(!thursdayOrLater(), "an entry week runs Thursday–Sunday");
  const { userId } = await newUser(page, "b3-counted");
  await activate(page, "gd-adaptacao");
  const [enrollmentId, programId] = sql(
    `SELECT id || '|' || "programId" FROM "ProgramEnrollment" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`,
  ).split("|");
  // Week 4 of 4 done this week (5 of 5), the block finished; GD 1 started now.
  sql(`
    UPDATE "ProgramEnrollment" SET status = 'COMPLETED', "currentWeek" = 4, "startedAt" = ${spNoon(-21)},
      "endedAt" = now() - interval '1 minute' WHERE id = '${enrollmentId}';
    UPDATE "UserProgram" SET status = 'ARCHIVED', "archivedAt" = now() - interval '1 minute' WHERE id = '${programId}';
    INSERT INTO "WorkoutSession" (id, "userId", "enrollmentId", "programId", "programDayId", name, status, "startedAt", "finishedAt", "totalWorkingSets", "programWeek", "updatedAt")
    SELECT 'b3e2e-c' || d.id, '${userId}', '${enrollmentId}', '${programId}', d.id, d.name, 'COMPLETED',
      now() - (6 - d."dayIndex") * interval '2 minutes' - interval '1 hour', now() - (6 - d."dayIndex") * interval '2 minutes', 3, 4, now()
    FROM "UserProgramDay" d WHERE d."programId" = '${programId}';
  `);
  await activate(page, "gd-1");

  // Nothing asked of GD 1 this week: no "0 / 1", no workout for today — next week's first day.
  const hero = page.locator('[data-hero="week-complete"]');
  await expect(hero).toContainText("Semana já na meta");
  await expect(hero).toContainText(/Próximo · Segunda — Superior \(pesado\)/);
  const week = page.locator("[data-week-card]");
  await expect(week.locator("p.text-2xl")).toHaveText(/^5\s*\/\s*5\s*treinos$/i);
  await expect(week).not.toContainText("Semana de entrada");
  await expect(week.locator("[data-week-counted]")).toHaveText("GD 1 começa na semana que vem.");
  await expect(page.getByRole("button", { name: "Iniciar treino" })).toHaveCount(0);
});

