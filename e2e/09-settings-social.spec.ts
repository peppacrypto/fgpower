import "dotenv/config";
import { test, expect, devices, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { loginAsTestUser } from "./fixtures";
import { uniqueEmail } from "./workout-helpers";

/**
 * Settings, history and the social layer (Batch 1, cluster E): Settings never
 * erases onboarding answers and confirms saves; failed actions roll back
 * inline instead of swapping the page for the error boundary; malformed
 * history links render; signed-out visitors get a sign-in path for FG;
 * follow-request answers say what happened.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use(iPhone);
test.describe.configure({ timeout: 120_000 });

// Direct DB access only to seed what the UI can't make quickly (a shared
// workout) and to flip account flags — local databases only, never production.
const dbUrl = new URL(process.env.DATABASE_URL ?? "postgres://missing");
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(dbUrl.hostname)) {
  throw new Error("09-settings-social seeds the DB directly — local databases only (check DATABASE_URL).");
}
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(async () => {
  await db.end();
});

async function userIdByEmail(email: string) {
  const { rows } = await db.query<{ id: string }>(`select id from "user" where email = $1`, [email]);
  return rows[0].id;
}

/** Onboards through the wizard with some optional answers filled in. */
async function onboardWith(page: Page, opts: { name: string; days?: string[]; limitations?: string }) {
  await page.goto("/onboarding");
  await page.getByLabel("Nome de exibição").fill(opts.name);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  for (const d of opts.days ?? []) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  if (opts.limitations) await page.getByLabel(/Limitações/).fill(opts.limitations);
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Ver meu plano" }).click(),
  ]);
}

/** A signed-in, onboarded user in its own browser context. */
async function newUser(browser: Browser, label: string, name: string) {
  const context = await browser.newContext(iPhone);
  const page = await context.newPage();
  const email = uniqueEmail(label);
  await loginAsTestUser(page, email);
  await onboardWith(page, { name });
  // Social surfaces show the onboarding display name (not the account's "E2E Test").
  const id = await userIdByEmail(email);
  return { context, page, id };
}

async function setPublicIdentity(userId: string, username: string, isPublic: boolean) {
  await db.query(`update "user" set username = $2, "displayUsername" = $2 where id = $1`, [userId, username]);
  await db.query(`update "Profile" set "isPublicAccount" = $2 where "userId" = $1`, [userId, isPublic]);
}

test("saving Settings keeps onboarding answers and confirms every save", async ({ page }) => {
  await loginAsTestUser(page, uniqueEmail("settings"));
  await onboardWith(page, { name: "Joana", days: ["Seg", "Qua", "Sex"], limitations: "Evitar agachamento profundo" });

  await page.goto("/app/settings");
  const profile = page.locator("form").filter({ has: page.getByRole("button", { name: "Salvar perfil" }) });
  const routine = page.locator("form").filter({ has: page.getByRole("button", { name: "Salvar rotina" }) });

  // Onboarding answers are visible and editable in the Rotina block.
  for (const d of ["Seg", "Qua", "Sex"]) {
    await expect(routine.getByRole("button", { name: d, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await expect(routine.getByLabel(/Limitações/)).toHaveValue("Evitar agachamento profundo");

  // Bio-only save: confirmed, and nothing else is touched.
  await profile.getByLabel("Bio (opcional)").fill("Treino às 6h");
  await profile.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(profile.getByText("Salvo ✓")).toBeVisible();
  await expect(profile.getByText("Salvo ✓")).toHaveCount(0, { timeout: 6_000 });

  await page.reload();
  await expect(page.getByLabel("Bio (opcional)")).toHaveValue("Treino às 6h");
  for (const d of ["Seg", "Qua", "Sex"]) {
    await expect(routine.getByRole("button", { name: d, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await expect(routine.getByLabel(/Limitações/)).toHaveValue("Evitar agachamento profundo");

  // Rotina save: clearing every day and adding endurance sticks.
  for (const d of ["Seg", "Qua", "Sex"]) await routine.getByRole("button", { name: d, exact: true }).click();
  await routine.getByLabel(/Também treino resistência/).check();
  await routine.getByLabel("Detalhes do treino de endurance").fill("Corro 2x por semana");
  await routine.getByRole("button", { name: "Salvar rotina" }).click();
  await expect(routine.getByText("Salvo ✓")).toBeVisible();
  await page.reload();
  for (const d of ["Seg", "Qua", "Sex"]) {
    await expect(routine.getByRole("button", { name: d, exact: true })).toHaveAttribute("aria-pressed", "false");
  }
  await expect(routine.getByLabel("Detalhes do treino de endurance")).toHaveValue("Corro 2x por semana");
  await expect(page.getByLabel("Bio (opcional)")).toHaveValue("Treino às 6h");
});

test("an invalid profile field is highlighted and typed input survives", async ({ page }) => {
  await loginAsTestUser(page, uniqueEmail("settings-invalid"));
  await onboardWith(page, { name: "Joana" });
  await page.goto("/app/settings");

  const name = page.getByLabel("Nome de exibição");
  await name.fill("   ");
  await page.getByLabel("Bio (opcional)").fill("Bio que não pode sumir");
  await page.getByRole("button", { name: "Salvar perfil" }).click();

  await expect(page.getByText("Revise os campos destacados.")).toBeVisible();
  await expect(page.getByText("Informe seu nome.")).toBeVisible();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  await expect(page.getByLabel("Bio (opcional)")).toHaveValue("Bio que não pode sumir");

  // Editing the field clears its error.
  await name.fill("Joana Silva");
  await expect(page.getByText("Informe seu nome.")).toHaveCount(0);
  await expect(name).not.toHaveAttribute("aria-invalid", "true");
});

test("rest-timer sound toggle persists and offline toggles roll back inline", async ({ page, context }) => {
  await loginAsTestUser(page, uniqueEmail("settings-toggles"));
  await onboardWith(page, { name: "Joana" });
  await page.goto("/app/settings");

  const sound = page.getByRole("switch", { name: /Aviso sonoro no fim do descanso/ });
  await expect(sound).toBeChecked();
  await sound.click();
  await expect(page.getByText("Salvo ✓")).toBeVisible();
  await page.reload();
  await expect(sound).not.toBeChecked();

  // Offline: the switch flips back, the row explains, the page stays.
  const publicAccount = page.getByRole("switch", { name: /Conta pública/ });
  await expect(publicAccount).not.toBeChecked();
  await context.setOffline(true);
  await publicAccount.click();
  await expect(page.getByText(/A alteração foi desfeita/)).toBeVisible();
  await expect(publicAccount).not.toBeChecked();
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();

  // Offline Perfil / Rotina saves keep the typed text and say so right by the
  // button the user just tapped (the top of a tall form is off-screen on a phone).
  // Scoped to each form: the app-wide offline strip also says "Sem conexão".
  const profile = page.locator("form").filter({ has: page.getByRole("button", { name: "Salvar perfil" }) });
  await profile.getByLabel("Bio (opcional)").fill("Digitado sem sinal");
  await profile.getByRole("button", { name: "Salvar perfil" }).click();
  const profileStatus = profile.getByRole("status").filter({ hasText: /Sem conexão/ });
  await expect(profileStatus).toBeVisible();
  await expect(profileStatus).toBeInViewport();
  await expect(profile.getByLabel("Bio (opcional)")).toHaveValue("Digitado sem sinal");

  const routine = page.locator("form").filter({ has: page.getByRole("button", { name: "Salvar rotina" }) });
  await routine.getByLabel(/Limitações/).fill("Ombro direito sensível");
  await routine.getByRole("button", { name: "Salvar rotina" }).click();
  const routineStatus = routine.getByRole("status").filter({ hasText: /Sem conexão/ });
  await expect(routineStatus).toBeVisible();
  await expect(routineStatus).toBeInViewport();
  await expect(routine.getByRole("button", { name: "Salvar rotina" })).toBeEnabled();
  await context.setOffline(false);

  // Back online, the same button saves and the error gives way to the confirmation.
  await routine.getByRole("button", { name: "Salvar rotina" }).click();
  await expect(routine.getByText("Salvo ✓")).toBeVisible();
  await expect(routineStatus).toHaveCount(0);
});

test("a claimed username is still shown after a reload", async ({ page }) => {
  await loginAsTestUser(page, uniqueEmail("settings-username"));
  await onboardWith(page, { name: "Joana" });
  await page.goto("/app/settings");

  const handle = `Joana_${Date.now().toString(36)}`;
  const field = page.getByLabel("Nome de usuário público");
  await field.fill(handle);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Salvo ✓")).toBeVisible();

  // Within the session cookie cache window: the field must not fall back to empty.
  await page.reload();
  await expect(field).toHaveValue(handle);
  await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();
});

test("malformed history links render the page instead of crashing", async ({ page }) => {
  await loginAsTestUser(page, uniqueEmail("history-params"));
  await onboardWith(page, { name: "Joana" });

  for (const path of [
    "/app/history?month=abc",
    "/app/history?year=abc",
    "/app/history?month=12&year=2026",
    "/app/history?year=1850&month=-4",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Histórico" })).toBeVisible();
    // Always a real month name, never a bare year.
    await expect(page.locator("h2").first()).toHaveText(
      /^(Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro) \d{4}$/,
    );
  }
  for (const path of ["/app/history/all?page=abc", "/app/history/all?page=0", "/app/history/all?page=99"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Todo o histórico" })).toBeVisible();
  }
});

test("history buckets an evening workout on its São Paulo day", async ({ page }) => {
  const email = uniqueEmail("history-tz");
  await loginAsTestUser(page, email);
  await onboardWith(page, { name: "Joana" });
  const userId = await userIdByEmail(email);
  // Thursday 24/09/2026 21:30 in São Paulo = Friday 00:30 UTC.
  await db.query(
    `insert into "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "durationSeconds", "totalWorkingSets", "updatedAt")
     values ($1, $2, 'Treino noturno', 'COMPLETED', '2026-09-24T23:30:00Z', '2026-09-25T00:30:00Z', 3600, 12, now())`,
    [`${userId}-evening`, userId],
  );

  await page.goto("/app/history?year=2026&month=8");
  const workoutCells = page.locator('a[href$="/summary"]').filter({ hasText: /^\d+$/ });
  await expect(workoutCells).toHaveText(["24"]);
  await expect(page.getByText("24 de set. de 2026")).toBeVisible();
});

test("signed-out visitors get a sign-in link for FG; FG failures roll back", async ({ browser }) => {
  const tag = Date.now().toString(36);
  const author = await newUser(browser, "fg-author", "Bruno Atleta");
  await setPublicIdentity(author.id, `bruno_${tag}`, true);
  const summary = { workoutName: "Superior (pesado)", durationSeconds: 3600, totalWorkingSets: 18, totalVolumeKg: 8000, prs: [], exercises: [] };
  await db.query(
    `insert into "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "durationSeconds", visibility, "updatedAt")
     values ($1, $2, 'Superior (pesado)', 'COMPLETED', now() - interval '2 hours', now() - interval '1 hour', 3600, 'PUBLIC', now())`,
    [`${author.id}-s`, author.id],
  );
  await db.query(
    `insert into "Activity" (id, "userId", type, "sessionId", visibility, summary, "updatedAt")
     values ($1, $2, 'WORKOUT', $3, 'PUBLIC', $4::jsonb, now())`,
    [`${author.id}-a`, author.id, `${author.id}-s`, JSON.stringify(summary)],
  );

  // Signed out: FG is a sign-in link that comes back to this profile.
  const anonContext = await browser.newContext(iPhone);
  const anon = await anonContext.newPage();
  await anon.goto(`/u/bruno_${tag}`);
  const signIn = anon.getByRole("link", { name: /Entre para dar FG/ });
  await expect(signIn).toHaveAttribute("href", `/login?next=${encodeURIComponent(`/u/bruno_${tag}`)}`);
  await expect(anon.getByRole("link", { name: "Entre para seguir" })).toBeVisible();
  await signIn.click();
  await expect(anon).toHaveURL(/\/login/);
  await expect(anon.getByText("Algo saiu do prumo")).toHaveCount(0);
  await anonContext.close();

  // Signed in: FG counts, survives a reload, and an offline undo rolls back.
  const fan = await newUser(browser, "fg-fan", "Carla Fã");
  await fan.page.goto(`/u/bruno_${tag}`);
  const fg = fan.page.getByRole("button", { name: /FG/ });
  // The count shows at once (optimistic): wait for the server to take the FG before reloading.
  await Promise.all([
    fan.page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined),
    fg.click(),
  ]);
  await expect(fg).toHaveAttribute("aria-pressed", "true");
  await expect(fg).toContainText("1");
  await fan.page.reload();
  await expect(fg).toHaveAttribute("aria-pressed", "true");

  await fan.context.setOffline(true);
  await fg.click();
  await expect(fan.page.getByText(/Sem conexão/)).toBeVisible();
  await expect(fg).toHaveAttribute("aria-pressed", "true");
  await expect(fg).toContainText("1");
  await expect(fan.page.getByText("Algo saiu do prumo")).toHaveCount(0);
  await fan.context.setOffline(false);

  await author.context.close();
  await fan.context.close();
});

test("answering a follow request says what happened", async ({ browser }) => {
  const tag = Date.now().toString(36);
  const owner = await newUser(browser, "req-owner", "Diana Privada");
  await setPublicIdentity(owner.id, `diana_${tag}`, false);
  const asker = await newUser(browser, "req-asker", "Edu Pedido");
  const other = await newUser(browser, "req-other", "Fabi Outra");

  for (const who of [asker, other]) {
    await who.page.goto(`/u/diana_${tag}`);
    await who.page.getByRole("button", { name: "Solicitar seguir" }).click();
    await expect(who.page.getByRole("button", { name: "Solicitação enviada" })).toBeVisible();
  }

  await owner.page.goto("/app/notifications");
  const askerRow = owner.page.locator("div.border-b").filter({ hasText: "Edu Pedido" });
  const otherRow = owner.page.locator("div.border-b").filter({ hasText: "Fabi Outra" });

  // Offline: inline error, buttons stay so the owner can retry.
  await owner.context.setOffline(true);
  await askerRow.getByRole("button", { name: "Aceitar" }).click();
  await expect(askerRow.getByText(/Sem conexão/)).toBeVisible();
  await expect(askerRow.getByRole("button", { name: "Aceitar" })).toBeVisible();
  await owner.context.setOffline(false);

  await askerRow.getByRole("button", { name: "Aceitar" }).click();
  await expect(askerRow.getByText("Solicitação aceita")).toBeVisible();
  await expect(askerRow.getByText("Edu Pedido agora segue você.")).toBeVisible();
  await otherRow.getByRole("button", { name: "Recusar" }).click();
  await expect(otherRow.getByText("Solicitação recusada")).toBeVisible();

  // The outcome is still stated after a reload.
  await owner.page.reload();
  await expect(askerRow.getByText("Solicitação aceita")).toBeVisible();
  await expect(otherRow.getByText("Solicitação recusada")).toBeVisible();

  for (const u of [owner, asker, other]) await u.context.close();
});
