import "dotenv/config";
import { test, expect, devices, type Page } from "@playwright/test";
import pg from "pg";
import { loginAsTestUser } from "./fixtures";
import { uniqueEmail } from "./workout-helpers";

// Phone-sized, Chromium engine (the only one installed).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use(iPhone);
test.describe.configure({ timeout: 90_000 });

// Read-only checks of what onboarding saved — local databases only.
const dbUrl = new URL(process.env.DATABASE_URL ?? "postgres://missing");
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(dbUrl.hostname)) {
  throw new Error("02-onboarding reads the DB directly — local databases only (check DATABASE_URL).");
}
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(async () => {
  await db.end();
});

async function savedProfile(email: string) {
  const { rows } = await db.query<{ goal: string; daysPerWeek: number; preferredDays: number[]; username: string | null }>(
    `select p.goal, p."daysPerWeek", p."preferredDays", u.username
       from "user" u join "Profile" p on p."userId" = u.id where u.email = $1`,
    [email],
  );
  return rows[0];
}

const heading = (page: Page, name: RegExp) => page.getByRole("heading", { level: 1, name });

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
    page.getByRole("button", { name: "Ver meu plano" }).click(),
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

  // Empty name + Enter: stays on step 0 with the inline error. (Retried: a
  // key pressed before hydration does nothing at all.)
  await name.fill("");
  await expect(async () => {
    await name.press("Enter");
    await expect(page.getByText("Informe seu nome para continuar.")).toBeVisible({ timeout: 1000 });
  }).toPass();
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

// W-062: Google already gave us a name; the user sees how far along they are
// and why each question is asked; the week fits one row on a phone and the
// "N× por semana" answer is reconciled with the days ticked.
test("the wizard starts from the Google first name and explains each step", async ({ page }) => {
  await page.request.post("/api/test/login", { data: { email: uniqueEmail("onb-polish"), name: "Maria Luísa Souza" } });
  await page.goto("/onboarding");

  await expect(page.getByLabel("Nome de exibição")).toHaveValue("Maria");
  await expect(page.getByText("Passo 1/4")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/Passo 2\/4\s*· Para montar sua recomendação/)).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  // Seven equal columns: every chip on the same row, inside the viewport.
  const chips = page.getByRole("group", { name: /Dias preferidos/ }).getByRole("button", { pressed: false });
  await expect(chips).toHaveCount(7);
  const boxes = await Promise.all((await chips.all()).map((c) => c.boundingBox()));
  const tops = new Set(boxes.map((b) => Math.round(b!.y)));
  expect(tops.size).toBe(1);
  const viewport = page.viewportSize()!;
  expect(Math.max(...boxes.map((b) => b!.x + b!.width))).toBeLessThanOrEqual(viewport.width);

  // 3x with 3 days: agreed. A 4th day: flagged, with a one-tap fix.
  for (const d of ["Seg", "Qua", "Sex"]) await page.getByRole("button", { name: d, exact: true }).click();
  await expect(page.getByText("3x por semana · 3 dias marcados")).toBeVisible();
  await page.getByRole("button", { name: "Sáb", exact: true }).click();
  await expect(page.getByText("3x por semana · 4 dias marcados")).toBeVisible();
  await page.getByRole("button", { name: "Usar 4x por semana" }).click();
  await expect(page.getByLabel("Dias por semana")).toHaveValue("4");
  await expect(page.getByText("4x por semana · 4 dias marcados")).toBeVisible();
});

// W-061: the step is in the URL, so the phone's back gesture walks back through
// the questions; answers survive back/forward and a reload.
test("back goes to the previous question and keeps every answer", async ({ page }) => {
  const email = uniqueEmail("onb-back");
  await loginAsTestUser(page, email);
  await page.goto("/onboarding");

  await page.getByLabel("Nome de exibição").fill("Bianca");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/[?&]passo=2/);
  await page.getByText("Força + Hipertrofia").click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/[?&]passo=3/);
  await page.getByRole("button", { name: "Ter", exact: true }).click();

  // System back: previous question, answer still picked, focus on the question.
  await page.goBack();
  await expect(page).toHaveURL(/[?&]passo=2/);
  await expect(heading(page, /principal objetivo/)).toBeFocused();
  await expect(page.getByLabel(/Força \+ Hipertrofia/)).toBeChecked();
  await page.goBack();
  await expect(heading(page, /Como podemos te chamar/)).toBeVisible();
  await expect(page.getByLabel("Nome de exibição")).toHaveValue("Bianca");

  // Forward again, then a reload mid-wizard: same step, same answers.
  await page.goForward();
  await page.goForward();
  await expect(heading(page, /experiência com treino/)).toBeVisible();
  await page.reload();
  await expect(heading(page, /experiência com treino/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Ter", exact: true })).toHaveAttribute("aria-pressed", "true");

  // "Voltar" walks back the same history.
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page).toHaveURL(/[?&]passo=2/);
  await expect(page.getByLabel(/Força \+ Hipertrofia/)).toBeChecked();

  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await Promise.all([page.waitForURL(/\/app\/today/), page.getByRole("button", { name: "Ver meu plano" }).click()]);
  const saved = await savedProfile(email);
  expect(saved.goal).toBe("STRENGTH_HYPERTROPHY");
  expect(saved.preferredDays).toEqual([2]);
});

// W-063: one main landmark and h1, each step a named group whose heading takes
// focus, a named progressbar, errors tied to their field, toggles that say on/off.
test("each step is announced and its controls are labelled", async ({ page }) => {
  await loginAsTestUser(page, uniqueEmail("onb-a11y"));
  await page.goto("/onboarding");

  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("progressbar", { name: "Passo 1 de 4" })).toBeVisible();
  await expect(page.getByRole("group", { name: /Como podemos te chamar/ })).toBeVisible();

  const name = page.getByLabel("Nome de exibição");
  await name.fill("");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAttribute("aria-describedby", /displayName-error/);
  await expect(page.locator("#displayName-error")).toHaveText("Informe seu nome para continuar.");

  await name.fill("Rui");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("progressbar", { name: "Passo 2 de 4" })).toBeVisible();
  await expect(page.getByRole("group", { name: /principal objetivo/ })).toBeVisible();
  await expect(heading(page, /principal objetivo/)).toBeFocused();

  await page.getByRole("button", { name: "Continuar" }).click();
  const seg = page.getByRole("button", { name: "Seg", exact: true });
  await expect(seg).toHaveAttribute("aria-pressed", "false");
  await seg.click();
  await expect(seg).toHaveAttribute("aria-pressed", "true");
});

// W-032: fat loss is a real goal, with the honest line and its evidence.
test("'Emagrecer / definir' is a goal, said honestly", async ({ page }) => {
  const email = uniqueEmail("onb-fatloss");
  await loginAsTestUser(page, email);
  await page.goto("/onboarding");
  await page.getByLabel("Nome de exibição").fill("Lia");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByText("Musculação preserva músculo no déficit")).toHaveCount(0);
  await page.getByText("Emagrecer / definir").click();
  await expect(page.getByText("Musculação preserva músculo no déficit; quem emagrece é a dieta.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Ver a evidência/ })).toHaveAttribute("href", /doi\.org/);
  // It promises what the recommender does: a lifting plan for the user's level, not "condicionamento geral".
  await expect(page.getByText(/Vamos sugerir um programa de musculação do seu nível, para fazer junto com a dieta/)).toBeVisible();
  await expect(page.getByText(/condicionamento geral/)).toHaveCount(0);

  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await Promise.all([page.waitForURL(/\/app\/today/), page.getByRole("button", { name: "Ver meu plano" }).click()]);
  expect((await savedProfile(email)).goal).toBe("FAT_LOSS");
  await page.goto("/app/profile");
  await expect(page.getByText("Emagrecer / definir")).toBeVisible();
});

// On a 320px phone half-width selects cut their answer ("3x por sem", "Emagrec").
test("narrow phones read every routine and goal answer whole", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const email = uniqueEmail("onb-narrow");
  await loginAsTestUser(page, email);
  await page.goto("/onboarding");
  await page.getByLabel("Nome de exibição").fill("Lia");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByText("Emagrecer / definir").click();
  await page.getByRole("button", { name: "Continuar" }).click();

  const days = page.getByLabel("Dias por semana");
  const minutes = page.getByLabel("Duração da sessão");
  await days.selectOption("3");
  await expect(days.locator("option:checked")).toHaveText("3 dias");
  await minutes.selectOption("75");
  // Stacked, each as wide as the column.
  const [d, m] = [await days.boundingBox(), await minutes.boundingBox()];
  expect(d && m && m.y > d.y + d.height && Math.abs(d.width - m.width) < 1 && d.width > 250).toBeTruthy();

  await page.getByRole("button", { name: "Continuar" }).click();
  await Promise.all([page.waitForURL(/\/app\/today/), page.getByRole("button", { name: "Ver meu plano" }).click()]);
  expect((await savedProfile(email)).daysPerWeek).toBe(3);

  // Settings: "Emagrecer / definir" fits its select (stacked below 640px).
  await page.goto("/app/settings");
  const goal = page.getByLabel("Objetivo");
  await expect(goal.locator("option:checked")).toHaveText("Emagrecer / definir");
  const fits = await goal.evaluate((el) => {
    const s = el as HTMLSelectElement;
    const cs = getComputedStyle(s);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const room = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 24; // native arrow
    return Math.max(...[...s.options].map((o) => ctx.measureText(o.text).width)) <= room;
  });
  expect(fits).toBe(true);
});

// W-018: a sign-in that started somewhere (a program dossier, a shared link)
// ends there after onboarding; anything that isn't an app path is ignored.
test("onboarding ends where sign-in started", async ({ page }) => {
  await loginAsTestUser(page, uniqueEmail("onb-next"));
  await page.goto(`/onboarding?next=${encodeURIComponent("/app/programs/templates/gd-1")}`);
  await page.getByLabel("Nome de exibição").fill("Nina");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/next=/); // kept through the steps
  await Promise.all([
    page.waitForURL(/\/app\/programs\/templates\/gd-1/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Ver meu plano" }).click(),
  ]);

  // Already onboarded: /onboarding forwards to `next` straight away.
  await page.goto(`/onboarding?next=${encodeURIComponent("/app/progress")}`);
  await expect(page).toHaveURL(/\/app\/progress/);

  // An outside URL is never followed.
  await loginAsTestUser(page, uniqueEmail("onb-next-evil"));
  await page.goto(`/onboarding?next=${encodeURIComponent("https://evil.example")}`);
  await page.getByLabel("Nome de exibição").fill("Nina");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await Promise.all([page.waitForURL(/\/app\/today/), page.getByRole("button", { name: "Ver meu plano" }).click()]);
});

// A dropped connection on "Ver meu plano" is an inline message, not the error page;
// every answer is still there to retry.
test("finishing offline keeps the wizard and its answers", async ({ page, context }) => {
  const email = uniqueEmail("onb-offline");
  await loginAsTestUser(page, email);
  await page.goto("/onboarding");
  await page.getByLabel("Nome de exibição").fill("Tati");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel(/Limitações/).fill("Ombro direito sensível");

  await context.setOffline(true);
  await page.getByRole("button", { name: "Ver meu plano" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Sem conexão" })).toBeVisible();
  await expect(page.getByLabel(/Limitações/)).toHaveValue("Ombro direito sensível");
  await context.setOffline(false);

  await Promise.all([page.waitForURL(/\/app\/today/), page.getByRole("button", { name: "Ver meu plano" }).click()]);
  expect((await savedProfile(email)).username).toBeTruthy();
});
