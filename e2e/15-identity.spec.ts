import "dotenv/config";
import { test, expect, devices, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { loginAsTestUser } from "./fixtures";
import { uniqueEmail } from "./workout-helpers";

/**
 * Identity (Batch 2, cluster D): every account gets a public @handle during
 * onboarding (suggested from the name, checked as it's typed), Settings shows
 * the saved handle at once with its link, other people see the display name
 * the user chose, /login explains OAuth failures and expired sessions, and an
 * action that finds the session gone offers a way to sign in and come back.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use(iPhone);
test.describe.configure({ timeout: 120_000 });

// Reads what was saved and seeds a clashing handle — local databases only.
const dbUrl = new URL(process.env.DATABASE_URL ?? "postgres://missing");
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(dbUrl.hostname)) {
  throw new Error("15-identity reads the DB directly — local databases only (check DATABASE_URL).");
}
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(async () => {
  await db.end();
});

async function handleOf(email: string) {
  const { rows } = await db.query<{ username: string | null; displayUsername: string | null }>(
    `select username, "displayUsername" from "user" where email = $1`,
    [email],
  );
  return rows[0];
}

const tag = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5);

/** Signs in with a Google-like account name and walks the wizard. */
async function onboard(page: Page, opts: { email: string; googleName?: string; name: string; handle?: string }) {
  const res = await page.request.post("/api/test/login", { data: { email: opts.email, name: opts.googleName ?? "E2E Test" } });
  expect(res.ok()).toBe(true);
  await page.goto("/onboarding");
  await page.getByLabel("Nome de exibição").fill(opts.name);
  if (opts.handle !== undefined) await page.getByLabel("Seu @usuário (opcional)").fill(opts.handle);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Ver meu plano" }).click(),
  ]);
}

async function newContext(browser: Browser) {
  const context = await browser.newContext(iPhone);
  return { context, page: await context.newPage() };
}

test("onboarding gives every account a public handle", async ({ page }) => {
  // Untouched suggestion: derived from the name, lower-case, no accents.
  const first = uniqueEmail("id-auto");
  const name = `Zoé ${tag()}`;
  await page.request.post("/api/test/login", { data: { email: first, name: "E2E Test" } });
  await page.goto("/onboarding");
  const handle = page.getByLabel("Seu @usuário (opcional)");
  await expect(page.getByText("3 a 24 caracteres: letras, números e _")).toBeVisible();
  await expect(handle).toHaveAttribute("placeholder", "seu_usuario");
  await page.getByLabel("Nome de exibição").fill(name);
  const expected = name.toLowerCase().replace("é", "e").replace(" ", "_");
  await expect(handle).toHaveValue(expected);
  await expect(page.getByText(`/u/${expected}`)).toBeVisible();
  // Enter in the handle field is "next", like in the name field.
  await handle.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: /principal objetivo/ })).toBeVisible();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await Promise.all([page.waitForURL(/\/app\/today/), page.getByRole("button", { name: "Ver meu plano" }).click()]);
  expect((await handleOf(first)).username).toBe(expected);

  // Same name again: the suggestion moves on to a free variant.
  const second = uniqueEmail("id-auto-2");
  await onboard(page, { email: second, name });
  expect((await handleOf(second)).username).toBe(`${expected}2`);

  // Field cleared: one is still created from the name.
  const third = uniqueEmail("id-empty");
  await onboard(page, { email: third, name, handle: "" });
  expect((await handleOf(third)).username).toMatch(new RegExp(`^${expected}\\d+$`));
});

test("a typed handle is checked before moving on, then claimed as typed", async ({ page }) => {
  // Someone else claims a handle first.
  const taken = `Tomado_${tag()}`;
  const owner = uniqueEmail("id-owner");
  await onboard(page, { email: owner, name: "Dono", handle: taken });
  expect(await handleOf(owner)).toEqual({ username: taken.toLowerCase(), displayUsername: taken });

  const email = uniqueEmail("id-typed");
  await page.request.post("/api/test/login", { data: { email, name: "E2E Test" } });
  await page.goto("/onboarding");
  const field = page.getByLabel("Seu @usuário (opcional)");

  // Format problems show at once; Continuar stays on the step.
  await field.fill("maria-x");
  await expect(page.getByText(/Use apenas letras, números e _/)).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute("aria-invalid", "true");

  // Someone else's handle (any casing): said while typing.
  await field.fill(taken.toUpperCase());
  await expect(page.getByText("Este nome de usuário já está em uso.")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Como podemos te chamar/ })).toBeVisible();

  const mine = `Meu_${tag()}`;
  await field.fill(`@${mine}`); // a pasted "@" is dropped
  await expect(field).toHaveValue(mine);
  await expect(page.getByText("Disponível ✓")).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await Promise.all([page.waitForURL(/\/app\/today/), page.getByRole("button", { name: "Ver meu plano" }).click()]);
  expect(await handleOf(email)).toEqual({ username: mine.toLowerCase(), displayUsername: mine });

  // Perfil shows it right away (no 5-minute session-cache lag).
  await page.goto("/app/profile");
  await expect(page.getByText(`@${mine}`)).toBeVisible();
  await expect(page.getByRole("link", { name: /Ver perfil público/ })).toHaveAttribute("href", `/u/${mine.toLowerCase()}`);
});

test("Settings shows the rule, confirms the claim and hands over the link", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await onboard(page, { email: uniqueEmail("id-settings"), name: "Joana" });
  await page.goto("/app/settings");

  const field = page.getByLabel("Nome de usuário público");
  await expect(field).toHaveAttribute("placeholder", "seu_usuario");
  await expect(page.getByText(/3 a 24 caracteres: letras, números e _/).first()).toBeVisible();

  // Onboarding already assigned one: its link is there before any edit.
  await expect(page.getByRole("link", { name: "Ver perfil" })).toBeVisible();

  const handle = `Joana_${tag()}`;
  await field.fill(handle);
  await expect(page.getByText(`/u/${handle}`)).toBeVisible(); // preview while typing
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  const status = page.locator("#username-status");
  await expect(status.getByText("Salvo ✓")).toBeVisible();
  await expect(status.getByText(`/u/${handle.toLowerCase()}`)).toBeVisible();
  await expect(status.getByRole("link", { name: "Ver perfil" })).toHaveAttribute("href", `/u/${handle.toLowerCase()}`);

  await status.getByRole("button", { name: "Copiar link" }).click();
  await expect(status.getByRole("button", { name: "Link copiado ✓" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(new RegExp(`^https?://[^/]+/u/${handle.toLowerCase()}$`));

  // Perfil, read from the DB, agrees immediately.
  await page.goto("/app/profile");
  await expect(page.getByText(`@${handle}`)).toBeVisible();
});

test("other people see the display name the user chose", async ({ browser }) => {
  const t = tag();
  const carla = await newContext(browser);
  const carlaEmail = uniqueEmail("id-carla");
  await onboard(carla.page, { email: carlaEmail, googleName: "Carla Mendes", name: "Carlinha", handle: `carlinha_${t}` });
  const beto = await newContext(browser);
  await onboard(beto.page, { email: uniqueEmail("id-beto"), googleName: "Roberto Alves", name: "Beto", handle: `beto_${t}` });

  // Own profile: name and avatar initials from the display name.
  await carla.page.goto("/app/profile");
  await expect(carla.page.getByRole("heading", { level: 1, name: "Carlinha" })).toBeVisible();
  await expect(carla.page.getByText("CM")).toHaveCount(0);

  // Descobrir finds her by @handle or display name — shown as "Carlinha"…
  for (const q of [`@carlinha_${t}`, "Carlinha"]) {
    await beto.page.goto(`/app/discover?q=${encodeURIComponent(q)}`);
    const card = beto.page.getByRole("link", { name: new RegExp(`carlinha_${t}`) });
    await expect(card, q).toBeVisible();
    await expect(card).toContainText("Carlinha");
    await expect(card).not.toContainText("Carla Mendes");
  }
  // …but never by the Google name behind it.
  await beto.page.goto(`/app/discover?q=${encodeURIComponent("Carla Mendes")}`);
  await expect(beto.page.getByText(/Ninguém encontrado/)).toBeVisible();
  await expect(beto.page.getByRole("link", { name: new RegExp(`carlinha_${t}`) })).toHaveCount(0);

  // Public profile + the follow request she receives.
  await beto.page.goto(`/u/carlinha_${t}`);
  await expect(beto.page.getByRole("heading", { level: 1, name: "Carlinha" })).toBeVisible();
  await beto.page.getByRole("button", { name: "Solicitar seguir" }).click();
  await expect(beto.page.getByRole("button", { name: "Solicitação enviada" })).toBeEnabled();
  await beto.page.reload(); // the request is on the server, not just on screen
  await expect(beto.page.getByRole("button", { name: "Solicitação enviada" })).toBeVisible();

  await carla.page.goto("/app/notifications");
  await expect(carla.page.getByText("Beto pediu para seguir você")).toBeVisible();
  await expect(carla.page.getByText(/Roberto Alves/)).toHaveCount(0);

  await carla.context.close();
  await beto.context.close();
});

test("/login explains a failed or cancelled Google sign-in and an expired session", async ({ page }) => {
  // (The route announcer is also role="alert"; ours is the one with text.)
  const note = page.getByRole("alert").filter({ hasText: /Google|Código/ });
  await page.goto("/login?error=access_denied");
  await expect(note).toContainText("O login com o Google foi cancelado.");

  await page.goto("/login?error=invalid_code&next=%2Fapp%2Fprogress");
  await expect(note).toContainText("Não foi possível entrar com o Google.");
  await expect(note).toContainText("invalid_code");

  await page.goto("/login?error=%3Cscript%3E");
  await expect(note).toContainText("Código: erro");

  await page.goto("/login?sessao=expirada");
  await expect(page.getByText("Sua sessão expirou.")).toBeVisible();

  await page.goto("/login");
  await expect(note).toHaveCount(0);
  await expect(page.getByText("Sua sessão expirou.")).toHaveCount(0);

  // Signed in, /login forwards to a safe `next` only.
  await loginAsTestUser(page, uniqueEmail("id-login-next"));
  await page.goto("/login?next=%2Fu%2Fnobody_here");
  await expect(page).toHaveURL(/\/u\/nobody_here/);
  await page.goto(`/login?next=${encodeURIComponent("https://evil.example/")}`);
  await expect(page).not.toHaveURL(/evil/);
});

/** Ends the session on the server (revoked, or expired there), as another device's sign-out would. */
async function revokeSessions(email: string, context: import("@playwright/test").BrowserContext) {
  await db.query(`delete from "session" where "userId" = (select id from "user" where email = $1)`, [email]);
  // Drop the 5-minute session cache cookie too, or it would vouch for the session a while longer.
  const keep = (await context.cookies()).filter((c) => c.name !== "better-auth.session_data");
  await context.clearCookies();
  await context.addCookies(keep);
}

test("a session that ends mid-wizard signs in again and resumes the wizard, destination included", async ({
  page,
  context,
}) => {
  const email = uniqueEmail("id-onb-revoked");
  const program = "/app/programs/templates/gd-1";
  await loginAsTestUser(page, email);
  await page.goto(`/onboarding?next=${encodeURIComponent(program)}`);
  await page.getByLabel("Nome de exibição").fill("Rita");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel(/Limitações/).fill("Joelho esquerdo");

  // Signed out on another device: the cookie is still here, the session isn't.
  await revokeSessions(email, context);
  await page.getByRole("button", { name: "Ver meu plano" }).click();
  await expect(page).toHaveURL(/\/login\?.*sessao=expirada/);
  await expect(page.getByText("Sua sessão expirou.")).toBeVisible();
  const next = new URL(page.url()).searchParams.get("next") ?? "";
  expect(next).toMatch(/^\/onboarding\?/);
  expect(new URLSearchParams(next.split("?")[1]).get("next")).toBe(program);

  // Signing in again (here: the test login, then /login forwards to `next`).
  await loginAsTestUser(page, email);
  await page.reload();
  await expect(page).toHaveURL(/\/onboarding\?/);
  await expect(page.getByLabel(/Limitações/)).toHaveValue("Joelho esquerdo");
  await Promise.all([
    page.waitForURL(new RegExp(program), { timeout: 30_000 }),
    page.getByRole("button", { name: "Ver meu plano" }).click(),
  ]);
});

test("with the cookie gone mid-wizard, Entrar keeps the wizard's destination", async ({ page, context }) => {
  const email = uniqueEmail("id-onb-nocookie");
  const program = "/app/programs/templates/gd-1";
  await loginAsTestUser(page, email);
  await page.goto(`/onboarding?next=${encodeURIComponent(program)}`);
  await page.getByLabel("Nome de exibição").fill("Rita");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continuar" }).click();

  await context.clearCookies();
  await page.getByRole("button", { name: "Ver meu plano" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Sua sessão expirou — entre de novo." });
  await expect(alert).toBeVisible();
  const href = (await alert.getByRole("link", { name: "Entrar" }).getAttribute("href")) ?? "";
  const next = new URLSearchParams(href.split("?")[1]).get("next") ?? "";
  expect(next).toMatch(/^\/onboarding\?/);
  expect(new URLSearchParams(next.split("?")[1]).get("next")).toBe(program);

  await alert.getByRole("link", { name: "Entrar" }).click();
  await expect(page.getByText("Sua sessão expirou.")).toBeVisible();
  await loginAsTestUser(page, email);
  await page.reload();
  await expect(page.getByLabel("Nome de exibição")).toHaveValue("Rita"); // draft restored
  await expect(page.locator('input[name="next"]')).toHaveValue(program);
});

test("a follow tap after the session was revoked explains itself", async ({ browser }) => {
  const t = tag();
  const owner = await newContext(browser);
  await onboard(owner.page, { email: uniqueEmail("id-rev-owner"), name: "Olga", handle: `olga_${t}` });
  const fan = await newContext(browser);
  const fanEmail = uniqueEmail("id-rev-fan");
  await onboard(fan.page, { email: fanEmail, name: "Fabio" });

  await fan.page.goto(`/u/olga_${t}`);
  await revokeSessions(fanEmail, fan.context);
  await fan.page.getByRole("button", { name: "Solicitar seguir" }).click();
  await expect(fan.page.getByRole("alert").filter({ hasText: "Sua sessão expirou — entre de novo." })).toBeVisible();
  await expect(fan.page.getByRole("link", { name: "Entrar de novo" })).toHaveAttribute(
    "href",
    `/login?next=${encodeURIComponent(`/u/olga_${t}`)}&sessao=expirada`,
  );

  await owner.context.close();
  await fan.context.close();
});

test("an account outside Descobrir is told where its profile lives", async ({ page }) => {
  const email = uniqueEmail("id-hidden");
  const handle = `oculta_${tag()}`;
  await onboard(page, { email, name: "Oculta", handle });
  await page.goto("/app/profile");
  await expect(page.getByText("Seu endereço público")).toHaveCount(0); // discoverable by default

  // As the backfill leaves accounts that never picked a handle.
  await db.query(
    `update "Profile" set discoverable = false where "userId" = (select id from "user" where email = $1)`,
    [email],
  );
  await page.reload();
  await expect(page.getByText("Seu endereço público")).toBeVisible();
  await expect(page.getByText(`/u/${handle}`)).toBeVisible();
  await page.getByRole("link", { name: "Ajustar privacidade" }).click();
  await expect(page).toHaveURL(/\/app\/settings#privacidade/);
  await expect(page.getByRole("switch", { name: /Permitir que sua conta seja descoberta/ })).not.toBeChecked();
});

// A session cookie that no longer resolves (revoked, or expired on the server)
// is deleted by better-auth during the action; Next re-renders the page and
// requireUser() sends the user to a login page that says why and comes back.
test("a revoked session lands on a login page that says why", async ({ page, context }) => {
  const email = uniqueEmail("id-revoked");
  await onboard(page, { email, name: "Joana" });
  await page.goto("/app/settings");
  await revokeSessions(email, context);
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page).toHaveURL(/\/login\?.*sessao=expirada/);
  await expect(page.getByText("Sua sessão expirou.")).toBeVisible();
});

test("a follow tap after the session ended says so instead of failing silently", async ({ browser }) => {
  const t = tag();
  const owner = await newContext(browser);
  await onboard(owner.page, { email: uniqueEmail("id-exp-owner"), name: "Olga", handle: `olga_${t}` });
  const fan = await newContext(browser);
  const fanEmail = uniqueEmail("id-exp-fan");
  await onboard(fan.page, { email: fanEmail, name: "Fabio" });

  await fan.page.goto(`/u/olga_${t}`);
  // Cookies gone entirely, as after 30 days away (/u pages aren't behind the proxy).
  await fan.context.clearCookies();
  await fan.page.getByRole("button", { name: "Solicitar seguir" }).click();
  await expect(fan.page.getByText("Sua sessão expirou — entre de novo.")).toBeVisible();
  await expect(fan.page.getByRole("button", { name: "Solicitar seguir" })).toBeVisible(); // rolled back
  await expect(fan.page.getByRole("link", { name: "Entrar" })).toHaveAttribute(
    "href",
    `/login?next=${encodeURIComponent(`/u/olga_${t}`)}&sessao=expirada`,
  );

  await owner.context.close();
  await fan.context.close();
});

// With no session cookie at all, the proxy lets the action POST through, so the
// action itself explains the expired session and the form keeps what was typed.
test("an action with the cookie gone entirely (30 days away) also explains itself", async ({ page, context }) => {
  await onboard(page, { email: uniqueEmail("id-expired-cookie"), name: "Joana" });
  await page.goto("/app/settings");
  const profile = page.locator("form").filter({ has: page.getByRole("button", { name: "Salvar perfil" }) });
  await profile.getByLabel("Bio (opcional)").fill("Escrito antes de expirar");
  await context.clearCookies();
  await profile.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(profile.getByText("Sua sessão expirou — entre de novo.")).toBeVisible();
  await expect(page).toHaveURL(/\/app\/settings/);
  await expect(profile.getByLabel("Bio (opcional)")).toHaveValue("Escrito antes de expirar");
  const signIn = profile.getByRole("link", { name: "Entrar" });
  await expect(signIn).toHaveAttribute("href", "/login?next=%2Fapp%2Fsettings&sessao=expirada");
  await signIn.click();
  await expect(page.getByText("Sua sessão expirou.")).toBeVisible();
});
