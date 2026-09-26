import { test, expect, devices } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";

// Phone-sized, Chromium engine (the only one installed).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use(iPhone);

test("authenticated new user is guided through onboarding", async ({ page }) => {
  const email = `onboarding-${Date.now()}@fgpower.dev`;
  await loginAsTestUser(page, email);

  await page.goto("/app/today");
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByLabel("Nome de exibição").fill("Teste E2E");
  await page.getByRole("button", { name: "Continuar" }).click();

  // Step 2: goal — accept the default selection.
  await expect(page.getByRole("heading", { name: /principal objetivo/i })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  // Step 3: experience + frequency — accept defaults.
  await expect(page.getByRole("heading", { name: /experiência com treino/i })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  // Step 4: equipment — submit. This triggers a server action + redirect,
  // so wait for the navigation concurrently to avoid a race where the
  // button is replaced/detached mid-click.
  await expect(page.getByRole("heading", { name: /onde você vai treinar/i })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 15_000 }),
    page.getByRole("button", { name: "Concluir" }).click(),
  ]);

  await expect(page).toHaveURL(/\/app\/today/);
  await expect(page.getByText(/teste/i).first()).toBeVisible();
});

// W-002: the name field is the only text input on step 0, so the phone
// keyboard's "Ir"/Enter triggers implicit form submission. It must advance to
// the next step — never finish onboarding with unseen default answers.
test("Enter in the name field goes to the next step instead of submitting", async ({ page }) => {
  await loginAsTestUser(page, `onboarding-enter-${Date.now()}@fgpower.dev`);
  await page.goto("/onboarding");

  const name = page.getByLabel("Nome de exibição");
  await expect(name).toHaveAttribute("enterkeyhint", "next");

  // Empty name + Enter: stays on step 0 with the inline error.
  await name.press("Enter");
  await expect(page.getByText("Informe seu nome para continuar.")).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding/);

  await name.fill("Marina");
  await name.press("Enter");
  const goal = page.getByRole("heading", { name: /principal objetivo/i });
  await expect(goal).toBeVisible();
  await expect(goal).toBeFocused();

  // Give a stray submit time to land; we must still be in the wizard.
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/onboarding/);
  await page.goto("/app/today");
  await expect(page).toHaveURL(/\/onboarding/);
});
