import { devices, expect, test, type Page } from "@playwright/test";
import { sql, sqlText, userIdOf } from "./fixtures";
import {
  QUINTA,
  finishAndSave,
  newUserOnGd1,
  recordSet,
  sessionIdFromUrl,
  startDayFromToday,
  todayDayRow,
  waitForWorkoutScreen,
} from "./workout-helpers";

/**
 * The workout summary as a "dossiê do treino": saved confirmation, dated
 * masthead, the baseline instead of a flood of first-time "records", real
 * records one card per exercise, vs. last time and "Na próxima" per exercise,
 * the next workout, and the compact share row — which opens published: new
 * accounts publish finished workouts to their followers, loads hidden
 * (decision 10).
 */

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium", timezoneId: "America/Sao_Paulo", locale: "pt-BR" });

const EXERCISE = "Puxada Alta Unilateral no Pulley";
/** GD 1's Tuesday: its 4th and 5th exercises are Superset A (Face Pull, then the calf raise). */
const TERCA = "Terça — Inferior (quadríceps, pesado)";
const FACE_PULL = "Puxada para o Rosto (Face Pull)";
const CALF = "Elevação de Panturrilha em Pé";

/** Nothing on the page is wider than the phone. */
async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * A server re-render of the page on screen, as better-auth's cookie-cache
 * rewrite causes inside any action run 5+ minutes after the last one (R5):
 * what the screen confirmed must survive it.
 */
async function forceServerRerender(page: Page) {
  await Promise.all([
    page.waitForResponse((r) => r.request().headers()["rsc"] === "1" && r.url().includes(new URL(page.url()).pathname)),
    page.evaluate(() => (window as unknown as { next: { router: { refresh(): void } } }).next.router.refresh()),
  ]);
}

/** Opens the day again from Today ("Refazer" → confirm) and returns the new session id. */
async function redoFromToday(page: Page, dayName: string) {
  await page.goto("/app/today");
  const row = todayDayRow(page, dayName);
  await row.getByRole("button", { name: "Refazer" }).click();
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    row.getByRole("button", { name: "Sim, treinar de novo" }).click(),
  ]);
  await waitForWorkoutScreen(page);
  return sessionIdFromUrl(page.url());
}

test("first workout: saved and dated, one baseline line instead of records, next workout, then real records", async ({
  page,
}) => {
  // Two full workouts plus the feed: longer than one default test.
  test.setTimeout(150_000);
  await newUserOnGd1(page, "summary");
  const first = await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  await recordSet(page, 2, "40", "10");
  await recordSet(page, 3, "40", "9");
  await finishAndSave(page);

  // Masthead: saved, dated, numbered, program week.
  await expect(page.getByText("Salvo no histórico ✓")).toBeVisible();
  await expect(page.getByText(/^Treino concluído · (dom|seg|ter|qua|qui|sex|sáb) \d{2} [a-z]{3}$/)).toBeVisible();
  // A program started Thursday–Sunday is in its entry week, which isn't one of its 13.
  await expect(page.getByText(/^Treino nº 1 · (Semana 1\/13|Semana de entrada)$/)).toBeVisible();
  // The tab says which workout this is (W-172).
  await expect(page).toHaveTitle(/^Resumo · Quinta — Puxar \(moderado\) · FGPOWER$/);
  await expect(page.getByText(/3 séries de trabalho/)).toBeVisible();
  await expect(page.getByText("Primeira sessão registrada. Na próxima, sugerimos suas cargas.")).toBeVisible();
  await expectNoSideScroll(page);

  // The baseline, not a wall of "records".
  await expect(page.getByText("Marca inicial · 1 exercício registrado")).toBeVisible();
  await expect(page.locator(".tag--mark", { hasText: "PR" })).toHaveCount(0);
  const card = page.locator(".reg-frame").filter({ hasText: EXERCISE });
  await expect(card.getByText("1ª vez · marca inicial")).toBeVisible();
  // What to aim for next time, from these sets (8–12 reps: add reps before load).
  await expect(card.getByText("Na próxima")).toBeVisible();
  await expect(card.getByText(/^Mantenha 40\s?kg · busque 10 reps$/)).toBeVisible();

  // The week and the next workout, with a strong way into it.
  // (A program started Thursday–Sunday is in its short entry week.)
  await expect(page.getByText(/^(Esta semana|Semana concluída ✓|Semana de entrada( ✓)?)$/)).toBeVisible();
  await expect(page.getByText(/^Próximo treino/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ir para Hoje" }).or(page.getByRole("button", { name: "Iniciar treino" })),
  ).toBeVisible();

  // Share row: already published to followers on finish, without a tap; a new account has none yet.
  await expect(page.getByRole("radio", { name: "Seguidores" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Publicado", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Publicar|Salvar/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver no feed" })).toHaveAttribute("href", "/app/feed");
  await expect(page.getByText("Você ainda não tem seguidores — no feed, por enquanto, só você vê.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Mostrar kg e reps" })).not.toBeChecked();
  // Out of the app: the story image and a link that opens without an account.
  await expect(page.getByRole("button", { name: /^(Compartilhar|Baixar) imagem$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();
  await expect(page.getByText("Uma imagem para o story e um link que abre sem login. Cargas ficam ocultas.")).toBeVisible();
  // Privado says what taking it back does, with its own button.
  await page.getByRole("radio", { name: "Privado" }).click();
  await expect(page.getByText("Publicado para seguidores. Tornar privado tira do feed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tornar privado" })).toBeVisible();
  // Changing a choice turns the confirmation back into an explicit "Atualizar".
  await page.getByRole("radio", { name: "Público" }).click();
  await expect(page.getByRole("button", { name: "Atualizar" })).toBeVisible();
  await page.getByRole("radio", { name: "Seguidores" }).click();
  await expect(page.getByText("Publicado", { exact: true })).toBeVisible();

  // The feed card carries no record badges for a baseline workout.
  await page.goto("/app/feed");
  await expect(page.getByText(QUINTA).first()).toBeVisible();
  await expect(page.getByText("3 séries de trabalho").first()).toBeVisible();

  // Second time: heavier top set and more reps at the old load — real records, one card, workout order.
  const second = await redoFromToday(page, QUINTA);
  expect(second).not.toBe(first);
  await recordSet(page, 1, "42,5", "10");
  await recordSet(page, 2, "40", "12");
  await recordSet(page, 3, "40", "12");
  await finishAndSave(page);

  await expect(page.getByText(/^Treino nº 2\b/)).toBeVisible();
  await expect(page.getByText("Primeira sessão registrada", { exact: false })).toHaveCount(0);
  await expect(page.getByText(/^Marca inicial/)).toHaveCount(0);
  const records = page.getByRole("link").filter({ hasText: EXERCISE });
  await expect(records).toHaveCount(1);
  await expect(records).toHaveAttribute("href", /\/app\/exercises\/[^/]+\/history$/);
  await expect(records).toContainText(/carga 42,5\s?kg · 1RM est\. 56,7\s?kg · 12 reps com 40\s?kg/);
  const card2 = page.locator(".reg-frame").filter({ hasText: EXERCISE });
  await expect(card2.getByText(/^↑ carga \+2,5\s?kg$/)).toBeVisible();
  await expect(card2.getByText(/40\s?kg × 10, 10, 9$/)).toBeVisible();
  await expectNoSideScroll(page);

  // Opened later from the history, the first workout is a dated record: no "what's next".
  await page.goto(`/app/workout/${first}/summary`);
  await expect(page.getByText(/^Treino nº 1\b/)).toBeVisible();
  await expect(page.getByText("Na próxima")).toHaveCount(0);
  await expect(page.getByText(/^Próximo treino/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver histórico" })).toBeVisible();
  // It was published: the row opens on its confirmation — and can be taken back.
  await expect(page.getByText("Publicado", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Privado" }).click();
  await page.getByRole("button", { name: "Tornar privado" }).click();
  await expect(page.getByText("Só você vê este treino.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Tornar privado" })).toHaveCount(0);
  // The tapped button is gone: focus lands on the choice that holds now, not on the page.
  await expect(page.getByRole("radio", { name: "Privado" })).toBeFocused();
  // …and the answer holds through a server re-render (R5).
  await forceServerRerender(page);
  await expect(page.getByText("Só você vê este treino.")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Privado" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("status").filter({ hasText: "Salvo como privado." })).toHaveCount(1);
});

test("a deload workout's summary says it's light on purpose: '· deload', no decline, 'Mantenha as cargas' (W-128)", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await newUserOnGd1(page, "summary-deload");
  const userId = await userIdOf(page);
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  await recordSet(page, 2, "40", "10");
  await finishAndSave(page);

  // "Aplicar deload" for this week, as Today's fatigue card writes it (this São Paulo week's Monday):
  // the next workout opens as a deload one.
  sql(`UPDATE "ProgramEnrollment"
          SET "deloadMondays" = ARRAY[(date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date - DATE '1970-01-01')]
        WHERE "userId" = ${sqlText(userId)} AND status = 'ACTIVE'`);
  const deload = await redoFromToday(page, QUINTA);
  // Lighter on purpose.
  await recordSet(page, 1, "30", "10");
  await finishAndSave(page);
  expect(sql(`SELECT "isDeload"::text FROM "WorkoutSession" WHERE id = ${sqlText(deload)}`)).toBe("true");

  await expect(page.getByText(/^Treino nº 2( · [^·]+)? · deload$/)).toBeVisible();
  const card = page.locator(".reg-frame").filter({ hasText: EXERCISE });
  // Vs. last time: never a decline — the drop is the point.
  await expect(card.getByText("deload · leve de propósito")).toBeVisible();
  await expect(card.getByText(/↓/)).toHaveCount(0);
  // Na próxima: nothing to raise; the next suggestion starts from the workout before this week.
  await expect(card.getByText("Mantenha as cargas", { exact: true })).toBeVisible();
  await expect(card.getByText("Semana de deload: a próxima sugestão parte do seu último treino antes dela.")).toBeVisible();
  await expect(card.getByText(/Suba para|busque/)).toHaveCount(0);
  await expectNoSideScroll(page);
});

test("a superset reads as one on the summary: its rule on the first card, 'A1'/'A2' on each (W-104)", async ({ page }) => {
  test.setTimeout(150_000);
  await newUserOnGd1(page, "summary-superset");
  const sessionId = await startDayFromToday(page, TERCA);
  await page.getByRole("button", { name: /ver todos/ }).click();
  await page.getByRole("button", { name: new RegExp(FACE_PULL.replace(/[()]/g, "\\$&")) }).first().click();
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(`A1 · ${FACE_PULL}`);
  // ✓ on A1: the screen moves to its partner by itself.
  await page.getByLabel("Série 1 — kg", { exact: true }).fill("20");
  await page.getByLabel("Série 1 — repetições", { exact: true }).fill("15");
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  await expect(heading).toHaveText(`A2 · ${CALF}`, { timeout: 10_000 });
  await recordSet(page, 1, "40", "12");
  await expect
    .poll(() =>
      sql(`SELECT count(*) FROM "SetLog" WHERE "sessionId" = ${sqlText(sessionId)} AND "isCompleted" AND "setType" <> 'WARMUP'`),
    )
    .toBe("2");
  await finishAndSave(page);

  // Only the two done: the pair, in its order, marked as the builder and the workout mark it.
  const cards = page.locator("[data-group]");
  await expect(cards).toHaveCount(2);
  const first = page.locator('[data-group="A1"]');
  const second = page.locator('[data-group="A2"]');
  await expect(first).toContainText(FACE_PULL);
  await expect(first).toContainText("Superset A · alterne as séries");
  await expect(first.getByText("A1", { exact: true })).toBeVisible();
  await expect(second).toContainText(CALF);
  await expect(second.getByText("A2", { exact: true })).toBeVisible();
  // The rule once, on the group's first card.
  await expect(second).not.toContainText("alterne as séries");
  await expectNoSideScroll(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(first).toContainText("Superset A · alterne as séries");
  await expectNoSideScroll(page);
});

test("an unfinished workout's summary URL goes back to the workout", async ({ page }) => {
  test.setTimeout(90_000);
  await newUserOnGd1(page, "summary-open");
  const sessionId = await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  await page.goto(`/app/workout/${sessionId}/summary`);
  await page.waitForURL(`**/app/workout/${sessionId}`, { timeout: 30_000 });
  await expect(page.getByText("Salvo no histórico ✓")).toHaveCount(0);
});

test("fewer sets than prescribed: no load increase, no false decline; share radios work by keyboard; the feed gets names only", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await newUserOnGd1(page, "summary-partial");
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  await recordSet(page, 2, "40", "10");
  await recordSet(page, 3, "40", "10");
  await finishAndSave(page);

  // Only 1 of the 3 prescribed sets, at the top of the range (8–12).
  await redoFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "12");
  await finishAndSave(page);

  const card = page.locator(".reg-frame").filter({ hasText: EXERCISE });
  // A rep record on that set — and vs. last time agrees with it, saying the missing sets as such.
  await expect(page.getByRole("link").filter({ hasText: EXERCISE })).toContainText(/12 reps com 40\s?kg/);
  const vsLast = card.locator("dd").first();
  await expect(vsLast).toContainText(/↑ reps \+2 · 1 de 3 séries/);
  await expect(vsLast).not.toContainText("↓");
  // Same advice as the workout screen will give: all the sets before more load.
  await expect(card.getByText(/^Mantenha 40\s?kg · faça as 3 séries$/)).toBeVisible();
  await expect(card.getByText(/Suba para/)).toHaveCount(0);
  await expectNoSideScroll(page);

  // The visibility radios: one tab stop (the checked one — published to followers), arrows move and select.
  const privado = page.getByRole("radio", { name: "Privado" });
  const seguidores = page.getByRole("radio", { name: "Seguidores" });
  await expect(seguidores).toHaveAttribute("tabindex", "0");
  await expect(privado).toHaveAttribute("tabindex", "-1");
  await seguidores.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(privado).toHaveAttribute("aria-checked", "true");
  await expect(privado).toBeFocused();
  await expect(page.getByRole("button", { name: "Tornar privado" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(seguidores).toHaveAttribute("aria-checked", "true");

  // Published with the loads hidden: the feed's page data carries record names, never values.
  await expect(page.getByRole("checkbox", { name: "Mostrar kg e reps" })).not.toBeChecked();
  await expect(page.getByText("Publicado", { exact: true })).toBeVisible();
  const feed = await (await page.request.get("/app/feed")).text();
  expect(feed).toContain(EXERCISE);
  expect(feed).toMatch(/prNames/);
  expect(feed).not.toMatch(/\\?"prs\\?"/);
  await page.goto("/app/feed");
  await expect(page.getByText(EXERCISE).first()).toBeVisible();
});
