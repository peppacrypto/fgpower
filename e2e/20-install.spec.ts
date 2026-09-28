import { devices, expect, test, type Page } from "@playwright/test";
import { finishAndSave, newUserOnGd1, recordSet, SEGUNDA, startDayFromToday } from "./workout-helpers";

/**
 * "Add to home screen": the manifest (identity, scope, shortcuts, screenshots)
 * and the install card — one ask, after the first finished workout, never in
 * the installed app, gone for good once closed. iOS gets two share-sheet
 * steps; Android the browser's own install dialog (beforeinstallprompt).
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType: _i, ...iPhone } = devices["iPhone 13"];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType: _p, ...pixel } = devices["Pixel 7"];
test.use({ ...iPhone, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 120_000 });

const TITLE = "Tenha a FGPOWER na tela inicial";
const card = (page: Page) => page.locator("[data-install-card]");

/** Width × height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer) {
  expect(buf.subarray(1, 4).toString("latin1")).toBe("PNG");
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

/**
 * Nothing on the page is wider than the phone. Measured against the device
 * width: a mobile browser zooms a too-wide page out, and innerWidth grows with it.
 */
async function expectNoSideScroll(page: Page) {
  const overflow = (await page.evaluate(() => document.documentElement.scrollWidth)) - page.viewportSize()!.width;
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * Nothing to tap below the card. It mounts after hydration (on Android,
 * whenever the browser offers its dialog), so anything under it would jump
 * by its height — a mis-tap on "Iniciar" waiting to happen.
 */
async function expectNothingToTapBelowCard(page: Page) {
  const below = await page.evaluate(() => {
    const card = document.querySelector("[data-install-card]")!;
    const top = card.getBoundingClientRect().top;
    const pinned = (el: Element | null): boolean => {
      for (; el; el = el.parentElement) {
        const p = getComputedStyle(el).position;
        if (p === "fixed" || p === "sticky") return true;
      }
      return false;
    };
    return [...document.querySelectorAll("a[href], button")]
      .filter((el) => !card.contains(el) && !pinned(el) && el.getBoundingClientRect().top >= top)
      .map((el) => (el.textContent ?? "").trim());
  });
  expect(below).toEqual([]);
}

/** A new user with one finished workout, left on its summary. */
async function oneWorkoutDone(page: Page, label: string) {
  await newUserOnGd1(page, label);
  await startDayFromToday(page, SEGUNDA);
  await recordSet(page, 1, "40", "10");
  await finishAndSave(page);
}

/** Hands the page a fake Chromium install dialog that answers `outcome`; counts prompt() calls. */
async function offerInstall(page: Page, outcome: "accepted" | "dismissed") {
  await page.evaluate((outcome) => {
    const w = window as unknown as { __prompts: number };
    w.__prompts = 0;
    const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & Record<string, unknown>;
    e.prompt = () => {
      w.__prompts += 1;
      return Promise.resolve();
    };
    e.userChoice = Promise.resolve({ outcome, platform: "web" });
    window.dispatchEvent(e);
  }, outcome);
}
const prompts = (page: Page) => page.evaluate(() => (window as unknown as { __prompts?: number }).__prompts ?? 0);

test("the manifest: identity, whole-site scope, pt-BR, shortcuts and phone screenshots that exist", async ({
  page,
}) => {
  const res = await page.request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const m = await res.json();
  // The id equals the start_url (the implicit id before it was set): existing installs keep their identity.
  expect(m.id).toBe("/app/today");
  expect(m.start_url).toBe("/app/today");
  expect(m.scope).toBe("/");
  expect(m.lang).toBe("pt-BR");
  expect(m.display).toBe("standalone");
  expect(m.categories).toEqual(expect.arrayContaining(["health", "fitness"]));
  expect(m.shortcuts.map((s: { name: string; url: string }) => [s.name, s.url])).toEqual([
    ["Treino de hoje", "/app/today"],
    ["Progresso", "/app/progress"],
    ["Histórico", "/app/history"],
  ]);
  // Full-bleed plates with the glyph in the safe zone: offered as maskable too,
  // so launchers shape them instead of shrinking them into a white circle.
  for (const s of m.shortcuts as { icons: { src: string; purpose: string }[] }[]) {
    expect(s.icons.map((i) => i.purpose).sort()).toEqual(["any", "maskable"]);
    expect(new Set(s.icons.map((i) => i.src)).size).toBe(1);
  }

  // Every image the manifest names is served, at the size it declares.
  const images: { src: string; sizes: string }[] = [
    ...m.icons,
    ...m.shortcuts.flatMap((s: { icons: { src: string; sizes: string }[] }) => s.icons),
    ...m.screenshots,
  ];
  for (const img of images) {
    const r = await page.request.get(img.src);
    expect(r.ok(), img.src).toBe(true);
    expect(pngSize(await r.body()), img.src).toBe(img.sizes);
  }
  // Chrome's richer install dialog: narrow shots, ≥ 320px, long side ≤ 2.3 × short side.
  expect(m.screenshots.length).toBeGreaterThanOrEqual(1);
  for (const s of m.screenshots) {
    expect(s.form_factor).toBe("narrow");
    expect(s.label).toBeTruthy();
    const [w, h] = s.sizes.split("x").map(Number);
    expect(Math.min(w, h)).toBeGreaterThanOrEqual(320);
    expect(Math.max(w, h) / Math.min(w, h)).toBeLessThanOrEqual(2.3);
  }
});

test.describe("iPhone (Safari)", () => {
  test("no ask before a workout; after the first one, two steps on the summary and Today; closing it sticks", async ({
    page,
  }) => {
    await newUserOnGd1(page, "install-ios");
    await page.goto("/app/today");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(card(page)).toHaveCount(0);

    await startDayFromToday(page, SEGUNDA);
    await recordSet(page, 1, "40", "10");
    await finishAndSave(page);

    // Summary: the ask, as two share-sheet steps.
    await expect(card(page)).toHaveAttribute("data-install-card", "ios-safari");
    await expect(card(page).getByRole("heading", { name: TITLE })).toBeVisible();
    const steps = card(page).getByRole("list", { name: "Como adicionar" }).getByRole("listitem");
    await expect(steps).toHaveText([/Toque em Compartilhar/, /Escolha Adicionar à Tela de Início/]);
    await expect(card(page).getByText(/barra do Safari/)).toBeVisible();
    await expectNoSideScroll(page);
    await expectNothingToTapBelowCard(page);

    // Today too — and closing it there closes it everywhere on this device.
    await page.goto("/app/today");
    await expect(card(page).getByRole("heading", { name: TITLE })).toBeVisible();
    await card(page).getByRole("button", { name: "Agora não" }).click();
    await expect(card(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("fg:install-card"))).toBe("dismissed");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(card(page)).toHaveCount(0);
  });

  test("never inside the installed app (standalone), nor in an in-app browser", async ({ browser }) => {
    test.setTimeout(200_000);
    const installed = await browser.newContext({ ...iPhone, timezoneId: "America/Sao_Paulo" });
    // iOS's home-screen web app flag.
    await installed.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
    const page = await installed.newPage();
    await oneWorkoutDone(page, "install-standalone");
    await page.goto("/app/today");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    await installed.close();

    const instagram = await browser.newContext({
      ...iPhone,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone14,5; iOS 17_5; pt_BR; pt; scale=3.00; 1170x2532; 614117039)",
    });
    const page2 = await instagram.newPage();
    await oneWorkoutDone(page2, "install-inapp");
    await page2.waitForLoadState("networkidle");
    await expect(card(page2)).toHaveCount(0);
    await page2.goto("/app/today");
    await page2.waitForLoadState("networkidle");
    await expect(page2.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(card(page2)).toHaveCount(0);
    await instagram.close();
  });

  test("on Today it comes after the day list and the records: nothing below it moves when it appears", async ({
    page,
  }) => {
    await oneWorkoutDone(page, "install-today-order");
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/app/today");
      await expect(card(page).getByRole("heading", { name: TITLE })).toBeVisible();
      await expect(page.getByText("Treinos do programa")).toBeVisible();
      await expectNothingToTapBelowCard(page);
    }
  });

  test("fits a 320px phone, light and dark", async ({ page }) => {
    await oneWorkoutDone(page, "install-320");
    await page.setViewportSize({ width: 320, height: 640 });
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/app/today");
      await expect(card(page).getByRole("heading", { name: TITLE })).toBeVisible();
      await expectNoSideScroll(page);
      const box = (await card(page).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      // The close button is a real touch target.
      const close = (await card(page).getByRole("button", { name: "Agora não" }).boundingBox())!;
      expect(close.height).toBeGreaterThanOrEqual(36);
    }
  });
});

test.describe("Android (Chrome)", () => {
  test.use({ ...pixel, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
  // Only the test's own (untrusted) dialogs reach the app: a real one from the
  // browser would make "no dialog yet" depend on Chromium's installability checks.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      window.addEventListener(
        "beforeinstallprompt",
        (e) => {
          if (e.isTrusted) e.stopImmediatePropagation();
        },
        true,
      ),
    );
  });

  test("the browser's install dialog, stashed on any page, opens from the card; installed means gone", async ({
    page,
  }) => {
    await oneWorkoutDone(page, "install-android");
    // No dialog from the browser (e.g. already installed): nothing to offer.
    await page.goto("/app/today");
    await page.waitForLoadState("networkidle");
    await expect(card(page)).toHaveCount(0);

    // The browser offers it on another screen; the card picks it up on Today.
    await page.goto("/app/history");
    await page.waitForLoadState("networkidle");
    await offerInstall(page, "accepted");
    // A client-side navigation (same page, same stash). Dispatched: in dev, Next's
    // indicator sits over the first tab at this viewport.
    await page
      .getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link", { name: "Hoje" })
      .dispatchEvent("click");
    await expect(page).toHaveURL(/\/app\/today/);
    await expect(card(page)).toHaveAttribute("data-install-card", "prompt");
    await expect(card(page).getByRole("heading", { name: TITLE })).toBeVisible();
    await expectNoSideScroll(page);

    // The live region is there, empty, before the answer: filled (not inserted
    // full) on acceptance, so screen readers announce it.
    const status = page.locator("[data-install-status]");
    await expect(status).toHaveRole("status");
    await expect(status).toHaveText("");
    const statusNode = await status.elementHandle();
    await card(page).getByRole("button", { name: "Instalar app" }).click();
    await expect(page.getByRole("status").filter({ hasText: "App instalado" })).toBeVisible();
    expect(await statusNode!.evaluate((el) => el.isConnected && el.textContent)).toMatch(/App instalado/);
    expect(await prompts(page)).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem("fg:install-card"))).toBe("installed");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await offerInstall(page, "accepted");
    await expect(card(page)).toHaveCount(0);
  });

  test("'Agora não' and a no to the browser's dialog both stick", async ({ page }) => {
    await oneWorkoutDone(page, "install-android-no");
    await page.goto("/app/today");
    await page.waitForLoadState("networkidle");
    await offerInstall(page, "dismissed");
    await card(page).getByRole("button", { name: "Instalar app" }).click();
    await expect(card(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("fg:install-card"))).toBe("dismissed");

    await page.evaluate(() => localStorage.removeItem("fg:install-card"));
    await page.reload();
    await page.waitForLoadState("networkidle");
    await offerInstall(page, "accepted");
    await card(page).getByRole("button", { name: "Agora não" }).click();
    await expect(card(page)).toHaveCount(0);
    expect(await prompts(page)).toBe(0);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await offerInstall(page, "accepted");
    await expect(card(page)).toHaveCount(0);
  });
});
