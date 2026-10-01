import { chromium, devices, expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { loginAsTestUser, readOutbox, revokeSessions, sql, sqlText, userIdOf } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";
import { finishAndSave, newUserOnGd1, QUINTA, recordSet, SEGUNDA, startDayFromToday, uniqueEmail } from "./workout-helpers";

/**
 * Re-engagement (decision 8, W-017): the post-workout ask, Settings →
 * Lembretes, the tick (non-production test route, one user, fake push
 * transport), tracked taps and the digest's unsubscribe, and the service
 * worker's push and notificationclick handlers.
 *
 * Headless Chromium can't hold a real push subscription, so the browser's
 * Notification / serviceWorker / PushManager are stubbed with an
 * allow-listed FCM endpoint (kept in localStorage, so it survives a reload).
 * The worker's handlers run for real in the last test (CDP delivers the push).
 *
 * Every answer on the summary is checked again after a server re-render of
 * the page (R5): in real use the session cookie's refresh inside any action
 * re-renders it, and the answered ask must keep its confirmation.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType: _p, ...pixel } = devices["Pixel 7"];
test.use({ ...pixel, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 180_000 });

const DAY_MS = 86_400_000;

/** Stubs the browser's push stack: permission, a worker registration and one subscription. */
async function stubPush(context: BrowserContext) {
  await context.addInitScript(() => {
    const store = {
      get: (k: string) => window.localStorage.getItem(`e2e-push:${k}`),
      set: (k: string, v: string | null) =>
        v === null ? window.localStorage.removeItem(`e2e-push:${k}`) : window.localStorage.setItem(`e2e-push:${k}`, v),
    };
    const makeSub = (endpoint: string, key: number[]) => ({
      endpoint,
      options: { userVisibleOnly: true, applicationServerKey: new Uint8Array(key).buffer },
      toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } }),
      unsubscribe: async () => {
        store.set("sub", null);
        return true;
      },
    });
    const pushManager = {
      getSubscription: async () => {
        const raw = store.get("sub");
        if (!raw) return null;
        const { endpoint, key } = JSON.parse(raw);
        return makeSub(endpoint, key);
      },
      subscribe: async (opts: { applicationServerKey: Uint8Array }) => {
        const endpoint = `https://fcm.googleapis.com/fcm/send/e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const key = Array.from(new Uint8Array(opts.applicationServerKey));
        store.set("sub", JSON.stringify({ endpoint, key }));
        return makeSub(endpoint, key);
      },
    };
    const registration = { pushManager, getNotifications: async () => [], showNotification: async () => undefined };
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
    (window as unknown as { PushManager: unknown }).PushManager ??= function PushManager() {};
    (window as unknown as { Notification: unknown }).Notification = class {
      static get permission() {
        return store.get("permission") ?? "default";
      }
      static async requestPermission() {
        const answer = store.get("answer") ?? "granted";
        store.set("permission", answer);
        return answer;
      }
    };
  });
}

/** 18:05 (or hh:mm) São Paulo on `weekday` (1 = Monday) of NEXT week. */
function nextWeek(weekday: number, h: number, m = 0): string {
  const now = new Date();
  const sp = new Date(now.getTime() - 3 * 3_600_000); // São Paulo wall clock (UTC-3, no DST)
  const daysToMonday = ((8 - sp.getUTCDay()) % 7) || 7;
  const monday = Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() + daysToMonday);
  return new Date(monday + (weekday - 1) * DAY_MS + (h + 3) * 3_600_000 + m * 60_000).toISOString();
}

async function tick(page: Page, userId: string, now: string) {
  const res = await page.request.post("/api/test/reminders", { data: { userId, now } });
  expect(res.ok()).toBe(true);
  return res.json();
}

const ask = (page: Page) => page.locator("[data-reminder-ask]");
const status = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text });

/** A server re-render of the page on screen (router.refresh()), waited for until it lands. */
async function serverRerender(page: Page) {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "GET" && r.request().headers()["rsc"] === "1"),
    page.evaluate(() => (window as unknown as { next: { router: { refresh(): void } } }).next.router.refresh()),
  ]);
  await page.waitForLoadState("networkidle");
}

/** Signed out meanwhile (R5): the inline "Sua sessão expirou … Entrar", or the sign-in page — both back to `path`. */
async function expectSessionExpired(page: Page, path: string, scope: Locator = page.locator("body")) {
  const alert = scope.getByRole("alert").filter({ hasText: "Sua sessão expirou — entre de novo." });
  await expect(async () => {
    const url = new URL(page.url());
    const onLogin = url.pathname === "/login" && url.searchParams.get("sessao") === "expirada" && url.searchParams.get("next") === path;
    // Bounded: the page can leave for /login right after the alert shows (better-auth's cookie write
    // re-renders it), and an unbounded read would wait out the whole toPass on a link that's gone.
    const inline =
      (await alert.isVisible()) &&
      ((await alert.getByRole("link", { name: "Entrar" }).getAttribute("href", { timeout: 1000 })) ?? "").includes(
        encodeURIComponent(path),
      );
    expect(onLogin || inline).toBe(true);
  }).toPass({ timeout: 15_000 });
}

async function firstWorkout(page: Page, label: string, day = SEGUNDA) {
  await newUserOnGd1(page, label);
  await startDayFromToday(page, day);
  await recordSet(page, 1, "40", "10");
  await finishAndSave(page);
  return userIdOf(page);
}

test("the ask after a workout turns reminders (and the digest) on; Settings shows the device, the hour and the digest", async ({
  page,
  context,
}) => {
  await stubPush(context);
  const id = await firstWorkout(page, "rem-ask");

  await expect(ask(page).getByRole("heading", { name: "Lembrar você nos dias de treino?" })).toBeVisible();
  await expect(ask(page).getByText(/ · às 18h$/)).toBeVisible();
  await expect(ask(page).getByText("No máximo 3 por semana. Nunca em dia de descanso ou semana de deload.")).toBeVisible();
  await expect(ask(page).getByRole("link", { name: "Trocar dias" })).toHaveAttribute("href", "/app/settings#rotina");
  // Never both asks.
  await expect(page.locator("[data-install-card]")).toHaveCount(0);
  await ask(page).getByLabel("E um resumo semanal por e-mail").check();
  // A re-render before the answer keeps the half-answered ask, box ticked.
  await serverRerender(page);
  await expect(ask(page).getByLabel("E um resumo semanal por e-mail")).toBeChecked();
  await ask(page).getByRole("button", { name: "Ativar lembretes" }).click();
  const done = status(page, /^Lembretes ativados · .*às 18h\. Resumo semanal por e-mail ativado\. Ajuste em Configurações → Lembretes\.$/);
  await expect(done).toBeVisible();
  // The tapped button went with the ask: the focus is on the answer, not back at the top of the page.
  await expect(done).toBeFocused();
  // …and one after it keeps the confirmation (the server now has no ask to offer).
  await serverRerender(page);
  await expect(done).toBeVisible();
  await expect(page.locator("[data-install-card]")).toHaveCount(0);

  expect(sql(`SELECT count(*) FROM "PushSubscription" WHERE "userId" = ${sqlText(id)} AND endpoint LIKE 'https://fcm.googleapis.com/fcm/send/e2e-%'`)).toBe("1");
  expect(sql(`SELECT "emailDigest" || '|' || "askCount" || '|' || "pushHour" FROM "ReminderPreference" WHERE "userId" = ${sqlText(id)}`)).toBe("true|1|18");

  await page.goto("/app/settings#lembretes");
  const section = page.locator("#lembretes");
  await expect(section.getByRole("heading", { name: "Lembretes" })).toBeVisible();
  await expect(section.getByRole("switch", { name: /Notificações neste aparelho/ })).toBeChecked();
  await expect(section.getByRole("radio", { name: "18h" })).toBeChecked();
  await expect(section.getByRole("switch", { name: /Resumo semanal por e-mail/ })).toBeChecked();
  await expect(section.getByText(/No máximo 1 lembrete por dia e 3 por semana\./)).toBeVisible();

  // The hour autosaves.
  await section.getByRole("radio", { name: "20h" }).check();
  await expect(section.getByText("Salvo ✓")).toBeVisible();
  await page.reload();
  await expect(page.locator("#lembretes").getByRole("radio", { name: "20h" })).toBeChecked();

  // Paused after two ignored reminders, with another device on the account: the banner, and
  // "Retomar agora" lifts the pause (its confirmation outlives the page's re-render).
  sql(`UPDATE "ReminderPreference" SET "pausedAt" = now() - interval '1 day', "pausedReason" = 'IGNORED' WHERE "userId" = ${sqlText(id)}`);
  sql(
    `INSERT INTO "PushSubscription" (id, "userId", endpoint, p256dh, auth) VALUES (${sqlText(`${id}-other`)}, ${sqlText(id)}, ${sqlText(`https://fcm.googleapis.com/fcm/send/e2e-other-${id}`)}, '${"B".repeat(87)}', '${"a".repeat(22)}')`,
  );
  await page.reload();
  const lembretes = page.locator("#lembretes");
  await expect(lembretes.getByText("Lembretes pausados")).toBeVisible();
  await expect(lembretes.getByText(/^Pausamos em \d{2}\/\d{2} depois de 2 lembretes seguidos sem resposta\./)).toBeVisible();
  await expect(lembretes.getByText("Ativo em 1 outro aparelho.")).toBeVisible();
  await lembretes.getByRole("button", { name: "Retomar agora" }).click();
  await expect(status(page, "Lembretes retomados.")).toBeVisible();
  await expect(lembretes.getByText("Lembretes pausados")).toHaveCount(0);
  expect(sql(`SELECT ("pausedAt" IS NULL AND "resumedAt" IS NOT NULL)::text FROM "ReminderPreference" WHERE "userId" = ${sqlText(id)}`)).toBe("true");
  await serverRerender(page);
  await expect(status(page, "Lembretes retomados.")).toBeVisible();

  // Off on this device: its row goes; the other device keeps the hour chips.
  await lembretes.getByRole("switch", { name: /Notificações neste aparelho/ }).click();
  await expect(status(page, "Notificações desativadas neste aparelho.")).toBeVisible();
  await expect(lembretes.getByRole("switch", { name: /Notificações neste aparelho/ })).not.toBeChecked();
  expect(sql(`SELECT count(*) FROM "PushSubscription" WHERE "userId" = ${sqlText(id)}`)).toBe("1");
  await expect(lembretes.getByRole("radio", { name: "20h" })).toBeChecked();
  // "Desativar em todos": every device goes, the hour chips with them.
  await lembretes.getByRole("button", { name: "Desativar em todos" }).click();
  await expect(status(page, "Notificações desativadas em todos os aparelhos.")).toBeVisible();
  expect(sql(`SELECT count(*) FROM "PushSubscription" WHERE "userId" = ${sqlText(id)}`)).toBe("0");
  await expect(lembretes.getByRole("radio", { name: "20h" })).toHaveCount(0);
  await expect(lembretes.getByText(/outro aparelho/)).toHaveCount(0);
});

test("'Agora não' sticks; before the first workout the switch waits for one; the digest switch persists", async ({
  page,
  context,
}) => {
  await stubPush(context);
  // Settings before any workout (D-B).
  await loginAsTestUser(page, uniqueEmail("rem-before"));
  await completeOnboarding(page);
  await page.goto("/app/settings");
  const early = page.locator("#lembretes");
  await expect(early.getByRole("switch", { name: /Notificações neste aparelho/ })).toBeDisabled();
  await expect(early.getByText("Disponível depois do seu primeiro treino.")).toBeVisible();
  const digest = early.getByRole("switch", { name: /Resumo semanal por e-mail/ });
  await expect(digest).not.toBeChecked();
  await digest.click();
  await expect(early.getByText("Salvo ✓")).toBeVisible();
  await page.reload();
  await expect(page.locator("#lembretes").getByRole("switch", { name: /Resumo semanal por e-mail/ })).toBeChecked();
  // Signed out meanwhile: the switch says so and offers "Entrar" (or the page goes to sign in), and nothing changes.
  const earlyId = await userIdOf(page);
  await revokeSessions(earlyId, context);
  await page.locator("#lembretes").getByRole("switch", { name: /Resumo semanal por e-mail/ }).click();
  await expectSessionExpired(page, "/app/settings", page.locator("#lembretes"));
  expect(sql(`SELECT "emailDigest"::text FROM "ReminderPreference" WHERE "userId" = ${sqlText(earlyId)}`)).toBe("true");
  await context.clearCookies();

  const id = await firstWorkout(page, "rem-no");
  const summaryUrl = page.url();
  await ask(page).getByRole("button", { name: "Agora não" }).click();
  const fine = status(page, "Tudo bem. Dá para ativar em Configurações → Lembretes.");
  await expect(fine).toBeVisible();
  await expect(fine).toBeFocused();
  await expect(ask(page)).toHaveCount(0);
  await expect.poll(() => sql(`SELECT "askCount" FROM "ReminderPreference" WHERE "userId" = ${sqlText(id)}`)).toBe("1");
  await serverRerender(page);
  await expect(fine).toBeVisible();

  // Away and Back: the router brings the summary back as first served, ask included — it isn't offered again.
  await page.getByRole("link", { name: "Hoje" }).first().click();
  await page.waitForURL(/\/app\/today$/);
  await page.goBack();
  await page.waitForURL(summaryUrl);
  await expect(page.getByText("Treino concluído")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(ask(page)).toHaveCount(0);
  await expect(page.getByText("Lembrar você nos dias de treino?")).toHaveCount(0);

  // The next workout: no ask.
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  await finishAndSave(page);
  await page.waitForLoadState("networkidle");
  await expect(ask(page)).toHaveCount(0);
  await expect(page.getByText("Lembrar você nos dias de treino?")).toHaveCount(0);
});

test("a subscription this browser still holds but the account doesn't is not 'this device'", async ({ page, context }) => {
  await stubPush(context);
  const id = await firstWorkout(page, "rem-stale");
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // The account's one device (a phone)…
  sql(
    `INSERT INTO "PushSubscription" (id, "userId", endpoint, p256dh, auth) VALUES (${sqlText(`stale-${stamp}`)}, ${sqlText(id)}, ${sqlText(`https://fcm.googleapis.com/fcm/send/e2e-phone-${stamp}`)}, '${"B".repeat(87)}', '${"a".repeat(22)}')`,
  );
  // …and this browser still holds a subscription the account no longer has (turned off from the phone,
  // or left by another account on this browser).
  await page.evaluate((s) => {
    window.localStorage.setItem("e2e-push:sub", JSON.stringify({ endpoint: `https://fcm.googleapis.com/fcm/send/e2e-left-${s}`, key: [1, 2, 3] }));
    window.localStorage.setItem("e2e-push:permission", "granted");
  }, stamp);

  await page.goto("/app/settings#lembretes");
  const lembretes = page.locator("#lembretes");
  const device = lembretes.getByRole("switch", { name: /Notificações neste aparelho/ });
  await expect(device).toBeEnabled();
  await expect(device).not.toBeChecked();
  await expect(lembretes.getByText("Ativo em 1 outro aparelho.")).toBeVisible();

  // Turning it on makes this browser one of the account's devices.
  await device.click();
  await expect(status(page, "Notificações ativadas neste aparelho.")).toBeVisible();
  await expect(device).toBeChecked();
  await expect(lembretes.getByText("Ativo em 1 outro aparelho.")).toBeVisible();
  expect(sql(`SELECT count(*) FROM "PushSubscription" WHERE "userId" = ${sqlText(id)}`)).toBe("2");
  // A server re-render doesn't flip it back.
  await serverRerender(page);
  await expect(device).toBeChecked();
});

test("a blocked permission: said once, remembered, no subscription", async ({ page, context }) => {
  await stubPush(context);
  await context.addInitScript(() => window.localStorage.setItem("e2e-push:answer", "denied"));
  const id = await firstWorkout(page, "rem-denied");
  await ask(page).getByRole("button", { name: "Ativar lembretes" }).click();
  await expect(ask(page).getByRole("alert")).toHaveText(
    "Notificações bloqueadas neste navegador. Dá para liberar nas configurações do site.",
  );
  await expect.poll(() => sql(`SELECT "askCount" FROM "ReminderPreference" WHERE "userId" = ${sqlText(id)}`)).toBe("1");
  expect(sql(`SELECT count(*) FROM "PushSubscription" WHERE "userId" = ${sqlText(id)}`)).toBe("0");
  await serverRerender(page);
  await expect(ask(page).getByRole("alert")).toHaveText(
    "Notificações bloqueadas neste navegador. Dá para liberar nas configurações do site.",
  );
  await page.goto("/app/settings");
  await expect(page.locator("#lembretes").getByText(/bloqueadas para a FGPOWER neste navegador/)).toBeVisible();
  await expect(page.locator("#lembretes").getByRole("switch", { name: /Notificações neste aparelho/ })).toBeDisabled();
});

test("a browser that can't get pushes is offered the weekly e-mail alone", async ({ page, context }) => {
  await stubPush(context);
  await context.addInitScript(() => window.localStorage.setItem("e2e-push:permission", "denied"));
  const id = await firstWorkout(page, "rem-mail");
  const email = sql(`SELECT email FROM "user" WHERE id = ${sqlText(id)}`);

  await expect(ask(page).getByRole("heading", { name: "Receber o resumo da semana por e-mail?" })).toBeVisible();
  await expect(ask(page).getByText(`Toda semana, no seu primeiro dia de treino: a semana passada e a que começa. Para ${email}.`)).toBeVisible();
  await expect(ask(page).getByRole("button", { name: "Ativar lembretes" })).toHaveCount(0);
  await expect(page.locator("[data-install-card]")).toHaveCount(0);
  await ask(page).getByRole("button", { name: "Quero o resumo" }).click();
  const done = status(page, `Resumo semanal ativado · para ${email}. Ajuste em Configurações → Lembretes.`);
  await expect(done).toBeVisible();
  await serverRerender(page);
  await expect(done).toBeVisible();
  expect(sql(`SELECT "emailDigest" || '|' || "askCount" FROM "ReminderPreference" WHERE "userId" = ${sqlText(id)}`)).toBe("true|1");
  expect(sql(`SELECT count(*) FROM "PushSubscription" WHERE "userId" = ${sqlText(id)}`)).toBe("0");
});

test("signed out meanwhile: the ask says so, offers to sign in again and saves nothing", async ({ page, context }) => {
  await stubPush(context);
  const id = await firstWorkout(page, "rem-expired");
  const summaryPath = new URL(page.url()).pathname;
  await revokeSessions(id, context);

  // Turning the device on answers 401: the ask's own alert, with "Entrar" back to this summary.
  await ask(page).getByRole("button", { name: "Ativar lembretes" }).click();
  await expectSessionExpired(page, summaryPath, ask(page));
  expect(sql(`SELECT count(*) FROM "PushSubscription" WHERE "userId" = ${sqlText(id)}`)).toBe("0");
  // "Agora não" is a server action: the same message inline, or the sign-in page.
  if (await ask(page).isVisible()) {
    await ask(page).getByRole("button", { name: "Agora não" }).click();
    await expectSessionExpired(page, summaryPath);
  }
  expect(sql(`SELECT count(*) FROM "ReminderPreference" WHERE "userId" = ${sqlText(id)} AND "askCount" > 0`)).toBe("0");
});

test("the tick: digest on the first training day, a push on the next; a tap is tracked; the digest's unsubscribe", async ({
  page,
  context,
}) => {
  await stubPush(context);
  const id = await firstWorkout(page, "rem-tick");
  await ask(page).getByLabel("E um resumo semanal por e-mail").check();
  await ask(page).getByRole("button", { name: "Ativar lembretes" }).click();
  await expect(status(page, /^Lembretes ativados/)).toBeVisible();
  await serverRerender(page);
  await expect(status(page, /^Lembretes ativados/)).toBeVisible();
  const email = sql(`SELECT email FROM "user" WHERE id = ${sqlText(id)}`);

  // Next Monday 07:05: the digest (GD 1 trains Monday to Friday).
  const monday = await tick(page, id, nextWeek(1, 7, 5));
  expect(monday.decisions).toEqual([expect.objectContaining({ kind: "WEEKLY_DIGEST", action: "send" })]);
  const digest = await readOutbox(page, email, { kind: "WEEKLY_DIGEST" });
  // Today's next day (after this week's Segunda, the plan goes on from Terça).
  expect(digest.subject).toMatch(/^Semana \d+ de 13 · GD 1 — hoje: \S+ — .+$/);
  expect(digest.devBody).toContain("SEMANA PASSADA");
  expect(digest.devBody).toContain("Abrir o treino de hoje:");

  // Monday 18:05: already one today. Tuesday 18:05: the push.
  const mondayEvening = await tick(page, id, nextWeek(1, 18, 5));
  expect(mondayEvening.decisions).toEqual([expect.objectContaining({ kind: "TRAINING_DAY", action: "skip", reason: "CAP_DAY" })]);
  const tuesday = await tick(page, id, nextWeek(2, 18, 5));
  expect(tuesday.decisions).toEqual([expect.objectContaining({ kind: "TRAINING_DAY", action: "send" })]);
  const [title, url] = sql(
    `SELECT payload->>'title' || '|' || (payload->>'url') FROM "ReminderDelivery" WHERE "userId" = ${sqlText(id)} AND kind = 'TRAINING_DAY' AND status = 'SENT'`,
  ).split("|");
  expect(title).toMatch(/^Hoje: Terça/);
  expect(url).toMatch(/^\/r\//);

  // The tap: tracked, then on to Today. HEAD (a scanner) changes nothing.
  const head = await page.request.head(url, { maxRedirects: 0 });
  expect(head.status()).toBe(303);
  expect(sql(`SELECT count(*) FROM "ReminderDelivery" WHERE "userId" = ${sqlText(id)} AND "clickedAt" IS NOT NULL`)).toBe("0");
  await page.goto(url);
  await expect(page).toHaveURL(/\/app\/today$/);
  expect(sql(`SELECT count(*) FROM "ReminderDelivery" WHERE "userId" = ${sqlText(id)} AND "clickedAt" IS NOT NULL AND "engagedAt" IS NOT NULL`)).toBe("1");
  // A forged token still lands on Today, and records nothing.
  await page.goto("/r/forged.token");
  await expect(page).toHaveURL(/\/app\/today$/);

  // Unsubscribe: opening the link changes nothing; the button does; "Reativar resumo" undoes it.
  const cancel = digest.devBody!.match(/Parar de receber: \S+(\/email\/cancelar\?t=\S+)/)![1];
  const signedOut = await context.browser()!.newContext(pixel);
  const mail = await signedOut.newPage();
  await mail.goto(cancel);
  await expect(mail.getByRole("heading", { level: 1, name: "Parar de receber o resumo semanal?" })).toBeVisible();
  const digestOn = () => sql(`SELECT "emailDigest"::text FROM "ReminderPreference" WHERE "userId" = ${sqlText(id)}`);
  expect(digestOn()).toBe("true");
  await mail.getByRole("button", { name: "Cancelar inscrição" }).click();
  await expect(mail.getByRole("heading", { level: 1, name: "Pronto. Você não vai mais receber o resumo semanal." })).toBeVisible();
  expect(digestOn()).toBe("false");
  await mail.getByRole("button", { name: "Reativar resumo" }).click();
  await expect(mail.getByText("Resumo reativado. Ele volta na sua próxima semana de treino.")).toBeVisible();
  expect(digestOn()).toBe("true");

  // RFC 8058 one-click (the mail client's own button).
  const token = new URL(cancel, "http://x").searchParams.get("t")!;
  const oneClick = await mail.request.post(`/api/email/unsubscribe?t=${encodeURIComponent(token)}`, {
    form: { "List-Unsubscribe": "One-Click" },
  });
  expect(oneClick.status()).toBe(200);
  expect(digestOn()).toBe("false");
  await mail.goto("/email/cancelar?t=nope");
  await expect(mail.getByRole("heading", { level: 1, name: "Link inválido ou expirado" })).toBeVisible();
  await signedOut.close();
});

test("the privacy page says what reminders and e-mails keep, and what a profile shows to anyone", async ({ page }) => {
  await page.goto("/privacy");
  const lembretes = page.locator("section").filter({ has: page.getByRole("heading", { name: "Lembretes e e-mails" }) });
  // The log keeps the notification's text and the e-mail's subject (never "nothing of the content").
  await expect(lembretes).toContainText("o texto da notificação ou o assunto do e-mail — por 180 dias");
  await expect(lembretes).toContainText("com o assunto e sem o corpo da mensagem, por 30 dias");
  await expect(lembretes).toContainText("não é guardado em texto aberto");
  const treinos = page.locator("section").filter({ has: page.getByRole("heading", { name: "Quem vê seus treinos" }) });
  // A private account hides the workouts, not the profile; being found is on until turned off.
  await expect(treinos).toContainText("Nos dois casos, quem abrir o link do seu perfil vê seu nome, @usuário, foto, bio");
  await expect(treinos).toContainText("estiver ligado — e ele vem ligado");
  await expect(page.getByText("Todo perfil também tem uma imagem de prévia")).toBeVisible();
  await expect(page.getByText(/Você apaga cada medida quando quiser; o check-in pode ser corrigido por 24 horas/)).toBeVisible();
});

test("the service worker shows a push and a tap opens its page", async () => {
  // No stubs: the real /sw.js, a push delivered through CDP (no push service needed).
  // Full Chromium (new headless): the headless shell refuses notifications outright.
  const baseURL = test.info().project.use.baseURL ?? "http://localhost:3108";
  const full = await chromium.launch({ channel: "chromium" });
  const context = await full.newContext({ ...pixel, timezoneId: "America/Sao_Paulo", baseURL });
  const origin = new URL(baseURL).origin;
  await context.grantPermissions(["notifications"], { origin });
  const page = await context.newPage();
  await loginAsTestUser(page, uniqueEmail("rem-sw"));
  await completeOnboarding(page);
  await page.goto("/app/today");
  const cdp = await context.newCDPSession(page);
  await cdp.send("ServiceWorker.enable");
  const registered = new Promise<string>((resolve) => {
    cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => {
      const reg = e.registrations.find((r) => r.scopeURL.startsWith(origin) && !r.isDeleted);
      if (reg) resolve(reg.registrationId);
    });
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  const registrationId = await registered;
  // Controlled by the worker (it claims open pages when it activates).
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin,
    registrationId,
    data: JSON.stringify({ title: "Hoje: Segunda — Superior", body: "GD 1 · Semana 2 de 13", url: "/app/history", tag: "fg-day-x" }),
  });
  const shown = () =>
    page.evaluate(async () =>
      (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag, url: n.data?.url })),
    );
  await expect.poll(shown).toEqual([{ title: "Hoje: Segunda — Superior", body: "GD 1 · Semana 2 de 13", tag: "fg-day-x", url: "/app/history" }]);

  // A foreign URL in a payload never leaves the app.
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin,
    registrationId,
    data: JSON.stringify({ title: "X", body: "", url: "https://evil.example/", tag: "fg-evil" }),
  });
  await expect.poll(async () => (await shown()).find((n) => n.tag === "fg-evil")?.url).toBe("/app/today");

  // The tap (dispatched in the worker): the open page goes to the notification's page.
  const worker = context.serviceWorkers().find((w) => w.url().endsWith("/sw.js")) ?? (await context.waitForEvent("serviceworker"));
  await worker.evaluate(async () => {
    // The worker's globals (not in the page's DOM types).
    const sw = self as unknown as {
      registration: { getNotifications(o: { tag: string }): Promise<unknown[]> };
      dispatchEvent(e: Event): boolean;
      NotificationEvent: new (type: string, init: { notification: unknown }) => Event;
    };
    const [notification] = await sw.registration.getNotifications({ tag: "fg-day-x" });
    sw.dispatchEvent(new sw.NotificationEvent("notificationclick", { notification }));
  });
  await expect(page).toHaveURL(/\/app\/history$/);

  // The browser rotates the subscription (pushsubscriptionchange): the worker saves the new
  // one in place of the old, for the signed-in account. (Devices wait for a finished workout.)
  const userId = await userIdOf(page);
  sql(
    `INSERT INTO "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "updatedAt") VALUES (${sqlText(`${userId}-sw-done`)}, ${sqlText(userId)}, 'Treino', 'COMPLETED', now() - interval '2 hours', now() - interval '1 hour', now())`,
  );
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const oldEndpoint = `https://fcm.googleapis.com/fcm/send/e2e-old-${stamp}`;
  const newEndpoint = `https://fcm.googleapis.com/fcm/send/e2e-new-${stamp}`;
  sql(
    `INSERT INTO "PushSubscription" (id, "userId", endpoint, p256dh, auth) VALUES (${sqlText(`sw-${stamp}`)}, ${sqlText(userId)}, ${sqlText(oldEndpoint)}, '${"B".repeat(87)}', '${"a".repeat(22)}')`,
  );
  await worker.evaluate(
    ({ oldEndpoint, newEndpoint }) => {
      const sw = self as unknown as { dispatchEvent(e: Event): boolean; ExtendableEvent: new (type: string) => Event };
      const event = new sw.ExtendableEvent("pushsubscriptionchange");
      const keys = { p256dh: "B".repeat(87), auth: "a".repeat(22) };
      Object.defineProperty(event, "oldSubscription", { value: { endpoint: oldEndpoint, options: {} } });
      Object.defineProperty(event, "newSubscription", {
        value: { endpoint: newEndpoint, toJSON: () => ({ endpoint: newEndpoint, expirationTime: null, keys }) },
      });
      // A script-made event can't extend its lifetime (waitUntil throws); the handler's work is already under way.
      try {
        sw.dispatchEvent(event);
      } catch {}
    },
    { oldEndpoint, newEndpoint },
  );
  await expect
    .poll(() => sql(`SELECT string_agg(endpoint, ',') FROM "PushSubscription" WHERE "userId" = ${sqlText(userId)}`))
    .toBe(newEndpoint);

  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.unregister());
  await context.close();
  await full.close();
});
