import { test, expect, devices } from "@playwright/test";
import {
  QUINTA,
  finishAndSave,
  newUserOnGd1,
  openFinishSheet,
  recordSet,
  startDayFromToday,
  todayDayRow,
  waitForWorkoutScreen,
} from "./workout-helpers";

// Phone-sized, like the user's device.
test.use({ viewport: devices["iPhone 13"].viewport, isMobile: true, hasTouch: true });
test.setTimeout(120_000);

test("a correction made on another device is not overwritten by a stale screen", async ({ page, browser }) => {
  await newUserOnGd1(page, "safety-2dev");
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  const url = page.url();

  // Second device, same account, same workout: corrects set 1 to 50 kg.
  const other = await browser.newContext({ storageState: await page.context().storageState(), ...devices["iPhone 13"] });
  const phone2 = await other.newPage();
  await phone2.goto(url);
  await waitForWorkoutScreen(phone2);
  const kg2 = phone2.getByLabel("Série 1 — kg", { exact: true });
  await kg2.fill("50");
  // Leaving the box autosaves it (a server action POST).
  await Promise.all([
    phone2.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/app/workout/"), {
      timeout: 15_000,
    }),
    phone2.getByLabel("Série 1 — repetições", { exact: true }).click(),
  ]);
  await other.close();

  // The first phone (still showing 40) finishes: the 50 must survive.
  await finishAndSave(page);
  await expect(page.getByText("50kg × 10", { exact: true })).toBeVisible();
  await expect(page.getByText("40kg × 10", { exact: true })).toHaveCount(0);
});

test("an incomplete row is reported at finish and 'Revisar' takes you to its empty box", async ({ page }) => {
  await newUserOnGd1(page, "safety-incomplete");
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  await page.getByLabel("Série 2 — kg", { exact: true }).fill("42,5");
  await page.getByLabel("Série 3 — kg", { exact: true }).click();

  const dialog = await openFinishSheet(page);
  await expect(dialog.getByText("1 série está incompleta")).toBeVisible();
  await dialog.getByRole("button", { name: "Revisar" }).click();
  await expect(dialog).toBeHidden();
  const reps2 = page.getByLabel("Série 2 — repetições", { exact: true });
  await expect(reps2).toBeFocused();
  await expect(reps2).toBeInViewport();

  await reps2.fill("9");
  await finishAndSave(page);
  await expect(page.getByText("2 séries de trabalho")).toBeVisible();
});

test("editing the active program keeps the day that was trained marked as done", async ({ page }) => {
  await newUserOnGd1(page, "safety-edit");
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  await finishAndSave(page);

  // Move Quinta up one position in the builder and save.
  await page.goto("/app/programs");
  await page.getByRole("link", { name: /GD 1/ }).first().click();
  await page.getByRole("link", { name: "Editar" }).click();
  await page.getByRole("button", { name: /Quinta/ }).first().click();
  await page.getByRole("button", { name: "Mover dia para cima" }).click();
  await page.getByRole("button", { name: /Salvar/ }).first().click();
  await page.waitForTimeout(2_000);

  await page.goto("/app/today");
  const row = todayDayRow(page, QUINTA);
  await expect(row).toContainText("feito esta semana");
  await expect(todayDayRow(page, "Quarta — Empurrar (moderado)")).not.toContainText("feito esta semana");
});
