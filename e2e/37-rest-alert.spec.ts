import "dotenv/config";
import { test, expect, devices, type BrowserContext, type Page, type Request } from "@playwright/test";
import { hasDb, pool as db } from "./fixtures";
import { SEGUNDA, expectSetSaved, newUserOnGd1, startDayFromToday } from "./workout-helpers";

/*
 * What Fernanda asked for after her first workout on an iPhone (Chrome for
 * iOS): the movement shown while she trains, and an alert at the end of the
 * rest. Every exercise with a figure shows it above its sets (a notch smaller
 * for gym moves), the first set still within reach; a rest asks the server
 * for a notification at its end on a device with notifications on, and takes
 * it back when the rest is skipped; an iPhone whose browser can't sound the
 * end of a rest is told how to get the notification. (Playwright plays no
 * H.264 and receives no push: the requests and the screens are what's checked.)
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType: _a, ...iPhone } = devices["iPhone 13"];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType: _b, ...pixel } = devices["Pixel 7"];
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1";
const LOCALE = { timezoneId: "America/Sao_Paulo", locale: "pt-BR" };
const ALERT = "/api/workout/rest-alert";

test.describe.configure({ timeout: 150_000 });
test.beforeEach(() => {
  test.skip(!hasDb, "needs the local dev database");
});

/** This browser's push stack: a worker registration whose subscription is `endpoint` (null: none), and the permission. */
async function stubPush(context: BrowserContext, o: { endpoint: string | null; permission: string; standalone?: boolean }) {
  await context.addInitScript((opts) => {
    const subscription = opts.endpoint
      ? {
          endpoint: opts.endpoint,
          options: { userVisibleOnly: true, applicationServerKey: null },
          toJSON: () => ({ endpoint: opts.endpoint, expirationTime: null, keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } }),
          unsubscribe: async () => true,
        }
      : null;
    const registration = {
      pushManager: { getSubscription: async () => subscription, subscribe: async () => subscription },
      getNotifications: async () => [],
      showNotification: async () => undefined,
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: async () => registration,
        register: async () => registration,
        ready: Promise.resolve(registration),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
    if (opts.standalone) Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    (window as unknown as { PushManager: unknown }).PushManager ??= function PushManager() {};
    (window as unknown as { Notification: unknown }).Notification = class {
      static get permission() {
        return opts.permission;
      }
      static async requestPermission() {
        return opts.permission;
      }
    };
  }, o);
}

async function userOfSession(sessionId: string): Promise<string> {
  const { rows } = await db.query<{ userId: string }>(`select "userId" from "WorkoutSession" where id = $1`, [sessionId]);
  return rows[0].userId;
}

async function doSet(page: Page, n: number) {
  await page.getByLabel(`Série ${n} — kg`, { exact: true }).fill("20");
  await page.getByLabel(`Série ${n} — repetições`, { exact: true }).fill("10");
  await page.getByRole("button", { name: `Concluir série ${n}`, exact: true }).click();
  await expectSetSaved(page, `Série ${n}`);
}

const isAlert = (method: string) => (r: Request) => new URL(r.url()).pathname === ALERT && r.method() === method;

test.describe("the figure", () => {
  test.use({ ...iPhone, ...LOCALE });

  test("a gym exercise shows its figure above the sets, the first set within a short scroll, a still for less motion", async ({ page }) => {
    await newUserOnGd1(page, "figure-gym");
    await startDayFromToday(page, SEGUNDA);
    const figure = page.locator('[data-workout-demo="compact"]');
    await expect(figure).toBeVisible();
    const shown = figure.locator(":is(video, img):visible").first();
    await expect(shown).toHaveAttribute("src", /\/exercises\/[^/]+\/(f\d+-(loop\.mp4|start\.webp)|fig-(loop|start)\.webp)$/);
    const box = (await shown.boundingBox())!;
    // Seen without a tap (far from the 48 px thumbnail), compact enough for the sets below.
    expect(box.height).toBeGreaterThan(100);
    expect(box.height).toBeLessThan(190);
    // On a 664 px screen, on a first workout (its coaching box and warm-up line above the table), the
    // first set's boxes are a short scroll away: under a tenth of the screen.
    const kg1 = (await page.getByLabel("Série 1 — kg", { exact: true }).boundingBox())!;
    expect(kg1.y + kg1.height).toBeLessThanOrEqual(page.viewportSize()!.height * 1.1);
    // A tap opens the technique sheet.
    await figure.click();
    await expect(page.locator("[data-technique-sheet]")).toBeVisible();
    await page.locator("[data-technique-sheet]").getByRole("button", { name: "Voltar ao treino" }).click();

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(figure.locator("img:visible")).toHaveCount(1);
    await expect(figure.locator("video:visible")).toHaveCount(0);
  });
});

test.describe("on a phone with notifications on", () => {
  test.use({ ...pixel, ...LOCALE });

  test("a rest asks for its notification at the end, ±15 s replaces it, skipping takes it back", async ({ page, context }) => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/e2e-rest-${Date.now()}`;
    await stubPush(context, { endpoint, permission: "granted" });
    await newUserOnGd1(page, "rest-alert");
    const sessionId = await startDayFromToday(page, SEGUNDA);
    await db.query(`insert into "PushSubscription" (id, "userId", endpoint, p256dh, auth) values ($1, $2, $3, $4, $5)`, [
      `rest-${Date.now()}`,
      await userOfSession(sessionId),
      endpoint,
      "B".repeat(87),
      "a".repeat(22),
    ]);
    const exercise = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();

    const posted = page.waitForRequest(isAlert("POST"));
    const answered = page.waitForResponse((r) => isAlert("POST")(r.request()));
    await doSet(page, 1);
    const body = (await posted).postDataJSON();
    expect(body).toMatchObject({ sessionId, endpoint, kind: "rest", next: `Série 2 · ${exercise}` });
    expect(body.inMs).toBeGreaterThan(20_000);
    expect(await (await answered).json()).toEqual({ scheduled: true });
    // No hint on a phone that beeps.
    await expect(page.locator("[data-rest-alert-hint]")).toHaveCount(0);

    const again = page.waitForRequest(isAlert("POST"));
    await page.getByRole("button", { name: "Mais 15 segundos" }).click();
    expect((await again).postDataJSON().inMs).toBeGreaterThan(body.inMs + 10_000);

    const taken = page.waitForResponse((r) => isAlert("DELETE")(r.request()));
    await page.getByRole("button", { name: "Pular descanso" }).click();
    expect(await (await taken).json()).toEqual({ cancelled: true });
  });
});

test.describe("on an iPhone, in Chrome", () => {
  test.use({ ...iPhone, userAgent: CHROME_IOS, ...LOCALE });

  test("the rest bar says how to get the alert (install, then notifications), and stays closed once closed", async ({ page }) => {
    const alerts: string[] = [];
    page.on("request", (r) => {
      if (new URL(r.url()).pathname === ALERT) alerts.push(r.method());
    });
    await newUserOnGd1(page, "rest-hint");
    await startDayFromToday(page, SEGUNDA);
    await doSet(page, 1);
    const hint = page.locator('[data-rest-alert-hint="install"]');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("Adicionar à Tela de Início");
    // The first workout: notifications turn on after it.
    await expect(hint).toContainText("depois deste treino");
    // Clear of the bar's own buttons.
    await expect(page.getByRole("button", { name: "Pular descanso" })).toBeVisible();
    await hint.getByRole("button", { name: "Fechar dica do aviso no fim do descanso" }).click();
    await expect(hint).toHaveCount(0);

    await page.getByRole("button", { name: "Pular descanso" }).click();
    await doSet(page, 2);
    await expect(page.locator("[data-rest-state]")).toBeVisible();
    await expect(page.locator("[data-rest-alert-hint]")).toHaveCount(0);
    // Nothing to schedule on a device with no subscription.
    expect(alerts).toEqual([]);
  });
});

test.describe("on an iPhone, installed, notifications not on yet", () => {
  test.use({ ...iPhone, ...LOCALE });

  test("the hint links to the switch in Configurações", async ({ page, context }) => {
    await stubPush(context, { endpoint: null, permission: "default", standalone: true });
    await newUserOnGd1(page, "rest-hint-enable");
    const sessionId = await startDayFromToday(page, SEGUNDA);
    // A workout already finished: notifications can be turned on.
    await db.query(
      `insert into "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "updatedAt")
       values ($1, $2, 'Antigo', 'COMPLETED', now() - interval '3 days', now() - interval '3 days', now())`,
      [`rest-hint-${Date.now()}`, await userOfSession(sessionId)],
    );
    await page.reload();
    await doSet(page, 1);
    const hint = page.locator('[data-rest-alert-hint="enable"]');
    await expect(hint).toBeVisible();
    await expect(hint).not.toContainText("depois deste treino");
    const link = hint.getByRole("link", { name: "Ativar em Configurações" });
    await expect(link).toHaveAttribute("href", "/app/settings#lembretes");
    await link.click();
    await expect(page).toHaveURL(/\/app\/settings#lembretes$/);
    await expect(page.getByText("Notificações neste aparelho")).toBeVisible();
    await expect(page.getByText("Notificação no fim do descanso")).toBeVisible();
  });
});
