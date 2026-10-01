import { test, expect, devices, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { loginAsTestUser, newOnboardedUser, revokeSessions, sql, sqlText, userIdOf } from "./fixtures";
import {
  QUINTA,
  expectSetSaved,
  finishAndSave,
  gotoMyProgram,
  newUserOnGd1,
  sessionIdFromUrl,
  startDayFromToday,
  todayDayRow,
  waitForWorkoutScreen,
} from "./workout-helpers";

/**
 * Batch 5, cluster C6 — programs, the workout and Settings: supersets in the
 * builder and on the workout screen (W-104), the training preferences and
 * the theme (W-149), the export and account deletion (W-151), an expired
 * login mid-workout (L-session-expired-workout), links into a Settings
 * section, the weekly e-mail switch's label on a 320px phone, and signing out
 * on a shared phone (its reminders stop). Each test uses a fresh account.
 */

// Drop defaultBrowserType (WebKit): only Chromium is installed for the suite.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use({ ...iPhone, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 150_000 });

/** GD 1's Tuesday: Puxada para o Rosto (A1, 2 sets, 0:20 switch) and Elevação de Panturrilha em Pé (A2, 4 sets, 2:00) are its 4th and 5th exercises. */
const TERCA = "Terça — Inferior (quadríceps, pesado)";
const FACE_PULL = "Puxada para o Rosto (Face Pull)";
const CALF = "Elevação de Panturrilha em Pé";

const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const restBar = (page: Page) => page.locator("[data-rest-state]");

/** The workout's "ver todos" list → the exercise. */
async function openFromOverview(page: Page, name: string) {
  await page.getByRole("button", { name: /ver todos/ }).click();
  await page.getByRole("button", { name: new RegExp(name.replace(/[()]/g, "\\$&")) }).first().click();
  await expect(heading(page)).toContainText(name);
}

async function checkSet(page: Page, n: number, kg: string, reps: string) {
  await page.getByLabel(`Série ${n} — kg`, { exact: true }).fill(kg);
  await page.getByLabel(`Série ${n} — repetições`, { exact: true }).fill(reps);
  await page.getByRole("button", { name: `Concluir série ${n}`, exact: true }).click();
}

/**
 * A server re-render of the page on screen, as better-auth's cookie-cache
 * rewrite causes inside any action run 5+ minutes after the last one (R5):
 * a confirmation must survive it.
 */
async function forceServerRerender(page: Page) {
  await Promise.all([
    page.waitForResponse((r) => r.request().headers()["rsc"] === "1" && r.url().includes(new URL(page.url()).pathname)),
    page.evaluate(() => (window as unknown as { next: { router: { refresh(): void } } }).next.router.refresh()),
  ]);
}

/** Drops better-auth's 5-minute session cache cookie, so the server reads the session row (as SQL left it) again. */
async function dropSessionCache(context: BrowserContext) {
  const keep = (await context.cookies()).filter((c) => c.name !== "better-auth.session_data");
  await context.clearCookies();
  await context.addCookies(keep);
}

/**
 * After an action with the login gone (R5), either outcome is right: the
 * inline "Sua sessão expirou — entre de novo." whose "Entrar" comes back to
 * `back`, or — when better-auth's cookie write re-rendered the page — the
 * login page itself, coming back to `back`. Says which one it was.
 */
async function expectSessionExpired(page: Page, alert: Locator, back: string): Promise<"inline" | "login"> {
  let outcome: "inline" | "login" | null = null;
  await expect(async () => {
    const url = new URL(page.url());
    if (url.pathname === "/login" && (url.searchParams.get("next") ?? "").startsWith(back)) {
      outcome = "login";
    } else if (await alert.isVisible()) {
      const href = (await alert.getByRole("link", { name: "Entrar" }).getAttribute("href", { timeout: 1000 })) ?? "";
      const params = new URL(href, url).searchParams;
      if (params.get("sessao") === "expirada" && (params.get("next") ?? "").startsWith(back)) outcome = "inline";
    }
    expect(outcome, `neither "Sua sessão expirou" with Entrar → ${back} nor the login page (at ${url.pathname}${url.search})`).not.toBeNull();
  }).toPass({ timeout: 20_000 });
  test.info().annotations.push({ type: "session-expired", description: `${back}: ${outcome}` });
  return outcome!;
}

// ---------------------------------------------------------------------------
// W-104 — supersets
// ---------------------------------------------------------------------------

test("builder: 'Agrupar com o próximo' makes a superset, the rest becomes the switch, and it saves; 'Desagrupar' undoes", async ({
  page,
}) => {
  await newUserOnGd1(page, "c6-builder-group");
  // A stretch at the end of Tuesday: in the plan, never in the week's volume (L-volume-counts-stretches).
  const [stretchId, stretchName] = sql(
    `SELECT id || '|' || "namePt" FROM "Exercise" WHERE category = 'STRETCHING' AND "isPublished" ORDER BY slug LIMIT 1`,
  ).split("|");
  sql(`INSERT INTO "UserProgramExercise" (id, "dayId", "exerciseId", "sortOrder", sets, "repMin", "repMax", "restSeconds")
       SELECT 'c6stretch_' || md5(random()::text), d.id, ${sqlText(stretchId)}, 99, 1, 30, 30, 30
         FROM "UserProgramDay" d JOIN "UserProgram" p ON p.id = d."programId"
        WHERE p."userId" = ${sqlText(await userIdOf(page))} AND d.name = ${sqlText(TERCA)}`);
  await gotoMyProgram(page);
  await page.goto(`${page.url()}/edit`);
  await page.getByRole("tab", { name: TERCA, exact: true }).click();
  const rowNamed = (name: string) => page.locator("[data-row-id]").filter({ has: page.locator("[data-row-name]", { hasText: name }) });
  await expect(rowNamed(stretchName)).toContainText("Não conta no volume");
  await expect(rowNamed("Agachamento Hack")).not.toContainText("Não conta no volume");

  // GD 1 already pairs the face pull with the calf raise.
  await expect(rowNamed(FACE_PULL)).toHaveAttribute("data-group", "A1");
  await expect(rowNamed(CALF)).toHaveAttribute("data-group", "A2");
  await expect(rowNamed(FACE_PULL)).toContainText("Superset A · alterne as séries");
  await expect(rowNamed(FACE_PULL)).toContainText("0:20 até A2");
  await expect(rowNamed(CALF)).toContainText("2:00 após a rodada");

  // A new pair above it takes the letter A; the old one becomes B.
  await rowNamed("Agachamento Hack").getByRole("button", { name: "Opções de Agachamento Hack" }).click();
  await page.getByRole("button", { name: "Agrupar com o próximo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Superset A criado · 0:20 entre os dois" })).toBeVisible();
  await expect(rowNamed("Agachamento Hack")).toHaveAttribute("data-group", "A1");
  await expect(rowNamed("Cadeira Extensora")).toHaveAttribute("data-group", "A2");
  await expect(rowNamed(FACE_PULL)).toHaveAttribute("data-group", "B1");
  await expect(rowNamed("Agachamento Hack")).toContainText("0:20 até A2");

  // Opened, the first member's rest is the switch: short chips.
  await rowNamed("Agachamento Hack").locator("[data-row-toggle]").click();
  await expect(rowNamed("Agachamento Hack").getByRole("group", { name: "Troca para A2" })).toBeVisible();
  await expect(rowNamed("Agachamento Hack").getByRole("button", { name: "0:20", exact: true })).toHaveAttribute("aria-pressed", "true");
  await rowNamed("Agachamento Hack").locator("[data-row-toggle]").click();

  // Desfazer brings the list back as it was.
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(rowNamed("Agachamento Hack")).not.toHaveAttribute("data-group", /.+/);
  await expect(rowNamed("Agachamento Hack")).toContainText("3:00");
  await expect(rowNamed(FACE_PULL)).toHaveAttribute("data-group", "A1");

  // Again, and saved: the reload keeps it.
  await rowNamed("Agachamento Hack").getByRole("button", { name: "Opções de Agachamento Hack" }).click();
  await page.getByRole("button", { name: "Agrupar com o próximo" }).click();
  await page.getByRole("button", { name: "Salvar programa" }).click();
  await expect(page.getByRole("button", { name: "Salvo" })).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await page.getByRole("tab", { name: TERCA, exact: true }).click();
  await expect(rowNamed("Agachamento Hack")).toHaveAttribute("data-group", "A1");
  await expect(rowNamed("Cadeira Extensora")).toHaveAttribute("data-group", "A2");
  await expect(rowNamed(FACE_PULL)).toHaveAttribute("data-group", "B1");

  // "Desagrupar" on the group's header dissolves it; Desfazer puts it back.
  await page.getByRole("button", { name: "Desagrupar Superset A" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Superset desfeito — confira os descansos" })).toBeVisible();
  await expect(rowNamed("Agachamento Hack")).not.toHaveAttribute("data-group", /.+/);
  await expect(rowNamed(FACE_PULL)).toHaveAttribute("data-group", "A1");
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(rowNamed("Agachamento Hack")).toHaveAttribute("data-group", "A1");

  // "Separar do superset" from the row's menu takes a pair apart.
  await rowNamed(CALF).getByRole("button", { name: `Opções de ${CALF}` }).click();
  await page.getByRole("button", { name: "Separar do superset" }).click();
  await expect(rowNamed(CALF)).not.toHaveAttribute("data-group", /.+/);
  await expect(rowNamed(FACE_PULL)).not.toHaveAttribute("data-group", /.+/);

  // A copy made while "Desfazer" is still offered stays, and Desfazer still takes the new pair apart.
  await rowNamed(FACE_PULL).getByRole("button", { name: `Opções de ${FACE_PULL}` }).click();
  await page.getByRole("button", { name: "Agrupar com o próximo" }).click();
  await expect(rowNamed(FACE_PULL)).toHaveAttribute("data-group", "B1");
  await rowNamed(CALF).getByRole("button", { name: `Opções de ${CALF}` }).click();
  await page.getByRole("button", { name: "Duplicar", exact: true }).click();
  await expect(rowNamed(CALF)).toHaveCount(2);
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(rowNamed(FACE_PULL)).not.toHaveAttribute("data-group", /.+/);
  await expect(rowNamed(CALF).first()).not.toHaveAttribute("data-group", /.+/);
  await expect(rowNamed(CALF)).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("workout: a superset alternates its members — the switch, the round's rest and back — and a touch cancels the move", async ({
  page,
}) => {
  await newUserOnGd1(page, "c6-superset-flow");
  const sessionId = await startDayFromToday(page, TERCA);
  await openFromOverview(page, FACE_PULL);
  await expect(heading(page)).toHaveText(`A1 · ${FACE_PULL}`);

  const strip = page.getByRole("navigation", { name: "Superset A" });
  await expect(strip).toContainText("Superset A · alterne as séries");
  await expect(strip.getByRole("button")).toHaveCount(2);
  await expect(page.getByText("Troca para A2 em 0:20")).toBeVisible();

  // ✓ A1: the 20 s switch, and the screen moves to A2 by itself.
  await checkSet(page, 1, "20", "15");
  await expect(restBar(page)).toContainText("Transição");
  await expect(heading(page)).toHaveText(`A2 · ${CALF}`, { timeout: 1500 });
  await expect(page.getByText("Descanso 2:00 após a rodada")).toBeVisible();

  // ✓ A2: the round's rest, back to A1.
  await checkSet(page, 1, "40", "12");
  await expect(restBar(page)).toContainText("Descanso");
  await expect(restBar(page)).not.toContainText("Transição");
  await expect(heading(page)).toHaveText(`A1 · ${FACE_PULL}`, { timeout: 1500 });

  // A touch within the moment before the move keeps the screen where it is.
  await checkSet(page, 2, "20", "15");
  await page.getByLabel("Série 2 — repetições", { exact: true }).click();
  await page.waitForTimeout(1500);
  await expect(heading(page)).toHaveText(`A1 · ${FACE_PULL}`);
  // …and the bar offers the partner instead.
  await expect(restBar(page).getByRole("button", { name: `Próximo · A2 · ${CALF}` })).toBeVisible();

  // The strip's chips go straight to a member; A1 is done.
  await expect(strip.getByRole("button", { name: new RegExp(`^A1 ${FACE_PULL.replace(/[()]/g, "\\$&")}, concluído`) })).toBeVisible();
  await strip.getByRole("button", { name: /^A2 / }).click();
  await expect(heading(page)).toHaveText(`A2 · ${CALF}`);

  // A1 is out of sets: A2's leftovers go solo, with the round's rest, staying on A2.
  await checkSet(page, 2, "40", "12");
  await expect(restBar(page)).toContainText("Descanso");
  await page.waitForTimeout(1200);
  await expect(heading(page)).toHaveText(`A2 · ${CALF}`);

  // The overview marks the pair.
  await page.getByRole("button", { name: /ver todos/ }).click();
  await expect(page.locator('[data-group="A1"]')).toContainText("A1");
  await expect(page.locator('[data-group="A2"]')).toContainText("A2");

  // The sets are saved as done, in their order.
  await expectSetSaved(page, "Série 2");
  const saved = sql(
    `SELECT string_agg(e."sortOrder" || ':' || l."setNumber", ',' ORDER BY l."completedAt") FROM "SetLog" l
       JOIN "WorkoutExerciseLog" e ON e.id = l."exerciseLogId"
      WHERE l."sessionId" = ${sqlText(sessionId)} AND l."isCompleted" AND l."setType" <> 'WARMUP'`,
  );
  expect(saved).toBe("3:1,4:1,3:2,4:2");
});

// ---------------------------------------------------------------------------
// W-149 — training preferences and the theme
// ---------------------------------------------------------------------------

test("Settings: the load step, vibration and the theme are kept; the theme applies before the page draws", async ({ page }) => {
  await newUserOnGd1(page, "c6-prefs");
  await page.goto("/app/settings");

  // Durante o treino · Salto de carga.
  const steps = page.getByRole("radiogroup", { name: /Salto de carga/ });
  await expect(steps.getByRole("radio", { name: "2,5 quilos" })).toHaveAttribute("aria-checked", "true");
  // Said the pt-BR way: singular below 2.
  await expect(steps.getByRole("radio", { name: "0,5 quilo", exact: true })).toBeVisible();
  await expect(steps.getByRole("radio", { name: "1,25 quilo", exact: true })).toBeVisible();
  await steps.getByRole("radio", { name: "1 quilo" }).click();
  await expect(page.getByText("Salvo ✓").first()).toBeVisible({ timeout: 15_000 });

  // Vibração off.
  const vibration = page.getByRole("switch", { name: /Vibração/ });
  await expect(vibration).toBeChecked();
  await vibration.uncheck({ force: true });
  await expect(page.getByText("Salvo ✓").first()).toBeVisible({ timeout: 15_000 });

  // A server re-render right after (R5) keeps what the screen confirmed.
  await forceServerRerender(page);
  await expect(steps.getByRole("radio", { name: "1 quilo" })).toHaveAttribute("aria-checked", "true");
  await expect(vibration).not.toBeChecked();

  await page.reload();
  await expect(page.getByRole("radiogroup", { name: /Salto de carga/ }).getByRole("radio", { name: "1 quilo" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByRole("switch", { name: /Vibração/ })).not.toBeChecked();
  const userId = await userIdOf(page);
  expect(sql(`SELECT "loadIncrementKg" || ',' || "hapticsEnabled" FROM "Profile" WHERE "userId" = ${sqlText(userId)}`)).toBe("1,false");

  // Aparência: applied at once, no server call.
  const theme = page.getByRole("radiogroup", { name: "Tema" });
  await expect(theme.getByRole("radio", { name: /Automático/ })).toHaveAttribute("aria-checked", "true");
  await theme.getByRole("radio", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect((await page.context().cookies()).find((c) => c.name === "fg-theme")?.value).toBe("dark");
  // The status bar follows the forced theme.
  const metas = page.locator('meta[name="theme-color"]');
  for (const meta of await metas.all()) await expect(meta).toHaveAttribute("content", "#0b0c0e");
  // …and holds through a server re-render (R5).
  await forceServerRerender(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(theme.getByRole("radio", { name: "Escuro" })).toHaveAttribute("aria-checked", "true");
  for (const meta of await metas.all()) await expect(meta).toHaveAttribute("content", "#0b0c0e");
  // A client navigation makes Next write its theme-color metas again: the status bar stays dark.
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Programas" }).click();
  await page.waitForURL(/\/app\/programs$/);
  await expect.poll(() => metas.evaluateAll((ms) => ms.map((m) => m.getAttribute("content")).join(","))).toMatch(/^(#0b0c0e,?)+$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Another page, loaded fresh: dark as the HTML is parsed, before React runs.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { __themeAtParse: string | null }).__themeAtParse = document.documentElement.getAttribute("data-theme");
    });
  });
  await page.goto("/app/programs");
  expect(await page.evaluate(() => (window as unknown as { __themeAtParse: string | null }).__themeAtParse)).toBe("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  // The offline page too.
  await page.goto("/offline.html");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Automático: back to the system theme, nothing stored.
  await page.goto("/app/settings");
  await expect(page.getByRole("radiogroup", { name: "Tema" }).getByRole("radio", { name: "Escuro" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radiogroup", { name: "Tema" }).getByRole("radio", { name: /Automático/ }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  expect((await page.context().cookies()).find((c) => c.name === "fg-theme")).toBeUndefined();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("the load step decides the next suggestion; vibration off stays silent at the end of a rest", async ({ page }) => {
  await newUserOnGd1(page, "c6-step");
  const userId = await userIdOf(page);
  sql(`UPDATE "Profile" SET "loadIncrementKg" = 1, "hapticsEnabled" = false WHERE "userId" = ${sqlText(userId)}`);
  await page.addInitScript(() => {
    const w = window as unknown as { __vibrations: number };
    w.__vibrations = 0;
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: () => {
        w.__vibrations++;
        return true;
      },
    });
  });

  // 3 × 40 kg × 12 on an 8–12 range: next time goes up by the user's step, 1 kg.
  const first = await startDayFromToday(page, QUINTA);
  // A short rest, to see its end.
  sql(`UPDATE "WorkoutExerciseLog" SET "restSeconds" = 3 WHERE "sessionId" = ${sqlText(first)}`);
  await page.reload();
  await waitForWorkoutScreen(page);
  for (let n = 1; n <= 3; n++) {
    await checkSet(page, n, "40", "12");
    await page.getByLabel(`Série ${n} — RIR`, { exact: true }).fill("3");
    await expectSetSaved(page, `Série ${n}`);
  }
  await expect(restBar(page)).toHaveAttribute("data-rest-state", "ended", { timeout: 10_000 });
  expect(await page.evaluate(() => (window as unknown as { __vibrations: number }).__vibrations)).toBe(0);
  await finishAndSave(page);

  await page.goto("/app/today");
  const row = todayDayRow(page, QUINTA);
  await row.getByRole("button", { name: "Refazer" }).click();
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    row.getByRole("button", { name: "Sim, treinar de novo" }).click(),
  ]);
  await waitForWorkoutScreen(page);
  await expect(page.locator("[data-advice]")).toContainText("Suba para 41");
  await expect(page.getByLabel("Série 1 — kg", { exact: true })).toHaveAttribute("placeholder", "41");

  // Vibration back on: the end of a rest buzzes.
  sql(`UPDATE "Profile" SET "hapticsEnabled" = true WHERE "userId" = ${sqlText(userId)}`);
  sql(`UPDATE "WorkoutExerciseLog" SET "restSeconds" = 3 WHERE "sessionId" = ${sqlText(sessionIdFromUrl(page.url()))}`);
  await page.reload();
  await waitForWorkoutScreen(page);
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  await expect(restBar(page)).toHaveAttribute("data-rest-state", "ended", { timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __vibrations: number }).__vibrations)).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// W-151 — export and account deletion
// ---------------------------------------------------------------------------

test("export: a spreadsheet of the sets and everything in JSON, named by the day", async ({ page }) => {
  await newUserOnGd1(page, "c6-export");
  const sessionId = await startDayFromToday(page, QUINTA);
  await checkSet(page, 1, "42,5", "10");
  await expectSetSaved(page, "Série 1");
  await finishAndSave(page);
  expect(sessionId).toBeTruthy();

  await page.goto("/app/settings");
  const zone = page.locator("#dados-e-conta");
  await expect(zone).toContainText("Seus treinos em planilha (uma linha por série) ou tudo o que a conta guarda, em JSON.");

  const [csv] = await Promise.all([page.waitForEvent("download"), zone.getByRole("link", { name: "Planilha (CSV)" }).click()]);
  expect(csv.suggestedFilename()).toMatch(/^fgpower-treinos-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = (await (await csv.createReadStream()).toArray()).join("");
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const lines = text.slice(1).split("\r\n");
  expect(lines[0]).toBe("Data;Início;Treino;Programa;Semana;Ordem;Grupo;Exercício;No lugar de;Série;Tipo;Extra;Carga (kg);Reps;Segundos;RIR;Nota da série");
  // "Série 1", as the workout screen named it — not its row number after the two warm-ups.
  expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2};\d{2}:\d{2};Quinta — Puxar \(moderado\);GD 1;1;1;;Puxada Alta Unilateral no Pulley;;1;Válida;não;42,5;10;;/);

  const [json] = await Promise.all([page.waitForEvent("download"), zone.getByRole("link", { name: "JSON" }).click()]);
  expect(json.suggestedFilename()).toMatch(/^fgpower-dados-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse((await (await json.createReadStream()).toArray()).join(""));
  expect(data).toMatchObject({ format: "fgpower-export", version: 2 });
  expect(data.workouts[0]).toMatchObject({ name: "Quinta — Puxar (moderado)", status: "Concluído", program: "GD 1" });
  // Only what was done or typed: the warm-ups and sets never touched stay out.
  expect(data.workouts[0].exercises[0].sets).toHaveLength(1);
  expect(data.workouts[0].exercises[0].sets[0]).toMatchObject({ number: 1, weightKg: 42.5, reps: 10, type: "Válida", completed: true });
  expect(JSON.stringify(data)).not.toMatch(/"(userId|exerciseId|sessionId)"/);

  // Without a session the route answers 401, never someone's data.
  const anon = await page.context().browser()!.newContext();
  const res = await anon.request.get(new URL("/api/account/export?format=csv", page.url()).toString());
  expect(res.status()).toBe(401);
  expect(res.headers()["cache-control"]).toContain("no-store");
  await anon.close();
});

test("deleting the account: an old login is asked to sign in again first, and comes back to the open panel", async ({
  page,
  context,
}) => {
  await newUserOnGd1(page, "c6-delete");
  const userId = await userIdOf(page);
  const email = sql(`SELECT email FROM "user" WHERE id = ${sqlText(userId)}`);
  sql(`UPDATE "session" SET "createdAt" = now() - interval '2 days' WHERE "userId" = ${sqlText(userId)}`);
  // A real 2-day-old login: the 5-minute session cache holds the row's createdAt too.
  await dropSessionCache(context);
  await page.goto("/app/settings");

  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await expect(page.getByRole("heading", { name: `Excluir a conta ${email}?` })).toBeFocused();
  await expect(page.getByText("Por segurança, excluir a conta pede um login feito nas últimas 24 horas.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sim, excluir permanentemente" })).toHaveCount(0);
  await Promise.all([
    page.waitForURL(/\/login\?next=%2Fapp%2Fsettings%3Fexcluir%3D1/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Entrar de novo para excluir" }).click(),
  ]);

  // Signed in again (the test login stands in for Google/e-mail), back at the panel.
  await page.request.post("/api/test/login", { data: { email, name: "E2E" } });
  await page.goto("/app/settings?excluir=1");
  const title = page.getByRole("heading", { name: `Excluir a conta ${email}?` });
  await expect(title).toBeFocused();
  await expect(page).toHaveURL(/\/app\/settings$/);
  // The panel stays open through a server re-render (R5), with the URL no longer asking for it —
  // then too: a reload won't open it again.
  await forceServerRerender(page);
  await expect(title).toBeVisible();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(page.getByRole("button", { name: "Sim, excluir permanentemente" })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("fg:workout-pref:test", "1"));

  await Promise.all([
    page.waitForURL(/\/\?conta=excluida$/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Sim, excluir permanentemente" }).click(),
  ]);
  // The landing says so (C3's notice), and this phone keeps nothing of the account.
  await expect(page.getByRole("status").filter({ hasText: "Sua conta foi excluída e seus dados foram apagados." })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("fg:")))).toEqual([]);
  expect(sql(`SELECT count(*) FROM "user" WHERE id = ${sqlText(userId)}`)).toBe("0");
});

// ---------------------------------------------------------------------------
// L-session-expired-workout
// ---------------------------------------------------------------------------

test("mid-workout, an expired login says so with 'Entrar' back to the exercise, and nothing typed is lost", async ({ page, context }) => {
  await newUserOnGd1(page, "c6-expired");
  const userId = await userIdOf(page);
  const email = sql(`SELECT email FROM "user" WHERE id = ${sqlText(userId)}`);
  const sessionId = await startDayFromToday(page, QUINTA);
  await checkSet(page, 1, "40", "10");
  await expectSetSaved(page, "Série 1");
  await revokeSessions(userId, context);

  // Typed after the login ended: the send is held, and the header says why — and where "entre de novo" comes back.
  await page.getByLabel("Série 2 — kg", { exact: true }).fill("42,5");
  await page.getByLabel("Série 2 — repetições", { exact: true }).fill("9");
  await expect(page.getByRole("link", { name: "entre de novo" })).toHaveAttribute("href", new RegExp(`next=%2Fapp%2Fworkout%2F${sessionId}`), {
    timeout: 15_000,
  });

  // The finish: the session is gone — said so, never "verifique a conexão".
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Finalizar e salvar" }).click();
  const finishAlert = dialog.getByRole("alert").filter({ hasText: "Sua sessão expirou — entre de novo. Nada do que você digitou foi perdido." });
  const outcome = await expectSessionExpired(page, finishAlert, `/app/workout/${sessionId}`);
  await expect(page.getByText(/verifique a conexão/)).toHaveCount(0);
  // Nothing typed is lost, either way.
  expect(await page.evaluate((id) => localStorage.getItem(`fg:workout-drafts:${id}`) ?? "", sessionId)).toContain('"42,5"');

  if (outcome === "inline") {
    await expect(finishAlert.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", new RegExp(`next=%2Fapp%2Fworkout%2F${sessionId}%3Fex%3D`));
    await dialog.getByRole("button", { name: "Continuar treinando" }).click();

    // Trocar and Ver técnica: the session message, no retry that can't work.
    await page.getByRole("button", { name: "Trocar", exact: true }).click();
    const swap = page.locator("[data-swap-sheet]");
    await expect(swap.getByText("Sua sessão expirou — entre de novo.")).toBeVisible({ timeout: 15_000 });
    await expect(swap.getByRole("button", { name: "Tentar de novo" })).toHaveCount(0);
    await swap.getByRole("button", { name: "Fechar" }).click();
    await page.getByRole("button", { name: "Ver técnica", exact: true }).click();
    const technique = page.locator("[data-technique-sheet]");
    await expect(technique.getByText("Sua sessão expirou — entre de novo.")).toBeVisible({ timeout: 15_000 });
    await expect(technique.getByRole("button", { name: "Tentar de novo" })).toHaveCount(0);
  }

  // Signed in again, back at the workout: the typed set is still there and goes out.
  await loginAsTestUser(page, email);
  await page.goto(`/app/workout/${sessionId}`);
  await waitForWorkoutScreen(page);
  await expect(page.getByLabel("Série 2 — kg", { exact: true })).toHaveValue("42,5");
  await expect
    .poll(
      () =>
        sql(
          `SELECT s."weightKg" || 'x' || s.reps FROM "SetLog" s JOIN "WorkoutExerciseLog" e ON e.id = s."exerciseLogId"
            WHERE s."sessionId" = ${sqlText(sessionId)} AND e."sortOrder" = 0 AND s."setType" = 'WORKING' AND NOT s."isExtra"
            ORDER BY s."setNumber" OFFSET 1 LIMIT 1`,
        ),
      { timeout: 20_000 },
    )
    .toBe("42.5x9");
  await expect(page.getByRole("link", { name: "entre de novo" })).toHaveCount(0);
});

test("on the summary, 'Usar no programa', 'Excluir treino' and 'Editar séries' with the login gone say so, with 'Entrar' back, and change nothing", async ({
  page,
  context,
}) => {
  await newUserOnGd1(page, "c6-summary-expired");
  const userId = await userIdOf(page);
  const email = sql(`SELECT email FROM "user" WHERE id = ${sqlText(userId)}`);
  const sessionId = await startDayFromToday(page, QUINTA);
  // A swap, so the summary offers "Usar no programa".
  await page.getByRole("button", { name: "Trocar", exact: true }).click();
  const pick = page.locator("[data-swap-sheet]").getByRole("button", { name: /^Trocar por / }).first();
  await expect(pick).toBeVisible({ timeout: 20_000 });
  await pick.click();
  await expect(page.locator("[data-swap-sheet]")).toHaveCount(0, { timeout: 20_000 });
  await checkSet(page, 1, "30", "10");
  await expectSetSaved(page, "Série 1");
  const summaryPath = new URL(await finishAndSave(page)).pathname;
  const expired = (scope: Page | Locator) => scope.getByRole("alert").filter({ hasText: "Sua sessão expirou — entre de novo." });
  const programFirstExercise = () =>
    sql(
      `SELECT pe."exerciseId" FROM "WorkoutSession" s JOIN "UserProgramExercise" pe ON pe."dayId" = s."programDayId"
        WHERE s.id = ${sqlText(sessionId)} ORDER BY pe."sortOrder" LIMIT 1`,
    );
  const programBefore = programFirstExercise();

  // Signed out for good (the cookie gone, 30 days away), so the action itself answers: the inline
  // message with "Entrar" (a revoked session whose cookie is still here usually lands on /login instead).
  // "Usar no programa": the program keeps its exercise.
  await context.clearCookies();
  const swapLine = page.locator("[data-swap]");
  await swapLine.getByRole("button", { name: "Usar no programa" }).click();
  await expectSessionExpired(page, expired(swapLine), summaryPath);
  await expect(page.getByText("Não deu — tente de novo.")).toHaveCount(0);
  expect(programFirstExercise()).toBe(programBefore);

  // "Excluir treino": the workout stays.
  await loginAsTestUser(page, email);
  await page.goto(summaryPath);
  await page.getByRole("button", { name: "Opções do treino" }).click();
  await page.getByRole("button", { name: "Excluir treino" }).click();
  const sheet = page.getByRole("alertdialog");
  await context.clearCookies();
  await sheet.getByRole("button", { name: "Excluir treino" }).click();
  await expectSessionExpired(page, expired(sheet), summaryPath);
  await expect(page.getByText(/^Sem conexão/)).toHaveCount(0);
  expect(sql(`SELECT status FROM "WorkoutSession" WHERE id = ${sqlText(sessionId)}`)).toBe("COMPLETED");

  // "Editar séries": the set keeps its reps.
  await loginAsTestUser(page, email);
  await page.goto(`${summaryPath}/editar`);
  await page.getByRole("textbox", { name: "Série 1 — repetições", exact: true }).fill("11");
  await context.clearCookies();
  await page.getByRole("button", { name: "Salvar correções" }).click();
  await expectSessionExpired(page, expired(page), `${summaryPath}/editar`);
  await expect(page.getByText(/^Sem conexão/)).toHaveCount(0);
  expect(
    sql(`SELECT string_agg(reps::text, ',') FROM "SetLog" WHERE "sessionId" = ${sqlText(sessionId)} AND "isCompleted" AND "setType" <> 'WARMUP'`),
  ).toBe("10");
});

// L-session-expired-social, the favorite part (R1).
test("favorite: with the login gone, the heart rolls back and says so with 'Entrar', which doesn't fade", async ({ page, context }) => {
  await newOnboardedUser(page, { label: "c6-fav-expired" });
  await page.goto("/app/exercises/pushups");
  const heart = page.getByRole("button", { name: "Adicionar aos favoritos" });
  await expect(heart).toBeVisible();
  // Signed out for good: the cookie is gone (30 days away).
  await context.clearCookies();
  await heart.click();
  const alert = page.getByRole("alert").filter({ hasText: "Sua sessão expirou — entre de novo." });
  if ((await expectSessionExpired(page, alert, "/app/exercises/pushups")) === "inline") {
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    // Not a passing error that fades after 4 s: waiting won't bring the login back.
    await page.waitForTimeout(5_000);
    await expect(alert.getByRole("link", { name: "Entrar" })).toBeVisible();
    // It floats over "Meu histórico": closing it by hand gives the page back, focus on the heart.
    await page.getByRole("button", { name: "Fechar aviso" }).click();
    await expect(alert).toHaveCount(0);
    await expect(heart).toBeFocused();
    await page.getByRole("link", { name: "Meu histórico" }).click({ trial: true });
  }
});

// ---------------------------------------------------------------------------
// Settings: links into a section, and signing out on a shared phone
// ---------------------------------------------------------------------------

/**
 * A client navigation, as a <Link> or the block flow's router.replace makes
 * it: Settings' loading skeleton commits first, where Next's own #hash
 * scroll finds nothing (ScrollToHash lands it once the sections are in).
 */
async function navigateInApp(page: Page, href: string) {
  const to = new URL(href, "http://app");
  // Asked again until it goes: a push made while the page is still hydrating can be dropped.
  await expect(async () => {
    await page.evaluate((h) => (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(h), href);
    await page.waitForURL((u) => u.pathname === to.pathname && u.hash === to.hash, { timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
}

test("Settings: a link into a section lands on it, focus included — Rotina, Lembretes, Contas bloqueadas", async ({ page }) => {
  await newOnboardedUser(page, { label: "c6-anchors" });
  for (const [href, id, title] of [
    // The reminder ask's "Trocar dias".
    ["/app/settings#rotina", "rotina", "Rotina"],
    // The weekly e-mail's "Preferências", /email/cancelar.
    ["/app/settings#lembretes", "lembretes", "Lembretes"],
    // Where blocking someone from their profile sends, with its one-time notice.
    ["/app/settings?bloqueado=1#bloqueados", "bloqueados", "Contas bloqueadas"],
  ] as const) {
    await page.goto("/app/today");
    await navigateInApp(page, href);
    const section = page.locator(`section#${id}`);
    await expect(section.getByRole("heading", { level: 2, name: title })).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    // As a fragment link lands: a screen reader reads on from the section, the next Tab goes into it.
    await expect(section).toBeFocused();
  }
  const notice = page.getByText("Conta bloqueada.");
  await expect(notice).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.has("bloqueado")).toBe(false);
  // Scrolled up to change something else: the save's server re-render (R5) keeps the page where it is —
  // it doesn't pull it back to #bloqueados — and neither the notice nor ?bloqueado=1 come back.
  await page.evaluate(() => window.scrollTo(0, 0));
  await forceServerRerender(page);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(notice).toBeVisible();
  expect(new URL(page.url()).searchParams.has("bloqueado")).toBe(false);

  // Loaded fresh (a link from outside the app): the same landing.
  await page.goto("/app/today");
  await page.goto("/app/settings#usuario");
  await expect(page.locator("section#usuario").getByRole("heading", { level: 2, name: "Usuário público" })).toBeInViewport();

  // A link to a field rather than a section lands on it too, and leaves it where Tab finds it.
  await page.goto("/app/today");
  await page.goto("/app/settings#username");
  const handle = page.getByLabel("Nome de usuário público");
  await expect(handle).toBeFocused();
  await expect(handle).toBeInViewport();
  expect(await handle.evaluate((el) => [el.tabIndex, el.getAttribute("tabindex")])).toEqual([0, null]);
});

test("Settings: the weekly e-mail switch's label never breaks inside 'e-mail' on a 320px phone", async ({ page }) => {
  await newOnboardedUser(page, { label: "c6-digest-label" });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/app/settings#lembretes");
  await expect(page.locator("section#lembretes")).toBeVisible();
  const label = page.locator("section#lembretes label").getByText("Resumo semanal por e-mail", { exact: true });
  test.skip((await label.count()) === 0, "the weekly e-mail isn't configured here");
  // Where each piece of the label's text sits: "e-" and "mail" on the same line, not "…por e-" / "mail".
  const tops = await label.evaluate((el) => {
    const text = el.firstChild as Text;
    const top = (from: number, to: number) => {
      const range = document.createRange();
      range.setStart(text, from);
      range.setEnd(text, to);
      return Math.round(range.getBoundingClientRect().top);
    };
    const at = text.data.indexOf("e-mail");
    return { e: top(at, at + 2), mail: top(at + 2, at + 6) };
  });
  expect(tops.mail).toBe(tops.e);
});

/**
 * The browser's push stack, stubbed as e2e/27 does it (headless Chromium
 * can't hold a real subscription): permission, a worker registration and one
 * subscription, kept in localStorage so they outlive the sign-out's full page
 * load. `e2e-push:throw` makes the browser refuse to say (a SecurityError).
 */
async function stubPush(context: BrowserContext) {
  await context.addInitScript(() => {
    const store = {
      get: (k: string) => window.localStorage.getItem(`e2e-push:${k}`),
      set: (k: string, v: string | null) =>
        v === null ? window.localStorage.removeItem(`e2e-push:${k}`) : window.localStorage.setItem(`e2e-push:${k}`, v),
    };
    const makeSub = (endpoint: string, key: number[]) => ({
      endpoint,
      options: { userVisibleOnly: true, applicationServerKey: new Uint8Array(key).buffer },
      toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } }),
      unsubscribe: async () => {
        store.set("sub", null);
        return true;
      },
    });
    const pushManager = {
      getSubscription: async () => {
        const raw = store.get("sub");
        if (!raw) return null;
        const { endpoint, key } = JSON.parse(raw);
        return makeSub(endpoint, key);
      },
      subscribe: async () => {
        throw new DOMException("not in this test", "NotAllowedError");
      },
    };
    const registration = { pushManager, getNotifications: async () => [], showNotification: async () => undefined };
    const lookUp = async () => {
      if (store.get("throw")) throw new DOMException("The operation is insecure.", "SecurityError");
      return registration;
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: lookUp,
        register: lookUp,
        ready: Promise.resolve(registration),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
    (window as unknown as { PushManager: unknown }).PushManager ??= function PushManager() {};
    (window as unknown as { Notification: unknown }).Notification = class {
      static get permission() {
        return store.get("permission") ?? "default";
      }
      static async requestPermission() {
        return "granted";
      }
    };
  });
}

const PUSH_ENDPOINT = "https://fcm.googleapis.com/fcm/send/e2e-signout";

/** A device of the account (a PushSubscription row). */
function addDevice(userId: string, endpoint: string) {
  sql(
    `INSERT INTO "PushSubscription" (id, "userId", endpoint, p256dh, auth) VALUES (${sqlText(endpoint.slice(-40))}, ${sqlText(userId)}, ${sqlText(endpoint)}, '${"B".repeat(87)}', '${"a".repeat(22)}')`,
  );
}

/** This browser holds `endpoint` as its subscription, one of the account's devices. */
async function subscribeThisPhone(page: Page, userId: string, endpoint: string) {
  addDevice(userId, endpoint);
  await page.evaluate((e) => {
    window.localStorage.setItem("e2e-push:sub", JSON.stringify({ endpoint: e, key: [1, 2, 3] }));
    window.localStorage.setItem("e2e-push:permission", "granted");
  }, endpoint);
}

const browserSubscription = (page: Page) => page.evaluate(() => window.localStorage.getItem("e2e-push:sub"));
const deviceRows = (endpoint: string) => sql(`SELECT count(*) FROM "PushSubscription" WHERE endpoint = ${sqlText(endpoint)}`);

/** Settings → "Sair" → the confirm step (returned). */
async function openSignOut(page: Page) {
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  return page.getByRole("group", { name: "Confirmar saída" });
}

async function confirmSignOut(page: Page, confirm: Locator, timeout = 30_000) {
  await Promise.all([
    page.waitForURL(/\/login/, { timeout }),
    confirm.getByRole("button", { name: /^(Sim, sair|Tentar de novo)$/ }).click(),
  ]);
}

test("signing out stops this phone's reminders: the account forgets it and the browser drops it; offline, the retry still does", async ({
  page,
  context,
}) => {
  await stubPush(context);
  const me = await newOnboardedUser(page, { label: "c6-signout-push" });
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const phone = `${PUSH_ENDPOINT}-phone-${stamp}`;
  const laptop = `${PUSH_ENDPOINT}-laptop-${stamp}`;
  addDevice(me.id, laptop);
  await subscribeThisPhone(page, me.id, phone);

  // Offline: the sign-out itself fails and says so — and the reminders are left for the retry to stop.
  const confirm = await openSignOut(page);
  await context.setOffline(true);
  await confirm.getByRole("button", { name: "Sim, sair" }).click();
  await expect(confirm.getByRole("alert")).toContainText(/Sem conexão/);
  expect(await browserSubscription(page)).not.toBeNull();
  expect(deviceRows(phone)).toBe("1");
  await context.setOffline(false);
  // A server re-render meanwhile (R5) keeps the confirm step open, and what it said.
  await forceServerRerender(page);
  await expect(confirm.getByRole("alert")).toContainText(/Sem conexão/);

  await confirmSignOut(page, confirm);
  // This phone is off the account and out of the browser; the other device keeps its reminders.
  expect(deviceRows(phone)).toBe("0");
  expect(deviceRows(laptop)).toBe("1");
  expect(await browserSubscription(page)).toBeNull();
  await page.goto("/app/today");
  await expect(page).toHaveURL(/\/login/);
});

test("signing out never waits on the reminders: a hung or refused push API, a browser that won't say, the login already gone", async ({
  page,
  context,
}) => {
  await stubPush(context);
  const me = await newOnboardedUser(page, { label: "c6-signout-slow" });
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Hung: the push API never answers. Out in seconds anyway, the browser's subscription dropped — the
  // account's row goes with the next reminder, which the push service answers 404/410.
  const hung = `${PUSH_ENDPOINT}-hung-${stamp}`;
  await subscribeThisPhone(page, me.id, hung);
  await page.route("**/api/push/subscriptions", () => undefined);
  let confirm = await openSignOut(page);
  const started = Date.now();
  await confirmSignOut(page, confirm, 15_000);
  expect(Date.now() - started).toBeLessThan(12_000);
  expect(await browserSubscription(page)).toBeNull();
  expect(deviceRows(hung)).toBe("1");
  await page.unroute("**/api/push/subscriptions");

  // Refused: the request fails.
  await loginAsTestUser(page, me.email);
  const refused = `${PUSH_ENDPOINT}-refused-${stamp}`;
  await subscribeThisPhone(page, me.id, refused);
  await page.route("**/api/push/subscriptions", (route) => route.abort("failed"));
  confirm = await openSignOut(page);
  await confirmSignOut(page, confirm);
  expect(await browserSubscription(page)).toBeNull();
  await page.unroute("**/api/push/subscriptions");

  // The browser won't say (a SecurityError from its worker registry).
  await loginAsTestUser(page, me.email);
  await subscribeThisPhone(page, me.id, `${PUSH_ENDPOINT}-insecure-${stamp}`);
  await page.evaluate(() => window.localStorage.setItem("e2e-push:throw", "1"));
  confirm = await openSignOut(page);
  await confirmSignOut(page, confirm);
  await page.evaluate(() => window.localStorage.removeItem("e2e-push:throw"));

  // The login already gone (ended on another device): the account can't be told, the browser still drops it.
  await loginAsTestUser(page, me.email);
  const expired = `${PUSH_ENDPOINT}-expired-${stamp}`;
  await subscribeThisPhone(page, me.id, expired);
  confirm = await openSignOut(page);
  await revokeSessions(me.id, context);
  await confirmSignOut(page, confirm);
  expect(await browserSubscription(page)).toBeNull();
});
