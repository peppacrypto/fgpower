import { execSync } from "node:child_process";
import { devices, expect, test, type Page } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";
import { finishAndSave, recordSet, sessionIdFromUrl, todayDayRow, uniqueEmail, waitForWorkoutScreen } from "./workout-helpers";

/**
 * The summary's "Próximo treino" is a promise about Today: on the suggested
 * date, Today's hero offers that same day. A weekend finisher is the case that
 * broke it (Sessão B promised for Monday, Sessão A shown there), so the check
 * doesn't depend on the weekday the suite runs: when the suggested date is in
 * a later week, the workout is moved back a week — Today then sees the new
 * week's state, as it will on that Monday. For a plan that isn't laid out by
 * weekday, Today also offers the promised day right away, back from the
 * summary (a weekday plan's Monday day waits for Monday).
 */

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium", timezoneId: "America/Sao_Paulo", locale: "pt-BR" });

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

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DAY_MS = 86_400_000;

/** Today's São Paulo calendar day as days since 1970-01-01. */
function spToday(): number {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).split("-");
  return Math.floor(Date.UTC(Number(y), Number(m) - 1, Number(d)) / DAY_MS);
}
/** Monday-start week of a day number. */
const weekOf = (dayNo: number) => Math.floor((dayNo + 3) / 7);

/** The summary's suggested date ("hoje", "amanhã, dom 27 set", "seg 28 set") as a day number. */
function suggestedDayNo(text: string, today: number): number {
  if (/hoje/.test(text)) return today;
  const m = text.match(/(\d{2}) ([a-z]{3})/);
  if (!m) throw new Error(`No date in "${text}"`);
  const year = new Date(today * DAY_MS).getUTCFullYear();
  const at = (y: number) => Math.floor(Date.UTC(y, MONTHS.indexOf(m[2]), Number(m[1])) / DAY_MS);
  return at(year) < today ? at(year + 1) : at(year);
}

/** Today's hero day ("Próximo treino" → its heading). */
function todayHero(page: Page) {
  return page.locator(".panel-raised").filter({ hasText: "Próximo treino" }).first().getByRole("heading", { level: 2 });
}

async function finishFirstDay(page: Page, label: string, template: string, firstDay: string) {
  await loginAsTestUser(page, uniqueEmail(label));
  await completeOnboarding(page);
  await page.goto(`/app/programs/templates/${template}`);
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Ativar programa" }).first().click(),
  ]);
  const row = todayDayRow(page, firstDay);
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    row.getByRole("button", { name: "Iniciar" }).click(),
  ]);
  await waitForWorkoutScreen(page);
  const sessionId = sessionIdFromUrl(page.url());
  await recordSet(page, 1, "40", "8");
  await finishAndSave(page);
  return sessionId;
}

for (const plan of [
  // 3 days at 3×/week, not laid out by weekday: the rotation carries over (B after a Saturday A).
  { template: "fgpower-adaptation", firstDay: "Sessão A", label: "a Sessão A/B/C plan", offeredNow: true },
  // 2 days at 3×/week: the A/B rotation carries over.
  { template: "linear-5x5", firstDay: "Treino A", label: "a rotating A/B plan", offeredNow: true },
  // Named by weekday (Segunda…Sexta): each week starts over from Segunda.
  { template: "gd-1", firstDay: "Segunda — Superior (pesado)", label: "a plan laid out by weekday", offeredNow: false },
]) {
  test(`${plan.label}: the next workout the summary promises is the one Today offers on that date`, async ({ page }) => {
    test.skip(!hasDb, "needs the local dev database");
    test.setTimeout(120_000);
    const sessionId = await finishFirstDay(page, `summary-next-${plan.template}`, plan.template, plan.firstDay);

    const next = page.locator("section").filter({ hasText: /Próximo treino/ });
    const promised = (await next.getByRole("heading", { level: 2 }).textContent())?.trim() ?? "";
    const when = (await next.locator("p").filter({ hasText: /^Próximo treino/ }).textContent()) ?? "";
    expect(promised).not.toBe("");
    const today = spToday();
    const date = suggestedDayNo(when, today);
    expect(date).toBeGreaterThanOrEqual(today);

    if (plan.offeredNow) {
      // Back from the summary right away: the same day.
      await Promise.all([
        page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
        next.getByRole("link", { name: "Ir para Hoje" }).click(),
      ]);
      await expect(todayHero(page)).toHaveText(promised);
    }

    if (weekOf(date) > weekOf(today)) {
      // Monday's view: nothing done yet in the new week, the program pointer as it is now.
      sql(
        `UPDATE "WorkoutSession" SET "startedAt" = "startedAt" - interval '7 days', "finishedAt" = "finishedAt" - interval '7 days' WHERE id = '${sessionId}'`,
      );
    }
    await page.goto("/app/today");
    await expect(todayHero(page)).toHaveText(promised);
  });
}

test("the share row fits a 320px phone: the label goes above the options", async ({ page }) => {
  test.setTimeout(120_000);
  await finishFirstDay(page, "summary-share-320", "fgpower-adaptation", "Sessão A");
  const label = page.getByText("Quem vê", { exact: true });
  const group = page.getByRole("radiogroup", { name: "Quem vê" });

  // The label goes beside the options from a 21rem row (a 368px viewport) up.
  for (const width of [320, 360, 367, 368, 390, 414]) {
    await page.setViewportSize({ width, height: 800 });
    for (const option of ["Seguidores", "Público", "Privado"]) {
      await page.getByRole("radio", { name: option }).click();
      // Every option's text fits its segment with room to spare (the checked one is semibold).
      const tight = await page.getByRole("radio").evaluateAll((els) =>
        els.flatMap((e) => {
          const range = document.createRange();
          range.selectNodeContents(e);
          const text = range.getBoundingClientRect().width;
          const cs = getComputedStyle(e);
          const room = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          return room - text < 3 ? [`${e.textContent} ${text.toFixed(1)}/${room.toFixed(1)}`] : [];
        }),
      );
      expect(tight, `${width}px, ${option} checked`).toEqual([]);
    }
    const l = (await label.boundingBox())!;
    const g = (await group.boundingBox())!;
    if (width < 368) expect(l.y + l.height, `${width}px stacked`).toBeLessThanOrEqual(g.y);
    else expect(l.y, `${width}px beside`).toBeGreaterThan(g.y); // centred on the row
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }
});
