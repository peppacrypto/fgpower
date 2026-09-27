import { devices, expect, test, type Page } from "@playwright/test";
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
 * the next workout, and the compact share row.
 */

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium", timezoneId: "America/Sao_Paulo", locale: "pt-BR" });

const EXERCISE = "Puxada Alta Unilateral no Pulley";

/** Nothing on the page is wider than the phone. */
async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
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

  // Masthead: saved, numbered, dated, program week.
  await expect(page.getByText("Salvo no histórico ✓")).toBeVisible();
  await expect(page.getByText(/^Treino nº 1 · (dom|seg|ter|qua|qui|sex|sáb) \d{2} [a-z]{3} · Semana 1\/13$/)).toBeVisible();
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
  await expect(page.getByText(/^Esta semana$/)).toBeVisible();
  await expect(page.getByText(/^Próximo treino/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ir para Hoje" }).or(page.getByRole("button", { name: "Iniciar treino" })),
  ).toBeVisible();

  // Share row: private needs no button; the others say what they do; then a confirmation with links.
  await expect(page.getByText("Só você vê este treino.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Publicar|Salvar/ })).toHaveCount(0);
  await page.getByRole("radio", { name: "Seguidores" }).click();
  await page.getByRole("button", { name: "Publicar para seguidores" }).click();
  await expect(page.getByText("Publicado", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Ver no feed" })).toHaveAttribute("href", "/app/feed");
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();
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

  await expect(page.getByText(/^Treino nº 2 · /)).toBeVisible();
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
  await expect(page.getByText(/^Treino nº 1 · /)).toBeVisible();
  await expect(page.getByText("Na próxima")).toHaveCount(0);
  await expect(page.getByText(/^Próximo treino/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver histórico" })).toBeVisible();
  // It was published: the row opens on its confirmation — and can be taken back.
  await expect(page.getByText("Publicado", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Privado" }).click();
  await page.getByRole("button", { name: "Tornar privado" }).click();
  await expect(page.getByText("Só você vê este treino.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Tornar privado" })).toHaveCount(0);
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

  // The visibility radios: one tab stop, arrows move and select.
  const privado = page.getByRole("radio", { name: "Privado" });
  const seguidores = page.getByRole("radio", { name: "Seguidores" });
  await expect(privado).toHaveAttribute("tabindex", "0");
  await expect(seguidores).toHaveAttribute("tabindex", "-1");
  await privado.focus();
  await page.keyboard.press("ArrowRight");
  await expect(seguidores).toHaveAttribute("aria-checked", "true");
  await expect(seguidores).toBeFocused();
  await expect(page.getByRole("button", { name: "Publicar para seguidores" })).toBeVisible();

  // Published with the loads hidden: the feed's page data carries record names, never values.
  const loads = page.getByRole("checkbox", { name: "Mostrar cargas" });
  if (await loads.isChecked()) await loads.uncheck();
  await page.getByRole("button", { name: "Publicar para seguidores" }).click();
  await expect(page.getByText("Publicado", { exact: true })).toBeVisible({ timeout: 15_000 });
  const feed = await (await page.request.get("/app/feed")).text();
  expect(feed).toContain(EXERCISE);
  expect(feed).toMatch(/prNames/);
  expect(feed).not.toMatch(/\\?"prs\\?"/);
  await page.goto("/app/feed");
  await expect(page.getByText(EXERCISE).first()).toBeVisible();
});
