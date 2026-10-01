import { test, expect, type Page } from "@playwright/test";
import { loginAsTestUser, newOnboardedUser, sql, sqlText } from "./fixtures";

/** Nothing on the page is wider than the viewport. */
async function expectNoSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test("landing page loads and links to login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /treine com um motivo/i })).toBeVisible();
  await page.getByRole("link", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /entrar na fgpower/i })).toBeVisible();
});

test("visiting a protected route while logged out redirects to login", async ({ page }) => {
  await page.goto("/app/today");
  await expect(page).toHaveURL(/\/login/);
});

test("an unknown URL is a pt-BR 404 with the public chrome and ways back", async ({ page }) => {
  const res = await page.goto("/zzz-nao-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Esta página não existe (ou saiu do ar)." })).toBeVisible();
  await expect(page).toHaveTitle(/Página não encontrada/);
  await expect(page.getByRole("link", { name: "Ir para Hoje" })).toHaveAttribute("href", "/app/today");
  await expect(page.getByRole("link", { name: "Ver programas" })).toHaveAttribute("href", "/programs");
});

test("the dark landing keeps its white hairlines in light mode (no grey token frames)", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  await page.goto("/");
  const header = page.locator("header").first();
  const color = await header.evaluate((el) => getComputedStyle(el).borderBottomColor);
  // border-white/10 — a translucent white, not the light theme's #e4e7ec.
  expect(color).not.toBe("rgb(228, 231, 236)");
  expect(color).toMatch(/(oklab\(0\.99|rgba\(255, 255, 255)/);
  await context.close();
});

test("installed-app metadata matches the light background and keeps content below the iOS status bar", async ({
  page,
  request,
}) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.background_color).toBe("#fafafb");
  expect(manifest.theme_color).toBe("#fafafb");
  await page.goto("/login");
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute("content", "default");
  await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')).toHaveAttribute(
    "content",
    "#fafafb",
  );
});

test("the landing says it's free, shows the real app and previews well when shared (W-066)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Grátis · sem cartão · pronto em 1 minuto")).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar conta grátis" }).first()).toHaveAttribute("href", "/login");
  await expect(page.getByText(/para sempre/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Abra, treine, registre." })).toBeVisible();
  const screens = page.getByRole("list", { name: "Telas do app" });
  // The scroll row is reachable by keyboard (it scrolls sideways on phones).
  await expect(screens).toHaveAttribute("tabindex", "0");
  for (const alt of [
    "Tela Hoje: o próximo treino, os exercícios e a semana",
    "Tela de treino: carga, repetições, RIR e o descanso contando",
    "Resumo do treino: tempo, séries e volume, o check-in, quem vê, como compartilhar e os recordes",
  ]) {
    const img = screens.getByRole("img", { name: alt });
    await img.scrollIntoViewIfNeeded();
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  await expect(page.getByText("Fig. 01")).toBeVisible();
  await expect(page.getByText("Crie sua conta grátis e monte seu perfil de treino em menos de um minuto.")).toBeVisible();

  // The preview: a JPEG small enough for WhatsApp, as a large card.
  const og = page.locator('meta[property="og:image"]').first();
  const ogUrl = new URL((await og.getAttribute("content"))!);
  expect(ogUrl.pathname).toContain("/opengraph-image");
  await expect(page.locator('meta[property="og:image:width"]').first()).toHaveAttribute("content", "1200");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  const image = await page.request.get(ogUrl.pathname + ogUrl.search);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/jpeg");
  expect((await image.body()).length).toBeLessThan(300_000);

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await expectNoSideScroll(page);
  }
});

test("signed in, the landing is one way back into the app (W-067)", async ({ page }) => {
  await newOnboardedUser(page, { label: "landing-in" });
  await page.goto("/");
  const header = page.locator("header").first();
  await expect(header.getByRole("link", { name: "Abrir o app" })).toHaveAttribute("href", "/app/today");
  await expect(page.getByRole("link", { name: "Entrar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Começar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Criar conta grátis" })).toHaveCount(0);
  await expect(page.getByText(/Grátis · sem cartão/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Explorar programas" })).toHaveAttribute("href", "/app/programs");
  await expect(page.getByRole("heading", { name: "Seu próximo treino está esperando." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir o app" })).toHaveCount(3);
});

test("a signed-in account that never finished onboarding opens the app into the wizard", async ({ page }) => {
  await loginAsTestUser(page, `landing-new-${Date.now()}@fgpower.dev`);
  await page.goto("/");
  await Promise.all([
    page.waitForURL(/\/onboarding/, { timeout: 30_000 }),
    page.locator("header").first().getByRole("link", { name: "Abrir o app" }).click(),
  ]);
});

test("after deleting the account, the landing says so once (W-151)", async ({ page }) => {
  await page.goto("/?conta=excluida");
  await expect(page.getByRole("status").filter({ hasText: "Sua conta foi excluída e seus dados foram apagados." })).toBeVisible();
  // The address drops the parameter, so a reload or a shared link doesn't repeat it.
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Fechar aviso" }).click();
  await expect(page.getByText("Sua conta foi excluída e seus dados foram apagados.")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Sua conta foi excluída e seus dados foram apagados.")).toHaveCount(0);
});

test("a session ended on the server (a ban) lands on the login page once, not in a redirect loop", async ({ page }) => {
  const user = await newOnboardedUser(page, { label: "landing-banned" });
  // The browser keeps better-auth's 5-minute cache cookie, which still vouches for the session.
  await page.goto("/app/today");
  // "Banir" in the moderation queue: the account is banned and its sessions end.
  sql(`UPDATE "user" SET banned = true WHERE id = ${sqlText(user.id)}; DELETE FROM "session" WHERE "userId" = ${sqlText(user.id)};`);
  await page.goto("/app/feed");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Ffeed&sessao=expirada$/);
  await expect(page.getByText("Sua sessão expirou.")).toBeVisible();
  // Nor does the landing offer the app it would bounce from.
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Criar conta grátis" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir o app" })).toHaveCount(0);
});
