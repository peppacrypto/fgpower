import { expect, test, type Locator, type Page } from "@playwright/test";
import { IPHONE, hasDb, loginAsTestUser, sql, userIdOf } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";
import { newUserOnGd1, programDayCard, uniqueEmail } from "./workout-helpers";

/**
 * "Ajustar à minha academia" (owner request, Oct 2026): a gym without a Hack.
 * The program flags the exercise ("Sem aparelho: Hack") and offers a review
 * that proposes a stand-in the gym can do; saving swaps it in the program
 * itself, for the coming weeks, and the flag goes. A template's dossier offers
 * the same review for a copy ("Adaptar à sua academia"). The gym is written
 * straight to the profile (Settings → Minha academia has its own spec).
 *
 * Relies on the curated gear map (lib/exercises/gear-map.generated): the Hack
 * squat needs the "hack-squat" apparatus, which nothing else in GD 1 needs.
 */

test.use(IPHONE);
test.describe.configure({ timeout: 120_000 });

const TERCA = "Terça — Inferior (quadríceps, pesado)";
const HACK = 'a[href="/app/exercises/hack-squat"]';

/** No Hack in this gym. */
function lackHack(userId: string) {
  sql(`UPDATE "Profile" SET "missingGear" = '{hack-squat}' WHERE "userId" = '${userId}'`);
}

/**
 * Picks another stand-in than the suggested one on a review row and returns its
 * name — retried, since a pick made before hydration is reset by it (the chip
 * only follows the select once hydrated).
 */
async function pickAnother(row: Locator): Promise<string> {
  const select = row.locator("select");
  const chosen = row.locator("[data-swap-chosen]");
  const suggested = (await chosen.innerText()).trim();
  const current = await select.inputValue();
  const values = await select.locator("option").evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
  const other = values.find((v) => v !== "keep" && v !== current);
  expect(other, "the review offers more than one stand-in").toBeDefined();
  await expect(async () => {
    await select.selectOption(other!);
    await expect(chosen).not.toHaveText(suggested, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  return (await chosen.innerText()).trim();
}

async function openProgram(page: Page, programId: string) {
  await page.goto(`/app/programs/${programId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
}

test("a program flags what the gym lacks and swaps it in place after a review", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  await newUserOnGd1(page, "gym-adjust");
  const userId = await userIdOf(page);
  const programId = sql(`SELECT id FROM "UserProgram" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`);
  const savedAt = () => Number(sql(`SELECT extract(epoch from "updatedAt") FROM "UserProgram" WHERE id = '${programId}'`));
  const before = savedAt();
  lackHack(userId);

  // The program: the Hack flagged on its day, and the notice with the way out.
  await openProgram(page, programId);
  const terca = programDayCard(page, TERCA);
  await expect(terca.locator(HACK)).toContainText("Sem aparelho: Hack");
  await expect(page.getByTestId("gear-flag")).toHaveCount(1);
  const panel = page.getByTestId("gym-adjust-panel");
  await expect(panel).toContainText("Sua academia não tem: Hack");
  await expect(panel).toContainText("1 exercício deste programa usa esse aparelho");
  await Promise.all([
    page.waitForURL(new RegExp(`/app/programs/${programId}/academia$`), { timeout: 30_000 }),
    panel.getByRole("link", { name: "Ajustar à minha academia" }).click(),
  ]);

  // The review: one swap, on Terça, with a stand-in the gym can do.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ajustar à minha academia");
  const day = page.locator("section").filter({ has: page.getByRole("heading", { name: TERCA, exact: true }) });
  const swap = day.getByTestId("gym-swap");
  await expect(page.getByTestId("gym-swap")).toHaveCount(1);
  await expect(swap.locator(".line-through")).toHaveText("Agachamento Hack");
  await expect(swap).toContainText("Sem aparelho: Hack");
  await expect(swap.locator("[data-swap-chosen]")).not.toHaveText("Agachamento Hack");
  // The rest of the day stays.
  await expect(day).toContainText("Mantidos (5)");
  const picked = await pickAnother(swap);

  await Promise.all([
    page.waitForURL(new RegExp(`/app/programs/${programId}\\?academia=1$`), { timeout: 30_000 }),
    page.getByRole("button", { name: "Salvar com 1 troca", exact: true }).click(),
  ]);
  await expect(page.getByRole("status").filter({ hasText: "Programa ajustado à sua academia: 1 exercício trocado." })).toBeVisible();
  await expect(terca).toContainText(picked);
  await expect(terca.locator(HACK)).toHaveCount(0);
  await expect(page.getByTestId("gear-flag")).toHaveCount(0);
  await expect(page.getByTestId("gym-adjust-panel")).toHaveCount(0);

  // In the program for good: the row holds the stand-in, its Hack cue is gone, and the program counts as saved.
  expect(
    sql(`SELECT x."namePt" || '|' || coalesce(e.notes, 'null') FROM "UserProgramExercise" e
      JOIN "UserProgramDay" d ON d.id = e."dayId" JOIN "Exercise" x ON x.id = e."exerciseId"
      WHERE d."programId" = '${programId}' AND d."dayIndex" = 1 AND e."sortOrder" = 0`),
  ).toBe(`${picked}|null`);
  expect(savedAt()).toBeGreaterThan(before);

  // Nothing left to adjust.
  await page.goto(`/app/programs/${programId}/academia`);
  await expect(page.getByText("Nada a ajustar")).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar ao programa" })).toHaveAttribute("href", `/app/programs/${programId}`);
});

test("a template's dossier flags what the gym lacks and adapts a copy after a review", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  await loginAsTestUser(page, uniqueEmail("gym-adapt"));
  await completeOnboarding(page);
  const userId = await userIdOf(page);
  lackHack(userId);

  await page.goto("/app/programs/templates/gd-1");
  await expect(page.getByTestId("gear-flag")).toHaveCount(1);
  await expect(page.getByTestId("gear-flag")).toHaveText("Sem aparelho: Hack");
  const panel = page.getByTestId("adapt-panel");
  await expect(panel).toContainText("Sua academia não tem: Hack");
  await Promise.all([
    page.waitForURL(/\/templates\/gd-1\/adapt$/, { timeout: 30_000 }),
    panel.getByRole("link", { name: "Adaptar à sua academia" }).click(),
  ]);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Adaptar à sua academia");
  const swaps = page.getByTestId("adapt-swap");
  await expect(swaps).toHaveCount(1);
  await expect(swaps).toContainText("Sem aparelho: Hack");
  await expect(swaps.locator("[data-swap-chosen]")).not.toHaveText("Agachamento Hack");

  // The suggested stand-in, as is (this review's form posts even before hydration).
  await Promise.all([
    page.waitForURL(/\/edit\?adaptado=1$/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Salvar com 1 troca", exact: true }).click(),
  ]);
  const copyId = page.url().match(/\/app\/programs\/([^/]+)\/edit/)![1];
  expect(sql(`SELECT name FROM "UserProgram" WHERE id = '${copyId}'`)).toBe("GD 1 (adaptado)");
  expect(
    sql(`SELECT count(*) FROM "UserProgramExercise" e JOIN "UserProgramDay" d ON d.id = e."dayId" JOIN "Exercise" x ON x.id = e."exerciseId"
      WHERE d."programId" = '${copyId}' AND x.slug = 'hack-squat'`),
  ).toBe("0");
});
