import { test, expect, devices, type Locator, type Page } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";
import { newUserOnGd1, SEGUNDA, startDayFromToday, uniqueEmail } from "./workout-helpers";

/**
 * The app shell around every screen: design-token cascade, safe areas and the
 * bottom nav, 404/offline/resume behaviour and the service worker's offline
 * fallback. Phone-sized, Chromium engine (the only one installed).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use(iPhone);
test.describe.configure({ timeout: 90_000 });

async function onboardedUser(page: Page, label: string) {
  await loginAsTestUser(page, uniqueEmail(label));
  await completeOnboarding(page);
}

/** Renders probe elements with the given classes and returns one computed style prop of each. */
async function probe(page: Page, classes: string[], prop: "borderTopColor" | "backgroundColor" | "color") {
  return page.evaluate(
    ({ classes, prop }) =>
      classes.map((cls) => {
        const el = document.createElement("div");
        el.className = cls;
        document.body.appendChild(el);
        const value = getComputedStyle(el)[prop];
        el.remove();
        return value;
      }),
    { classes, prop },
  );
}

test("Tailwind border/bg utilities beat the global border rule and the dossier primitives", async ({ page }) => {
  await page.goto("/login");
  // A colored border renders in its own color, not the grey --border token.
  const [accentBorder, dangerBorder, plainBorder] = await probe(
    page,
    ["border-2 border-accent", "border-2 border-danger", "border"],
    "borderTopColor",
  );
  const [accentText, dangerText] = await probe(page, ["text-accent", "text-danger"], "color");
  expect(accentBorder).toBe(accentText);
  expect(dangerBorder).toBe(dangerText);
  expect(plainBorder).not.toBe(accentBorder); // the default hairline still applies

  // A bg utility on a Card (.reg-frame) / .panel-raised wins over the primitive's own surface.
  const [cardTinted, panelTinted, tint, cardPlain, surface] = await probe(
    page,
    ["reg-frame bg-accent-soft", "panel-raised bg-accent-soft", "bg-accent-soft", "reg-frame", "bg-surface"],
    "backgroundColor",
  );
  expect(cardTinted).toBe(tint);
  expect(panelTinted).toBe(tint);
  expect(cardPlain).toBe(surface);
});

test("form fields are 16px on phones (no iOS focus zoom) with a visible boundary", async ({ page }) => {
  await loginAsTestUser(page, uniqueEmail("shell-input"));
  await page.goto("/onboarding");
  const field = page.getByLabel("Nome de exibição");
  await expect(field).toBeVisible();
  const style = await field.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { fontSize: cs.fontSize, border: cs.borderTopColor };
  });
  expect(style.fontSize).toBe("16px");
  const [greyToken] = await probe(page, ["border border-border"], "borderTopColor");
  expect(style.border).not.toBe(greyToken);
});

test("the app main clears the bottom nav exactly (--nav-h)", async ({ page }) => {
  await onboardedUser(page, "shell-nav");
  await page.goto("/app/today");
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(nav).toBeVisible();
  const m = await page.evaluate(() => {
    const navEl = document.querySelector('nav[aria-label="Navegação principal"]')!.getBoundingClientRect();
    const main = getComputedStyle(document.querySelector("main")!);
    const probe = document.createElement("div");
    probe.style.height = "var(--nav-h)";
    document.body.appendChild(probe);
    const navH = probe.getBoundingClientRect().height;
    probe.remove();
    return { navHeight: navEl.height, navBottom: navEl.bottom, vh: window.innerHeight, mainPb: parseFloat(main.paddingBottom), navH };
  });
  expect(m.navBottom).toBeCloseTo(m.vh, 0);
  expect(m.navHeight).toBeCloseTo(m.navH, 0);
  expect(m.mainPb).toBeCloseTo(m.navH, 0);
});

test("a missing /app page is a pt-BR 404 inside the app shell, with ways back", async ({ page }) => {
  await onboardedUser(page, "shell-404");
  // Routes with a loading skeleton stream their 404 (status 200, marked noindex).
  await page.goto("/app/programs/does-not-exist");
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  await expect(page.getByRole("heading", { name: "Esta página não existe (ou saiu do ar)." })).toBeVisible();
  await expect(page.getByText("404 · Fora do mapa")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await expect(page).toHaveTitle(/Página não encontrada/);
  await page.getByRole("link", { name: "Ir para Hoje" }).click();
  await expect(page).toHaveURL(/\/app\/today/);

  // An unmatched /app URL (no route at all) also stays inside the shell.
  const unmatched = await page.goto("/app/isso-nao-existe");
  expect(unmatched?.status()).toBe(404);
  await expect(page.getByText("404 · Fora do mapa")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await expect(page).toHaveTitle("Página não encontrada · FGPOWER");

  // A stale workout link 404s at a focus-mode path (where the nav normally
  // hides): the nav comes back, exactly once.
  await page.goto("/app/workout/00000000-0000-0000-0000-000000000000");
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  await expect(page.getByText("404 · Fora do mapa")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await expect(page).toHaveTitle("Página não encontrada · FGPOWER");
});

test("an unmatched public URL is the pt-BR 404 in the marketing chrome", async ({ page }) => {
  const res = await page.goto("/isso-tambem-nao-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Esta página não existe (ou saiu do ar)." })).toBeVisible();
  await expect(page).toHaveTitle("Página não encontrada · FGPOWER");
});

/** Top of an element (viewport px), with scroll anchoring off so a layout shift can't hide. */
async function topOf(locator: Locator) {
  return locator.evaluate((el) => el.getBoundingClientRect().top);
}

test("offline shows a banner in the app shell, and an all-clear when the signal returns", async ({ page, context }) => {
  await onboardedUser(page, "shell-offline");
  await page.goto("/app/today");
  await page.evaluate(() => (document.documentElement.style.overflowAnchor = "none"));
  const status = page.getByRole("status").filter({ hasText: /Sem conexão|Conexão de volta/ });
  await expect(status).toHaveCount(0);
  const heading = page.getByRole("heading", { level: 1 }).first();
  const before = await topOf(heading);

  await context.setOffline(true);
  const strip = page.locator("[data-offline-banner]");
  await expect(strip).toHaveAttribute("data-offline-banner", "offline");
  await expect(page.getByText("Sem conexão", { exact: true })).toBeVisible();
  // The "sets stay on this device" reassurance belongs to the workout screen only.
  await expect(page.getByText("Séries ficam salvas no aparelho.")).toHaveCount(0);
  // Announced through the always-mounted live region.
  await expect(status).toHaveText("Sem conexão.");
  // It floats over the page, pinned to the top: nothing below it moves.
  const offlineBox = (await strip.boundingBox())!;
  expect(offlineBox.y).toBeCloseTo(0, 0);
  expect(await topOf(heading)).toBe(before);

  await context.setOffline(false);
  await expect(page.getByText("Conexão de volta", { exact: true })).toBeVisible();
  expect((await strip.boundingBox())!.height).toBe(offlineBox.height);
  expect(await topOf(heading)).toBe(before);
  await expect(page.getByText("Conexão de volta", { exact: true })).toBeHidden({ timeout: 6_000 });
  await expect(strip).toHaveCount(0);
  expect(await topOf(heading)).toBe(before);
});

test("on the live workout the offline strip sits on the bottom edge and the set table never moves", async ({
  page,
  context,
}) => {
  await newUserOnGd1(page, "shell-offline-workout");
  await startDayFromToday(page, SEGUNDA);
  await page.evaluate(() => (document.documentElement.style.overflowAnchor = "none"));
  const check = page.getByRole("button", { name: "Concluir série 2", exact: true });
  const header = page.getByRole("button", { name: "Finalizar" });
  const [checkTop, headerTop] = [await topOf(check), await topOf(header)];

  await context.setOffline(true);
  const strip = page.locator('[data-offline-banner="offline"]');
  await expect(strip).toBeVisible();
  const box = (await strip.boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(box.y + box.height).toBeCloseTo(vh, 0);
  expect(await topOf(check)).toBe(checkTop);
  expect(await topOf(header)).toBe(headerTop);

  await context.setOffline(false);
  await expect(page.locator('[data-offline-banner="back"]')).toBeVisible();
  expect(await topOf(check)).toBe(checkTop);
  expect(await topOf(header)).toBe(headerTop);
});

test("resuming the app after a long sleep re-fetches the page; a short trip doesn't", async ({ page }) => {
  await onboardedUser(page, "shell-resume");
  await page.goto("/app/today");
  await page.waitForLoadState("networkidle");

  const rscRequests: string[] = [];
  page.on("request", (req) => {
    if (req.headers()["rsc"] === "1" && new URL(req.url()).pathname === "/app/today") rscRequests.push(req.url());
  });
  // Fake the app going to the background and coming back `ms` later.
  const sleep = (ms: number) =>
    page.evaluate((ms) => {
      let state: DocumentVisibilityState = "hidden";
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      document.dispatchEvent(new Event("visibilitychange"));
      const realNow = Date.now.bind(Date);
      const offset = ms;
      Date.now = () => realNow() + offset;
      state = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    }, ms);

  await sleep(60_000);
  await page.waitForTimeout(1_000);
  expect(rscRequests).toHaveLength(0);

  await sleep(6 * 60_000);
  await expect.poll(() => rscRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);
});

test("the service worker serves a branded offline page for failed navigations", async ({ page, context }) => {
  await onboardedUser(page, "shell-sw");
  await page.goto("/app/today");
  // Registration is production-only in the app; register it by hand here.
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    // The real (v2) draft format: two rows the server hasn't confirmed, one it has.
    localStorage.setItem(
      "fg:workout-drafts:sess123",
      JSON.stringify({
        v: 2,
        rows: {
          a: { values: { weight: "40" }, dirty: true, savedAt: null },
          b: { values: { reps: "8" }, dirty: true, savedAt: null },
          c: { values: { weight: "42", reps: "8" }, done: true, doneAt: Date.now(), dirty: false, savedAt: Date.now() },
        },
      }),
    );
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.goto("/app/progress").catch(() => {});
  await expect(page.getByText("Sem sinal", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seus números estão salvos neste aparelho." })).toBeVisible();
  await expect(page.getByText("2 séries guardadas aqui, esperando o sinal.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar ao treino" })).toHaveAttribute("href", "/app/workout/sess123");
  expect(new URL(page.url()).pathname).toBe("/app/progress");

  // "Tentar de novo" reloads the requested URL (still offline → the fallback again).
  // Meanwhile every row got confirmed: the way back stays, the "waiting" line goes.
  await page.evaluate(() => {
    (window as unknown as { __before: boolean }).__before = true;
    const confirmed = { values: { weight: "40" }, dirty: false, savedAt: Date.now() };
    localStorage.setItem("fg:workout-drafts:sess123", JSON.stringify({ v: 2, rows: { a: confirmed } }));
  });
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __before?: boolean }).__before ?? false))
    .toBe(false);
  await expect(page.getByText("Sem sinal", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar ao treino" })).toHaveAttribute("href", "/app/workout/sess123");
  await expect(page.getByText(/guardadas? aqui/)).toBeHidden();

  // When the signal returns, the fallback reloads itself into the real page.
  await context.setOffline(false);
  await expect(page.getByRole("heading", { level: 1, name: "Progresso" })).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/app\/progress/);
  await page.evaluate(async () => {
    localStorage.removeItem("fg:workout-drafts:sess123");
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  });
});
