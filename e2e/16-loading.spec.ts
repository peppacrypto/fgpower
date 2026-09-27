import { test, expect, devices, type CDPSession, type Page } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";
import { SEGUNDA, newUserOnGd1, startDayFromToday, uniqueEmail } from "./workout-helpers";

/**
 * Tap feedback and loading screens (Batch 2: W-024). On a phone network a tab
 * or card used to show nothing for up to 2 s: the old page and the old tab
 * stayed lit until the next page arrived. Now the tapped tab lights at once,
 * each screen has a dossier-style skeleton while the server renders it, and
 * cards show a pressed state.
 */

// Drop defaultBrowserType (WebKit): only Chromium is installed for the suite.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use(iPhone);
test.describe.configure({ timeout: 90_000 });

const bottomNav = (page: Page) => page.getByRole("navigation", { name: "Navegação principal" });
const tab = (page: Page, label: string) => bottomNav(page).getByRole("link", { name: label, exact: true });
/** The tab's face carries data-lit while it is the one shown as current (or being opened). */
const lit = (page: Page, label: string) => tab(page, label).locator('[data-lit="true"]');

async function onboarded(page: Page, label: string) {
  await loginAsTestUser(page, uniqueEmail(label));
  await completeOnboarding(page);
}

/** A slow phone connection: the loading shell arrives well before the page. */
async function slowNetwork(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: 20 * 1024,
    uploadThroughput: 20 * 1024,
  });
  return cdp;
}
async function fastNetwork(cdp: CDPSession) {
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
}

test("a tapped tab lights at once, and the screen's skeleton stands in until the page arrives", async ({ page }) => {
  await onboarded(page, "loading-tabs");
  // Warm the route (the dev server compiles on first hit), then start from Today.
  await page.goto("/app/exercises");
  await page.goto("/app/today");
  await expect(lit(page, "Hoje")).toHaveCount(1);

  // Hold the navigation's server response: nothing has arrived yet.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => url.pathname === "/app/exercises",
    async (route) => {
      await held;
      await route.continue();
    },
  );
  await tab(page, "Exercícios").click();
  // Before any byte of the next page: the tapped tab is lit and Today's lets go.
  await expect(lit(page, "Exercícios")).toHaveCount(1, { timeout: 1_000 });
  await expect(lit(page, "Hoje")).toHaveCount(0);
  // aria-current stays on the page actually shown.
  await expect(tab(page, "Hoje")).toHaveAttribute("aria-current", "page");

  // On a slow connection the skeleton (with the real title) shows before the content.
  const cdp = await slowNetwork(page);
  release();
  const skeleton = page.locator('[data-skeleton="os exercícios"]');
  await expect(skeleton).toBeVisible({ timeout: 20_000 });
  // A status region that fills in after it mounts (a region inserted with its
  // text is usually not read out), never held silent by aria-busy.
  await expect(skeleton).toHaveAttribute("role", "status");
  await expect(skeleton).not.toHaveAttribute("aria-busy", /.*/);
  await expect(skeleton).toContainText("Carregando os exercícios…");
  await expect(page).toHaveURL(/\/app\/exercises$/);
  await expect(tab(page, "Exercícios")).toHaveAttribute("aria-current", "page");
  await fastNetwork(cdp);
  await page.unroute((url) => url.pathname === "/app/exercises");
  await expect(page.getByRole("heading", { level: 1, name: "Exercícios" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-skeleton]")).toHaveCount(0);
  await expect(lit(page, "Exercícios")).toHaveCount(1);
  await expect(lit(page, "Hoje")).toHaveCount(0);
});

test("the workout skeleton draws the set table on the real grid", async ({ page }) => {
  await newUserOnGd1(page, "loading-workout");
  const sessionId = await startDayFromToday(page, SEGUNDA);
  await expect(page.getByLabel("Série 1 — kg", { exact: true })).toBeVisible({ timeout: 30_000 });
  const realColumns = await page.getByLabel("Série 1 — kg", { exact: true }).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), width: Math.round(r.width), top: Math.round(r.top + scrollY) };
  });

  // Back on Today, "Continuar" opens the running workout (a client-side navigation).
  await page.goto("/app/today");
  await page.waitForLoadState("networkidle");
  const cdp = await slowNetwork(page);
  await page.locator(`a[href="/app/workout/${sessionId}"]`).first().click();
  const skeleton = page.locator('[data-skeleton="o treino"]');
  await expect(skeleton).toBeVisible({ timeout: 20_000 });
  await expect(skeleton.getByText("Série", { exact: true })).toBeVisible();
  // The kg column of the skeleton sits where the real kg box will be.
  const kgBone = skeleton.locator("[data-bone-row] .sk").first();
  const boneBox = await kgBone.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), width: Math.round(r.width), top: Math.round(r.top + scrollY) };
  });
  expect(Math.abs(boneBox.left - realColumns.left)).toBeLessThanOrEqual(2);
  expect(Math.abs(boneBox.width - realColumns.width)).toBeLessThanOrEqual(2);
  // …and at its height: the blocks above the table (note, first-workout
  // coaching, warm-up line) have bones too, so the table doesn't jump down.
  expect(Math.abs(boneBox.top - realColumns.top)).toBeLessThanOrEqual(40);
  // Focus mode: no bottom nav over the workout, even while it loads.
  await expect(bottomNav(page)).toHaveCount(0);
  await fastNetwork(cdp);
  await expect(page.getByLabel("Série 1 — kg", { exact: true })).toBeVisible({ timeout: 30_000 });
});

test("skeleton bones hold still when the user asks for reduced motion", async ({ page }) => {
  await onboarded(page, "loading-motion");
  await page.goto("/app/today");
  // A bone as the skeletons draw it (whether a route's skeleton stays up long
  // enough to inspect depends on how fast the server answers).
  const animation = () =>
    page.evaluate(() => {
      const bone = document.createElement("div");
      bone.className = "sk h-4 w-24";
      document.body.append(bone);
      const name = getComputedStyle(bone).animationName;
      bone.remove();
      return name;
    });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await animation()).toBe("sk-sheen");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await animation()).toBe("none");
});

test("a pressed card shows it: the marks extend in accent and the panel takes an ink plate", async ({ page }) => {
  await onboarded(page, "loading-press");
  await page.goto("/app/exercises");
  const card = page.locator("a[href^='/app/exercises/'] .reg-frame.is-link").first();
  await expect(card).toBeVisible();
  const style = () =>
    card.evaluate((el) => ({
      mark: getComputedStyle(el, "::before").borderTopColor,
      plate: getComputedStyle(el).backgroundImage,
      accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
    }));
  const rest = await style();
  expect(rest.plate).toBe("none");

  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 40);
  await page.mouse.down();
  await expect.poll(async () => (await style()).plate).not.toBe("none");
  const pressed = await style();
  expect(pressed.mark).not.toBe(rest.mark);
  // Moving off before releasing cancels the tap (no navigation).
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/app\/exercises$/);
});

/** Counts, from now on, every DOM change that leaves a skeleton on the page. */
async function watchSkeletons(page: Page) {
  // The page's own skeleton may outlive the "load" event (streamed content
  // is revealed in batches): wait for the real page first.
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(() => {
    const w = window as unknown as { skeletons: number };
    w.skeletons = 0;
    new MutationObserver(() => {
      if (document.querySelector("[data-skeleton]")) w.skeletons++;
    }).observe(document.body, { childList: true, subtree: true });
  });
  return () => page.evaluate(() => (window as unknown as { skeletons: number }).skeletons);
}

test("typing in a search or switching a period keeps the page (no skeleton, focus kept)", async ({ page }) => {
  await onboarded(page, "loading-search");
  await page.goto("/app/exercises");
  await expect(page.getByRole("heading", { level: 1, name: "Exercícios" })).toBeVisible({ timeout: 30_000 });
  let skeletons = await watchSkeletons(page);
  const search = page.getByRole("searchbox").first();
  await search.click();
  await search.pressSequentially("supino", { delay: 80 });
  await expect(page).toHaveURL(/q=supino/);
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("supino");
  expect(await skeletons()).toBe(0);

  // Progress: a period chip swaps the numbers in place.
  await page.goto("/app/progress");
  await expect(page.getByRole("heading", { level: 1, name: "Progresso" })).toBeVisible({ timeout: 30_000 });
  skeletons = await watchSkeletons(page);
  await page.getByRole("link", { name: "4 semanas", exact: true }).click();
  await expect(page).toHaveURL(/period=4w/);
  await expect(page.getByRole("link", { name: "4 semanas", exact: true })).toHaveClass(/border-accent/);
  expect(await skeletons()).toBe(0);
});

test("a page nested under a list gets its own skeleton at once, from the top — not the list's", async ({ page }) => {
  await onboarded(page, "loading-nested");
  // Warm both routes (the dev server compiles on first hit).
  await page.goto("/app/programs/templates/gd-1");
  await page.goto("/app/programs");
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, { timeout: 30_000 });
  // Record every skeleton that shows from here on.
  await page.evaluate(() => {
    const w = window as unknown as { seen: string[] };
    w.seen = [];
    new MutationObserver(() => {
      for (const el of document.querySelectorAll("[data-skeleton]")) {
        const label = el.getAttribute("data-skeleton")!;
        if (!w.seen.includes(label)) w.seen.push(label);
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  // A card far down the shelf: the list is scrolled when it's tapped.
  const card = page.locator("a[href^='/app/programs/templates/']").last();
  await card.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(200);

  const cdp = await slowNetwork(page);
  await card.click();
  const skeleton = page.locator('[data-skeleton="o programa"]');
  await expect(skeleton).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await fastNetwork(cdp);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-skeleton]")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { seen: string[] }).seen)).toEqual(["o programa"]);
});

test("the unmatched-URL catch-all keeps a real 404, a bare /app still redirects, a missing record is a noindex soft 404", async ({ page }) => {
  await onboarded(page, "loading-status");
  // No loading.tsx at the /app root: a streamed response would answer 200.
  const missing = await page.goto("/app/isso-nao-existe");
  expect(missing?.status()).toBe(404);
  await expect(page.getByText("404 · Fora do mapa")).toBeVisible();
  const bare = await page.request.get("/app", { maxRedirects: 0 });
  expect(bare.status()).toBe(307);
  expect(bare.headers()["location"]).toMatch(/\/app\/today$/);

  // A missing record under a skeleton streams, so it is a soft 404 (Next's
  // documented trade-off): the same branded panel and one nav, kept out of
  // search results by noindex.
  for (const url of ["/app/programs/does-not-exist", "/app/workout/00000000-0000-0000-0000-000000000000"]) {
    await page.goto(url);
    await expect(page.getByText("404 · Fora do mapa")).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    await expect(bottomNav(page)).toHaveCount(1);
    await expect(page.locator("[data-skeleton]")).toHaveCount(0);
  }
});
