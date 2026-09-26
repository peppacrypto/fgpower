import { execSync } from "node:child_process";
import { test, expect, devices, type Locator, type Page } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";
import {
  QUINTA,
  SEGUNDA,
  gotoMyProgram,
  newUserOnGd1,
  startDayFromToday,
  todayDayRow,
  uniqueEmail,
} from "./workout-helpers";

// Phone-first: the daily loop happens on a phone (Chromium with iPhone 13 metrics).
test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium" });

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

const bottomNav = (page: Page) => page.getByRole("navigation", { name: "Navegação principal" });
const activeTab = (page: Page) => bottomNav(page).locator('a[aria-current="page"]');
/** The first step of a program switch: a native <summary> (works before hydration). */
const switchToggles = (page: Page): Locator => page.locator("summary", { hasText: "Trocar para este programa" });
const sessionStatus = (id: string) => sql(`SELECT status FROM "WorkoutSession" WHERE id = '${id}'`);

/** Switches to a template from its page (two steps) and returns the Today URL it lands on. */
async function switchToTemplate(page: Page, slug: string) {
  await page.goto(`/app/programs/templates/${slug}`);
  await switchToggles(page).first().click();
  await Promise.all([
    page.waitForURL(/\/app\/today\?.*anterior=/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Trocar", exact: true }).first().click(),
  ]);
  return page.url();
}

test("Today puts 'Iniciar treino' above the fold, and preview rows open the exercise pages", async ({ page }) => {
  await newUserOnGd1(page, "today-fold");
  await page.goto("/app/today");

  const start = page.getByRole("button", { name: "Iniciar treino" });
  await expect(start).toBeVisible();
  const cta = await start.boundingBox();
  const nav = await bottomNav(page).boundingBox();
  expect(cta && nav && cta.y + cta.height <= nav.y).toBeTruthy();

  // Three rows on a phone, the rest summarized.
  const preview = page.locator("ol").first();
  await expect(preview.getByRole("link").filter({ visible: true })).toHaveCount(3);
  await expect(preview.locator("li").last()).toHaveText("+3 exercícios", { useInnerText: true });
  const first = preview.getByRole("link").first();
  await expect(first).toHaveAttribute("href", /^\/app\/exercises\/[^/]+$/);
  await Promise.all([page.waitForURL(/\/app\/exercises\/[^/]+$/), first.click()]);
});

test("'Treino descartado.' shows once after a discard from Today", async ({ page }) => {
  await newUserOnGd1(page, "today-discard");
  await startDayFromToday(page, QUINTA);
  await page.goto("/app/today");
  await expect(page.getByText("Treino em andamento", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Descartar", exact: true }).click();
  await page.getByRole("button", { name: "Sim, descartar" }).click();

  await expect(page.getByText("Treino descartado.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Treino em andamento", { exact: true })).toHaveCount(0);
  // One-time: the param is dropped from the URL, so a reload doesn't repeat it.
  await expect(page).toHaveURL(/\/app\/today$/);
  await page.reload();
  await expect(page.getByText("Treino descartado.")).toHaveCount(0);
});

test("a workout left open on an earlier day doesn't lock Today and saves on its own day", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  await newUserOnGd1(page, "today-stale");
  const sessionId = await startDayFromToday(page, QUINTA);
  // Two sets ✓'d two days ago, 20 minutes apart; the workout was never finished.
  sql(`UPDATE "WorkoutSession" SET "startedAt" = now() - interval '2 days 1 hour' WHERE id = '${sessionId}';
    WITH s AS (
      SELECT id, row_number() OVER (ORDER BY "setNumber", id) AS rn FROM "SetLog"
      WHERE "sessionId" = '${sessionId}' AND "setType" = 'WORKING' ORDER BY "setNumber" LIMIT 2
    )
    UPDATE "SetLog" l SET "weightKg" = 50, reps = 8, "isCompleted" = true,
      "completedAt" = now() - interval '2 days' + s.rn * interval '20 minutes',
      "updatedAt" = now() - interval '2 days' + s.rn * interval '20 minutes'
    FROM s WHERE l.id = s.id;`);
  const day = sql(
    `SELECT to_char(("completedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') FROM "SetLog"
     WHERE "sessionId" = '${sessionId}' AND "isCompleted" ORDER BY "completedAt" DESC LIMIT 1`,
  );

  await page.goto("/app/today");
  const stale = page.getByTestId("stale-session");
  await expect(stale).toContainText(`Treino de ${day} não finalizado · 2 séries`);
  // It no longer takes over Today: the hero and every day stay usable.
  await expect(page.getByText("Treino em andamento", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Iniciar treino" })).toBeVisible();
  await expect(todayDayRow(page, SEGUNDA).getByRole("button", { name: "Iniciar", exact: true })).toBeEnabled();
  await expect(stale.getByRole("link", { name: "Continuar hoje" })).toHaveAttribute("href", `/app/workout/${sessionId}`);
  // The open day is never offered again next to its own row (that started a second copy of it):
  // the hero suggests another day, and the day's row continues the open session.
  await expect(page.getByRole("heading", { level: 2, name: QUINTA })).toHaveCount(0);
  await expect(todayDayRow(page, QUINTA).getByRole("link", { name: "Continuar" })).toHaveAttribute(
    "href",
    `/app/workout/${sessionId}`,
  );

  await stale.getByRole("button", { name: `Salvar como feito em ${day}` }).click();
  await expect(page.getByText(`Treino de ${day} salvo no histórico.`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("stale-session")).toHaveCount(0);
  // Saved on the day it was trained, timed by its sets — not "now" with a 49-hour clock.
  const [status, savedDay, duration] = sql(
    `SELECT status, to_char(("finishedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'DD/MM'), "durationSeconds"
     FROM "WorkoutSession" WHERE id = '${sessionId}'`,
  ).split("|");
  expect(status).toBe("COMPLETED");
  expect(savedDay).toBe(day);
  expect(Number(duration)).toBeLessThan(3600);
});

test("starting a day next to a stale workout opens a fresh one; the stale one stays to be saved", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  await newUserOnGd1(page, "today-stale-start");
  const staleId = await startDayFromToday(page, QUINTA);
  sql(`UPDATE "WorkoutSession" SET "startedAt" = now() - interval '3 days' WHERE id = '${staleId}';
    UPDATE "SetLog" SET "weightKg" = 40, reps = 10, "isCompleted" = true,
      "completedAt" = now() - interval '3 days' + interval '10 minutes', "updatedAt" = now() - interval '3 days'
    WHERE id = (SELECT id FROM "SetLog" WHERE "sessionId" = '${staleId}' AND "setType" = 'WORKING' ORDER BY "setNumber" LIMIT 1);`);

  await page.goto("/app/today");
  await expect(page.getByTestId("stale-session")).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    todayDayRow(page, SEGUNDA).getByRole("button", { name: "Iniciar", exact: true }).click(),
  ]);
  const url = new URL(page.url());
  expect(url.searchParams.get("aviso")).toBeNull();
  expect(url.pathname).not.toBe(`/app/workout/${staleId}`);
  // Nothing of the old workout is lost: it is still there to save on its own day.
  expect(sessionStatus(staleId)).toBe("IN_PROGRESS");
});

test("a workout still being logged past midnight is live, not 'não finalizado'", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  await newUserOnGd1(page, "today-midnight");
  const sessionId = await startDayFromToday(page, QUINTA);
  // Started on the previous São Paulo day, a set ✓'d ten minutes ago.
  sql(`UPDATE "WorkoutSession" SET "startedAt" = now() - interval '1 day' WHERE id = '${sessionId}';
    UPDATE "SetLog" SET "weightKg" = 40, reps = 10, "isCompleted" = true,
      "completedAt" = now() - interval '10 minutes', "updatedAt" = now() - interval '10 minutes'
    WHERE id = (SELECT id FROM "SetLog" WHERE "sessionId" = '${sessionId}' AND "setType" = 'WORKING' ORDER BY "setNumber" LIMIT 1);`);

  await page.goto("/app/today");
  await expect(page.getByText("Treino em andamento", { exact: true })).toBeVisible();
  await expect(page.getByTestId("stale-session")).toHaveCount(0);
  await expect(page.getByText("Finalize ou descarte o treino em andamento para iniciar outro dia.")).toBeVisible();
  await expect(todayDayRow(page, SEGUNDA).getByRole("button", { name: "Iniciar", exact: true })).toBeDisabled();
});

test("an abandoned start stays out of Today unless this device holds offline sets for it", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  await newUserOnGd1(page, "today-stale-local");
  const sessionId = await startDayFromToday(page, QUINTA);
  sql(`UPDATE "WorkoutSession" SET "startedAt" = now() - interval '2 days' WHERE id = '${sessionId}'`);

  // Nothing reached the server: an abandoned start (the next start discards it) — no row.
  await page.goto("/app/today");
  await expect(page.getByRole("button", { name: "Iniciar treino" })).toBeVisible();
  await expect(page.getByTestId("stale-session")).toHaveCount(0);

  // A set typed and ✓'d offline two days ago, still only in this device's draft mirror.
  const setId = sql(
    `SELECT id FROM "SetLog" WHERE "sessionId" = '${sessionId}' AND "setType" = 'WORKING' ORDER BY "setNumber" LIMIT 1`,
  );
  await page.evaluate(
    ({ key, setId }) => {
      const doneAt = Date.now() - 2 * 24 * 3600 * 1000;
      const row = { values: { weight: "50", reps: "8" }, done: true, doneAt, dirty: true, savedAt: null };
      localStorage.setItem(key, JSON.stringify({ v: 2, rows: { [setId]: row } }));
    },
    { key: `fg:workout-drafts:${sessionId}`, setId },
  );
  await page.reload();
  const stale = page.getByTestId("stale-session");
  await expect(stale).toContainText("1 série ficou só neste aparelho");
  // Saving from Today would close it without that set: the save goes through the workout.
  await expect(stale.getByRole("button", { name: /Salvar como feito/ })).toHaveCount(0);
  const review = stale.getByRole("link", { name: "Revisar e salvar" });
  await expect(review).toHaveAttribute("href", `/app/workout/${sessionId}`);
  await review.click();
  await expect
    .poll(() => sql(`SELECT "isCompleted" || '|' || coalesce("weightKg"::text, '') FROM "SetLog" WHERE id = '${setId}'`), {
      timeout: 30_000,
    })
    .toBe("true|50");
});

test("an emptied day is skipped and the week counts only the days left to train", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  await newUserOnGd1(page, "today-empty-day");
  await gotoMyProgram(page);
  const programId = new URL(page.url()).pathname.split("/")[3];
  sql(`DELETE FROM "UserProgramExercise" WHERE "dayId" =
    (SELECT id FROM "UserProgramDay" WHERE "programId" = '${programId}' AND "dayIndex" = 0)`);

  await page.goto("/app/today");
  // GD 1 is 5×/week over 5 days: with Monday emptied it doesn't repeat a day in its place.
  await expect(page.getByText("Próximo treino")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Terça — Inferior (quadríceps, pesado)" })).toBeVisible();
  await expect(page.locator(".reg-frame", { hasText: "Esta semana" })).toContainText("0 / 4");
  const monday = todayDayRow(page, SEGUNDA);
  await expect(monday).toContainText("Sem exercícios");
  await expect(monday.getByRole("link", { name: "Editar" })).toHaveAttribute("href", `/app/programs/${programId}/edit`);
});

test("switching program asks first, and Today can undo it with the old progress intact", async ({ page }) => {
  await newUserOnGd1(page, "today-switch");

  await page.goto("/app/programs/templates/gd-2");
  await expect(page.getByRole("button", { name: "Ativar programa" })).toHaveCount(0);
  // Masthead and sticky bar both say what the tap does.
  const switchButtons = switchToggles(page).filter({ visible: true });
  await expect(switchButtons).toHaveCount(2);
  await switchButtons.last().click();
  await expect(
    page
      .getByText("Isso encerra GD 1 (semana 1 de 13). Seus treinos salvos continuam no histórico.")
      .filter({ visible: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(switchButtons).toHaveCount(2);
  await expect(page.getByText(/^Isso encerra GD 1/).filter({ visible: true })).toHaveCount(0);

  // The sticky start bar sits on top of the bottom nav, never under it.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  const bar = await switchButtons.last().boundingBox();
  const nav = await bottomNav(page).boundingBox();
  expect(bar && nav && bar.y + bar.height <= nav.y).toBeTruthy();

  await switchButtons.first().click();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Trocar", exact: true }).click(),
  ]);
  await expect(page.getByText("Programa trocado")).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Voltar para GD 1" }).click(),
  ]);
  await expect(page.getByText("GD 1 retomado · semana 1")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Voltar para/ })).toHaveCount(0);

  // The copy made by the accidental switch leaves no trace on the shelf.
  await page.goto("/app/programs");
  const mine = page.locator('a[href^="/app/programs/"]:not([href^="/app/programs/templates"]):not([href="/app/programs/new"])');
  await expect(mine.filter({ hasText: "GD 1" })).toHaveCount(1);
  await expect(mine.filter({ hasText: "GD 2" })).toHaveCount(0);
});

test("undoing a switch drops a day opened in the new program, and a stale undo link can't skip a later switch", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  await newUserOnGd1(page, "today-switch-edges");
  const undoUrl = await switchToTemplate(page, "gd-2");

  // A GD 2 day opened (nothing logged), then back to the cached "Voltar para GD 1".
  const openedId = await startDayFromToday(page, "Segunda — Superior A (pesado)");
  const userId = sql(`SELECT "userId" FROM "WorkoutSession" WHERE id = '${openedId}'`);
  await page.goto(undoUrl);
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Voltar para GD 1" }).click(),
  ]);
  await expect(page.getByText("GD 1 retomado · semana 1")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Treino em andamento", { exact: true })).toHaveCount(0);
  expect(sessionStatus(openedId)).toBe("DISCARDED");
  // An untouched copy stays a throwaway even though a day of it was opened.
  expect(sql(`SELECT count(*) FROM "UserProgram" WHERE "userId" = '${userId}' AND name = 'GD 2'`)).toBe("0");

  // A → B → C in quick succession: the link left over from A → B must not bring A back over C.
  const firstUndo = await switchToTemplate(page, "gd-2");
  await switchToTemplate(page, "full-body-beginner");
  await page.goto(firstUndo);
  await expect(page.getByText("Programa trocado")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Voltar para/ })).toHaveCount(0);
});

test("the switch confirmation works before the page hydrates", async ({ page, browser }) => {
  await newUserOnGd1(page, "today-switch-nojs");
  const nojs = await browser.newContext({
    ...devices["iPhone 13"],
    javaScriptEnabled: false,
    baseURL: test.info().project.use.baseURL,
    storageState: await page.context().storageState(),
  });
  try {
    const p = await nojs.newPage();
    await p.goto("/app/programs/templates/gd-2");
    await switchToggles(p).first().click();
    await expect(p.getByText("Isso encerra GD 1 (semana 1 de 13).").first()).toBeVisible();
    await Promise.all([
      p.waitForURL(/\/app\/today/, { timeout: 30_000 }),
      p.getByRole("button", { name: "Trocar", exact: true }).first().click(),
    ]);
    await expect(p.getByText("Programa trocado")).toBeVisible();
  } finally {
    await nojs.close();
  }
});

test("history and the science library are reachable and light the right tab", async ({ page }) => {
  await loginAsTestUser(page, uniqueEmail("today-nav"));
  await completeOnboarding(page);

  await page.goto("/app/today");
  await Promise.all([page.waitForURL(/\/app\/history$/), page.getByRole("link", { name: "Histórico" }).click()]);
  await expect(activeTab(page)).toHaveText("Hoje");

  await page.goto("/app/progress");
  await expect(page.locator('main a[href="/app/history"]')).toHaveCount(2);
  await page.goto("/app/profile");
  await expect(page.getByRole("link", { name: /treinos — ver histórico/ })).toHaveAttribute("href", "/app/history");

  await page.goto("/app/programs");
  await Promise.all([page.waitForURL(/\/app\/science$/), page.getByRole("link", { name: "Ciência dos protocolos" }).click()]);
  await expect(activeTab(page)).toHaveText("Programas");

  await page.goto("/app/discover");
  await expect(activeTab(page)).toHaveText("Perfil");
});
