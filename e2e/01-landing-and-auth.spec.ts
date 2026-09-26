import { test, expect } from "@playwright/test";

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
