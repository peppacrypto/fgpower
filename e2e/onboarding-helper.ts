import type { Page } from "@playwright/test";
import { sql, sqlText } from "./db";
import { userIdOf } from "./fixtures";

/**
 * Fills the onboarding wizard with defaults and submits it, then clears the
 * plan onboarding now auto-generates for new users (src/lib/programming/
 * auto-enroll). That feature is covered on its own (02-onboarding + the unit
 * and integration tests); every OTHER spec builds on a clean, program-less
 * onboarded user — the supported state of someone who hasn't picked a program
 * yet — so this fixture resets to it instead of making ~20 specs account for
 * the starter plan.
 */
export async function completeOnboarding(page: Page) {
  await page.goto("/app/today");
  if (!/\/onboarding/.test(page.url())) return;
  await page.getByLabel("Nome de exibição").fill("Teste E2E");
  // A-049: attested 18+ is required to leave step 1.
  await page.locator("#confirm-adult").check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  // A-008: the health-data consent gates the final submit.
  await page.locator('input[name="healthConsent"]').check();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 15_000 }),
    page.getByRole("button", { name: "Ver meu plano" }).click(),
  ]);
  await clearAutoPlan(page);
}

/**
 * Removes the onboarding starter plan, leaving the user program-less — the
 * baseline the rest of the suite was written against. A fresh account has no
 * workouts yet, so the enrollment and the program (its days/exercises cascade)
 * are the whole of it.
 */
export async function clearAutoPlan(page: Page) {
  const id = await userIdOf(page);
  sql(
    `DELETE FROM "ProgramEnrollment" WHERE "userId" = ${sqlText(id)}; ` +
      `DELETE FROM "UserProgram" WHERE "userId" = ${sqlText(id)};`,
  );
}
