import { devices, expect, test } from "@playwright/test";
import { hasDb } from "./fixtures";
import { expectSetSaved, finishAndSave, newUserOnTemplate, startDayFromToday } from "./workout-helpers";

/*
 * The home programs (body weight only): they have their own shelf, every
 * exercise shows its own figure large where it is trained, the figure respects
 * "less motion", and with no load to raise "Na próxima" points along the ladder.
 */

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium", timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 120_000 });

const MONDAY = "Segunda — Superior";

test.beforeEach(() => {
  test.skip(!hasDb, "needs the local dev database");
});

test("the library has an 'Em casa' shelf with the home programs", async ({ page }) => {
  await page.goto("/programs");
  await page.getByRole("group", { name: "Categorias" }).getByRole("button", { name: /^Em casa/ }).click();
  for (const slug of ["casa-comecar", "casa-corpo-inteiro-3x", "casa-superior-inferior-4x", "casa-5x"]) {
    await expect(page.locator(`a[href="/programs/${slug}"]`).first()).toBeVisible();
  }
  await expect(page.locator('a[href="/programs/gd-1"]')).toHaveCount(0);
});

test("a home workout shows the figure large, in the sheet too, and logs reps with no load", async ({ page }) => {
  await newUserOnTemplate(page, "home-figure", "casa-5x");
  await startDayFromToday(page, MONDAY);

  // The figure is a muted looping video (the older renders are animated images): whichever it is, it is shown large.
  const onScreen = page.locator("[data-workout-demo] :is(video, img):visible").first();
  await expect(onScreen).toBeVisible();
  await expect(onScreen).toHaveAttribute("src", /\/exercises\/[^/]+\/(f2-(loop\.mp4|start\.webp)|fig-(loop|start)\.webp)$/);
  const box = await onScreen.boundingBox();
  // Readable on a phone: nothing like the 48 px thumbnail.
  expect(box!.height).toBeGreaterThan(140);
  expect(box!.width).toBeGreaterThan(200);

  // Tapping the figure opens the technique sheet, which shows it too (never a square crop of a frame).
  await page.locator("[data-workout-demo]").click();
  const sheet = page.locator("[data-technique-sheet]");
  await expect(sheet.locator("[data-exercise-demo] :is(video, img):visible").first()).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "Voltar ao treino" }).click();

  // No load to type: ✓ needs only the reps.
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  await expectSetSaved(page, "Série 1");
  await expect(page.getByText("Digite a carga (kg) que você usou.")).toHaveCount(0);
});

test("with no load to raise, 'Na próxima' asks for reps and names the next variation", async ({ page }) => {
  await newUserOnTemplate(page, "home-next", "casa-5x");
  await startDayFromToday(page, MONDAY);
  for (const n of [1, 2]) {
    await page.getByLabel(`Série ${n} — repetições`, { exact: true }).fill("10");
    await page.getByRole("button", { name: `Concluir série ${n}`, exact: true }).click();
    await expectSetSaved(page, `Série ${n}`);
  }
  await finishAndSave(page);
  const main = page.locator("main");
  await expect(main).toContainText(/Busque \d+ reps|Faça as \d+ séries/);
  await expect(main).not.toContainText("0 kg");
});

test("someone who asks for less motion gets a still instead of the video", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/exercises/pushups");
  const still = page.locator("[data-exercise-demo] img:visible").first();
  await expect(still).toBeVisible();
  await expect.poll(() => still.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/f2-(start|end)\.webp$/);
  await expect(page.locator("[data-exercise-demo] video:visible")).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  const video = page.locator("[data-exercise-demo] video:visible").first();
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(/f2-loop\.mp4$/);
  // What lets a phone play it by itself, in place, without sound.
  await expect(video).toHaveAttribute("loop", "");
  await expect(video).toHaveAttribute("playsinline", "");
});

test("a static hold shows one picture, not an empty second frame", async ({ page }) => {
  await page.goto("/exercises/wall-lateral-press-hold");
  await expect(page.locator("[data-exercise-demo] img").first()).toHaveAttribute("src", /(fig|f2)-start\.webp$/);
  await expect(page.getByText("Fim", { exact: true })).toHaveCount(0);
});
