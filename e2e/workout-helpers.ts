import { expect, type Locator, type Page, type Response } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";

/** GD 1's Thursday — the day from the original bug report. */
export const QUINTA = "Quinta — Puxar (moderado)";
export const SEGUNDA = "Segunda — Superior (pesado)";

/** A fresh, unique account per test so no state leaks between tests. */
export function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@fgpower.dev`;
}

/** Logs a brand-new user in, onboards them and activates the GD 1 template. */
export async function newUserOnGd1(page: Page, label: string) {
  await newUserOnTemplate(page, label, "gd-1");
}

/** Logs a brand-new user in, onboards them and activates a template ("calisthenics": bodyweight only). */
export async function newUserOnTemplate(page: Page, label: string, slug: string) {
  await loginAsTestUser(page, uniqueEmail(label));
  await completeOnboarding(page);
  await page.goto(`/app/programs/templates/${slug}`);
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    // "Ativar programa" appears in both the masthead and the sticky start bar.
    page.getByRole("button", { name: "Ativar programa" }).first().click(),
  ]);
}

/** A program-day row (Today's "Treinos do programa" list). */
export function todayDayRow(page: Page, dayName: string): Locator {
  return page.locator(".reg-frame").filter({ has: page.getByText(dayName, { exact: true }) }).first();
}

/** A day card on the user's program page. */
export function programDayCard(page: Page, dayName: string): Locator {
  return page.locator(".reg-frame").filter({ has: page.getByRole("heading", { name: dayName, exact: true }) }).first();
}

export function sessionIdFromUrl(url: string) {
  const m = new URL(url).pathname.match(/^\/app\/workout\/([^/]+)/);
  if (!m) throw new Error(`Not a workout URL: ${url}`);
  return m[1];
}

/** Waits for the workout screen (set table) to be interactive. */
export async function waitForWorkoutScreen(page: Page) {
  await page.waitForURL(/\/app\/workout\/[^/?]+(\?.*)?$/, { timeout: 30_000 });
  await expect(page.getByText(/Séries do treino/).first()).toBeVisible({ timeout: 30_000 });
}

/** Starts a day from Today's day list and returns the session id. */
export async function startDayFromToday(page: Page, dayName: string) {
  await page.goto("/app/today");
  const row = todayDayRow(page, dayName);
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    row.getByRole("button", { name: "Iniciar" }).click(),
  ]);
  await waitForWorkoutScreen(page);
  return sessionIdFromUrl(page.url());
}

/** Opens the user's (single) program page from the programs index. */
export async function gotoMyProgram(page: Page, programName = "GD 1") {
  await page.goto("/app/programs");
  const link = page
    .locator('a[href^="/app/programs/"]:not([href^="/app/programs/templates"]):not([href="/app/programs/new"])')
    .filter({ hasText: programName })
    .first();
  await Promise.all([page.waitForURL(/\/app\/programs\/(?!templates|new)[^/]+$/, { timeout: 30_000 }), link.click()]);
  await expect(page.getByRole("heading", { level: 1, name: programName })).toBeVisible();
}

/** Prescribed-set boxes ("Série N — kg"); excludes warm-ups and extras. */
export function prescribedKgBoxes(page: Page) {
  return page.getByRole("textbox", { name: /^Série \d+ — kg$/ });
}
export function warmupKgBoxes(page: Page) {
  return page.getByRole("textbox", { name: /^Aquecimento \d+ — kg$/ });
}
export function extraKgBoxes(page: Page) {
  return page.getByRole("textbox", { name: /^Série extra \d+ — kg$/ });
}

/** Prescribed set count as printed in the exercise header ("3 séries × 8–12 reps"). */
export async function headerPrescribedCount(page: Page) {
  const text = await page.getByText(/\d+ séries? ×/).first().innerText();
  const m = text.match(/(\d+) séries? ×/);
  if (!m) throw new Error(`No prescribed count in header: ${text}`);
  return Number(m[1]);
}

/** Fills one prescribed row and taps its ✓, waiting until the server confirms. */
export async function recordSet(page: Page, n: number, kg: string, reps: string) {
  await page.getByLabel(`Série ${n} — kg`, { exact: true }).fill(kg);
  await page.getByLabel(`Série ${n} — repetições`, { exact: true }).fill(reps);
  await page.getByRole("button", { name: `Concluir série ${n}`, exact: true }).click();
  await expectSetSaved(page, `Série ${n}`);
}

/**
 * The ✓ shows (and the rest starts) on the tap; the row's `data-sync` stays
 * set until the server has confirmed it ("sending", or "pending" after a
 * failed try that will be resent).
 */
export async function expectSetSaved(page: Page, name: string) {
  const done = page.getByRole("button", { name: `${name} feita — toque para desfazer`, exact: true });
  await expect(done).toBeVisible({ timeout: 15_000 });
  await expect(done).not.toHaveAttribute("data-sync", /.+/, { timeout: 15_000 });
}

/** A POST of the workout screen's set outbox (✓, un-✓ and typed values go through it). */
export function isSetSync(r: Response) {
  return r.request().method() === "POST" && r.url().includes("/api/workout/sets") && r.ok();
}

/**
 * A set as the app prints it ("42,5 kg × 10"): a regular or non-breaking
 * space (or none, on older screens) between the number and "kg".
 */
export function setText(kg: string, reps: number | string, prefix = "") {
  return new RegExp(`^${prefix}${kg.replace(/[.]/g, "\\.")}\\s?kg\\s×\\s${reps}$`);
}

/** Opens the warm-up rows (they start folded into one line: optional). */
export async function openWarmups(page: Page) {
  const toggle = page.getByRole("button", { name: "Registrar aquecimento" });
  if (await toggle.isVisible()) await toggle.click();
  await expect(page.getByRole("textbox", { name: "Aquecimento 1 — kg", exact: true })).toBeVisible();
}

/** Header "Finalizar" → the finish sheet dialog. */
export async function openFinishSheet(page: Page) {
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Finish sheet → "Finalizar e salvar" → summary. Returns the summary URL. */
export async function finishAndSave(page: Page) {
  const dialog = await openFinishSheet(page);
  await expect(dialog.getByRole("heading", { name: "Finalizar e salvar?" })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/workout\/[^/]+\/summary/, { timeout: 30_000 }),
    dialog.getByRole("button", { name: "Finalizar e salvar" }).click(),
  ]);
  await expect(page.getByText("Treino concluído")).toBeVisible({ timeout: 15_000 });
  return page.url();
}
