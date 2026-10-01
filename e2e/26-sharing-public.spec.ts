import { expect, test, type Browser, type Page } from "@playwright/test";
import { IPHONE, follow, loginAsTestUser, newOnboardedUser, newUserContext, revokeSessions, setProfile, sql, sqlText, userIdOf } from "./fixtures";
import { QUINTA, finishAndSave, newUserOnGd1, recordSet, startDayFromToday } from "./workout-helpers";

/**
 * Sharing and publishing (Batch 5, C3): a finished workout is published to
 * followers on finish (decision 10, W-048), and leaves the app as a story
 * image plus a link that opens without an account (/t/<token>, W-008) — the
 * loads only when shown, never indexed, revocable. The privacy settings say
 * what they do; a PRIVATE default is asked once (D-A); going public lets the
 * waiting requests in (W-044).
 */

test.use({ ...IPHONE, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });

const TOKEN_URL = /^https?:\/\/[^/]+\/t\/([A-Za-z0-9_-]{16})$/;

/**
 * Records every navigator.share call and says files can be shared — a phone's
 * share sheet, which stays open a moment and refuses a second share meanwhile
 * (InvalidStateError), as a real one does.
 */
async function stubWebShare(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __shares: { title?: string; text?: string; files: { name: string; type: string; size: number }[] }[];
      __sheetOpen: boolean;
    };
    w.__shares = [];
    w.__sheetOpen = false;
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        if (w.__sheetOpen) throw new DOMException("An earlier share has not yet completed.", "InvalidStateError");
        w.__sheetOpen = true;
        w.__shares.push({
          title: data.title,
          text: data.text,
          files: (data.files ?? []).map((f) => ({ name: f.name, type: f.type, size: f.size })),
        });
        await new Promise((resolve) => setTimeout(resolve, 400));
        w.__sheetOpen = false;
      },
    });
  });
}

const shareCount = (page: Page) => page.evaluate(() => (window as unknown as { __shares: unknown[] }).__shares.length);

/** A new account on GD 1 with one finished workout (40 kg × 10). Returns the summary URL. */
async function finishOneWorkout(page: Page, label: string) {
  await newUserOnGd1(page, label);
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  return finishAndSave(page);
}

/** "Copiar link" on the summary; returns the token from the clipboard. */
async function copyShareLink(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Copiar link" }).click();
  await expect(page.getByRole("button", { name: "Link copiado" })).toBeVisible({ timeout: 15_000 });
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const m = copied.match(TOKEN_URL);
  expect(m, copied).not.toBeNull();
  return m![1];
}

/** A signed-out visitor's page. */
async function anonymousPage(browser: Browser) {
  const context = await browser.newContext(IPHONE);
  return { context, page: await context.newPage() };
}

/** A PNG's width and height, from its IHDR chunk. */
function pngSize(body: Buffer) {
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

/**
 * A server re-render of the page on screen, as better-auth's cookie-cache
 * rewrite causes inside any action run 5+ minutes after the last one (R5):
 * what the screen confirmed must survive it.
 */
async function forceServerRerender(page: Page) {
  await Promise.all([
    page.waitForResponse((r) => r.request().headers()["rsc"] === "1" && r.url().includes(new URL(page.url()).pathname)),
    page.evaluate(() => (window as unknown as { next: { router: { refresh(): void } } }).next.router.refresh()),
  ]);
}

/** The path of the page's og:image (dev metadataBase may point at another port). */
async function ogImagePath(page: Page) {
  const content = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  const url = new URL(content!);
  return url.pathname + url.search;
}

test("a finished workout leaves the app: a story image and a link without login, loads only when shown, revocable", async ({
  page,
  browser,
  context,
}) => {
  test.setTimeout(180_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await stubWebShare(page);
  const summaryUrl = await finishOneWorkout(page, "share-owner");

  // Published to followers on finish, loads hidden (decision 10) — no tap.
  await expect(page.getByRole("radio", { name: "Seguidores" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Publicado", { exact: true })).toBeVisible();

  // "Compartilhar imagem": the story PNG goes to the share sheet with the link inside the text.
  await page.getByRole("button", { name: "Compartilhar imagem" }).click();
  await expect(page.getByText("Link ativo: quem tiver o link vê este treino, sem precisar de conta.")).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shares: unknown[] }).__shares.length), { timeout: 20_000 }).toBe(1);
  const [shared] = await page.evaluate(
    () => (window as unknown as { __shares: { title: string; text: string; files: { name: string; type: string; size: number }[] }[] }).__shares,
  );
  expect(shared.files).toHaveLength(1);
  expect(shared.files[0].type).toBe("image/png");
  expect(shared.files[0].name).toMatch(/^fgpower-quinta-puxar-moderado\.png$/);
  expect(shared.files[0].size).toBeGreaterThan(10_000);
  expect(shared.title).toBe(`${QUINTA} · FGPOWER`);
  expect(shared.text).toMatch(/^Treino concluído na FGPOWER: .+\.\nhttps?:\/\/[^/]+\/t\/[A-Za-z0-9_-]{16}$/);

  // "Copiar link": the same link — and the confirmation holds through a server re-render (R5).
  const token = await copyShareLink(page);
  expect(shared.text.endsWith(`/t/${token}`)).toBe(true);
  await forceServerRerender(page);
  await expect(page.getByRole("button", { name: "Link copiado" })).toBeVisible();
  // A double tap while the sheet is up shares once — and never says sharing failed.
  await page.getByRole("button", { name: "Compartilhar imagem" }).dblclick();
  await expect.poll(() => shareCount(page)).toBe(2);
  await page.waitForTimeout(700);
  expect(await shareCount(page)).toBe(2);
  await expect(page.getByText("Não foi possível preparar o compartilhamento. Tente de novo.")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Imagem compartilhada." })).toHaveCount(1);
  // The token never reaches the feed's page data.
  expect(await (await page.request.get("/app/feed")).text()).not.toContain(token);

  // Signed out: the workout, no loads, a way in that comes back here, never indexed.
  const anon = await anonymousPage(browser);
  const res = await anon.page.goto(`/t/${token}`);
  expect(res?.status()).toBe(200);
  await expect(anon.page.getByRole("heading", { level: 1, name: QUINTA })).toBeVisible();
  await expect(anon.page.getByText("Cargas ocultas por quem treinou")).toBeVisible();
  expect(await anon.page.locator("body").innerText()).not.toMatch(/\bkg\b/);
  await expect(anon.page.getByRole("link", { name: "Criar conta grátis" })).toHaveAttribute(
    "href",
    `/login?next=${encodeURIComponent(`/t/${token}`)}`,
  );
  await expect(anon.page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const ogPath = await ogImagePath(anon.page);
  expect(ogPath).toContain(`/t/${token}/opengraph-image`);
  await expect(anon.page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  const og = await anon.page.request.get(ogPath);
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toBe("image/png");
  expect(pngSize(await og.body())).toEqual({ width: 1200, height: 630 });
  const story = await anon.page.request.get(`/t/${token}/story.png?v=1`);
  expect(story.status()).toBe(200);
  expect(story.headers()["content-type"]).toBe("image/png");
  expect(story.headers()["cache-control"]).toContain("no-store");
  expect(pngSize(await story.body())).toEqual({ width: 1080, height: 1920 });
  expect(await anon.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  // "Mostrar kg e reps" on, then share again: the link now shows the loads.
  await page.getByRole("checkbox", { name: "Mostrar kg e reps" }).check();
  await expect(page.getByText("O link ainda mostra o treino como antes.")).toBeVisible();
  await page.getByRole("button", { name: "Atualizar link" }).click();
  await expect(page.getByText("O link ainda mostra o treino como antes.")).toHaveCount(0, { timeout: 15_000 });
  await forceServerRerender(page);
  await expect(page.getByText("O link ainda mostra o treino como antes.")).toHaveCount(0);
  await expect(page.getByText("Link ativo: quem tiver o link vê este treino, sem precisar de conta.")).toBeVisible();
  await anon.page.reload();
  await expect(anon.page.getByText(/40\s?kg × 10/).first()).toBeVisible();
  await expect(anon.page.getByText("Cargas ocultas por quem treinou")).toHaveCount(0);

  // The owner on their own link: the public view, and a way back.
  await page.goto(`/t/${token}`);
  await expect(page.getByText("Assim o seu treino aparece para quem abre o link.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar ao resumo" })).toHaveAttribute("href", new URL(summaryUrl).pathname);

  // "Desativar link": confirmed inline; the old link says it's off; its preview falls back to the brand card.
  await page.goto(summaryUrl);
  await page.getByRole("button", { name: "Desativar link" }).click();
  await expect(page.getByText("Desativar o link? Quem abrir o link antigo verá “link desativado”.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await page.getByRole("button", { name: "Desativar", exact: true }).click();
  const linkOff = page.getByRole("paragraph").filter({ hasText: /^Link desativado\.$/ });
  await expect(linkOff).toBeVisible({ timeout: 15_000 });
  // The confirm is gone with the link: focus goes to the way to a new one, not to the page.
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeFocused();
  await forceServerRerender(page);
  await expect(linkOff).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver página" })).toHaveCount(0);
  // The copied link is dead: the button offers a new one.
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Link copiado" })).toHaveCount(0);
  const gone = await anon.page.goto(`/t/${token}`);
  expect(gone?.status()).toBe(404);
  await expect(anon.page.getByRole("heading", { name: "Este link não está mais ativo." })).toBeVisible();
  await expect(anon.page).toHaveTitle("Link desativado · FGPOWER");
  await expect(anon.page.getByRole("link", { name: "Conhecer a FGPOWER" })).toHaveAttribute("href", "/");
  const brand = await anon.page.request.get(ogPath);
  expect(brand.status()).toBe(200);
  expect(brand.headers()["content-type"]).toBe("image/png");
  expect((await anon.page.request.get(`/t/${token}/story.png?v=2`)).status()).toBe(404);
  await anon.context.close();
});

test("who opens a link: a follower goes to the app page, a stranger sees the shared page, a new account comes back to it", async ({
  page,
  browser,
  context,
}) => {
  test.setTimeout(180_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await finishOneWorkout(page, "share-reach");
  const ownerId = await userIdOf(page);
  const token = await copyShareLink(page);
  const activityId = sql(`SELECT id FROM "Activity" WHERE "shareToken" = ${sqlText(token)}`);

  // A follower sees it in the feed (auto-published on finish) — and a link to it opens the full activity page there.
  const fan = await newUserContext(browser, { label: "share-fan" });
  follow(fan.id, ownerId);
  await fan.page.goto("/app/feed");
  await expect(fan.page.getByText(QUINTA).first()).toBeVisible();
  await fan.page.goto(`/t/${token}`);
  await fan.page.waitForURL(new RegExp(`/app/activity/${activityId}$`), { timeout: 30_000 });
  await fan.context.close();

  // A signed-in stranger (FOLLOWERS workout, not following): the shared page, with a way to follow.
  const stranger = await newUserContext(browser, { label: "share-stranger" });
  const res = await stranger.page.goto(`/t/${token}`);
  expect(res?.status()).toBe(200);
  await expect(stranger.page.getByRole("heading", { level: 1, name: QUINTA })).toBeVisible();
  // The owner's account is private: a request — whose "Solicitação enviada" holds through a server re-render (R5).
  await stranger.page.getByRole("button", { name: "Solicitar seguir" }).click();
  await expect(stranger.page.getByRole("button", { name: "Solicitação enviada" })).toBeVisible({ timeout: 15_000 });
  await forceServerRerender(stranger.page);
  await expect(stranger.page.getByRole("button", { name: "Solicitação enviada" })).toBeVisible();
  expect(
    sql(`SELECT status FROM "FollowRequest" WHERE "requesterId" = ${sqlText(stranger.id)} AND "targetId" = ${sqlText(ownerId)}`),
  ).toBe("PENDING");
  await expect(stranger.page.getByRole("link", { name: "Criar conta grátis" })).toHaveCount(0);
  // Inside the app's shell, with a way back.
  await expect(stranger.page.getByRole("link", { name: "Hoje" }).first()).toBeVisible();
  await expect(stranger.page.getByRole("link", { name: /Voltar/ })).toBeVisible();
  // Holding only the link is enough to report it.
  await stranger.page.getByRole("button", { name: "Denunciar" }).click();
  await stranger.page.getByRole("radio", { name: "Spam" }).check();
  await stranger.page.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(stranger.page.getByText("Denúncia enviada. A equipe do FGPOWER vai analisar.")).toBeVisible({ timeout: 15_000 });
  expect(sql(`SELECT count(*) FROM "UserReport" WHERE "reporterId" = ${sqlText(stranger.id)} AND "activityId" = ${sqlText(activityId)}`)).toBe("1");
  await stranger.context.close();

  // Signed out → "Criar conta grátis" → signed in: back on the link.
  const anon = await anonymousPage(browser);
  await anon.page.goto(`/t/${token}`);
  await anon.page.getByRole("link", { name: "Criar conta grátis" }).click();
  await anon.page.waitForURL(/\/login\?next=%2Ft%2F/);
  const signIn = anon.page.url();
  await loginAsTestUser(anon.page, `share-newcomer-${Date.now()}@fgpower.dev`);
  await anon.page.goto(signIn);
  await anon.page.waitForURL(new RegExp(`/t/${token}$`), { timeout: 30_000 });
  await anon.context.close();
});

test("a PRIVATE default is asked once on the summary (D-A); Settings says what each switch does", async ({ page, context }) => {
  test.setTimeout(150_000);
  await newUserOnGd1(page, "share-private");
  const userId = await userIdOf(page);
  setProfile(userId, { defaultWorkoutVisibility: "PRIVATE" });
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  const summaryUrl = await finishAndSave(page);

  const question = page.getByText("Seus treinos estão privados. Quer mostrar aos seus seguidores, sem as cargas?");
  await expect(question).toBeVisible();
  await expect(page.getByText("Só você vê este treino.")).toBeVisible();
  // "Manter privado": gone for good (stored on the server).
  await page.getByRole("button", { name: "Manter privado" }).click();
  await expect(question).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Seus treinos continuam privados." })).toHaveCount(1);
  // The answer's buttons are gone: focus is on what holds now, not lost on the page.
  await expect(page.getByRole("radio", { name: "Privado" })).toBeFocused();
  // Through a server re-render (R5), then a reload: still answered.
  await forceServerRerender(page);
  await expect(question).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Seus treinos continuam privados." })).toHaveCount(1);
  await page.reload();
  await expect(page.getByText("Só você vê este treino.")).toBeVisible();
  await expect(question).toHaveCount(0);
  expect(sql(`SELECT count(*) FROM "UserDismissal" WHERE "userId" = ${sqlText(userId)} AND key = 'private-default-notice'`)).toBe("1");

  // Answered, then away and back with the phone's back button — nothing refreshed the
  // summary the browser already had in between: it doesn't ask again.
  sql(`DELETE FROM "UserDismissal" WHERE "userId" = ${sqlText(userId)}`);
  await page.reload();
  await page.getByRole("button", { name: "Manter privado" }).click();
  await expect(question).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Seus treinos continuam privados." })).toHaveCount(1);
  await page.getByRole("link", { name: "Perfil", exact: true }).first().click();
  await page.waitForURL(/\/app\/profile$/);
  await page.goBack();
  await page.waitForURL(/\/summary$/);
  await expect(page.getByText("Só você vê este treino.")).toBeVisible();
  await expect(question).toHaveCount(0);

  // (Asked again, the other answer:) new workouts — and this one — go to followers.
  sql(`DELETE FROM "UserDismissal" WHERE "userId" = ${sqlText(userId)}`);
  await page.reload();
  await page.getByRole("button", { name: "Mostrar aos seguidores" }).click();
  await expect(page.getByText("Publicado", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(question).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Seguidores" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: "Seguidores" })).toBeFocused();
  await forceServerRerender(page);
  await expect(page.getByText("Publicado", { exact: true })).toBeVisible();
  await expect(question).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Seguidores" })).toHaveAttribute("aria-checked", "true");
  expect(sql(`SELECT "defaultWorkoutVisibility" FROM "Profile" WHERE "userId" = ${sqlText(userId)}`)).toBe("FOLLOWERS");

  // Settings: only switches that do something, each saying what.
  await page.goto("/app/settings");
  const privacy = page.locator("section#privacidade");
  await expect(privacy.getByText("Compartilhar recordes automaticamente")).toHaveCount(0);
  await expect(privacy.getByText(/medidas corporais/i)).toHaveCount(0);
  await expect(privacy.getByRole("switch", { name: /Conta pública.*Qualquer pessoa — mesmo sem conta/ })).toBeVisible();
  await expect(privacy.getByRole("switch", { name: /Permitir que sua conta seja descoberta/ })).toBeVisible();
  await expect(privacy.getByRole("switch", { name: /Mostrar kg e reps no que eu compartilhar/ })).toBeVisible();
  await expect(privacy.getByLabel("Quem vê seus novos treinos")).toHaveValue("FOLLOWERS");
  await expect(privacy.getByText("Cada treino é publicado assim ao terminar; dá para mudar no resumo dele.")).toBeVisible();

  // Signed out elsewhere meanwhile: sharing never fails silently or generically (D-L). The
  // action says the session expired — or, when the sign-in cookie is cleared with it, the
  // page itself goes to "Entrar de novo" — either way coming back to this summary.
  const summaryPath = new URL(summaryUrl).pathname;
  await page.goto(summaryUrl);

  // No signal: sharing and "Tornar privado" say so inline, and nothing changes.
  await context.setOffline(true);
  await page.getByRole("button", { name: "Copiar link" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Sem conexão — tente de novo quando o sinal voltar." })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("radio", { name: "Privado" }).click();
  await page.getByRole("button", { name: "Tornar privado" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Sem conexão — continua publicado. Tente de novo quando voltar o sinal." }),
  ).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
  expect(sql(`SELECT visibility || '|' || ("shareToken" IS NULL)::text FROM "Activity" WHERE "userId" = ${sqlText(userId)}`)).toBe(
    "FOLLOWERS|true",
  );
  await page.reload();

  await revokeSessions(userId, context);
  await page.getByRole("button", { name: "Copiar link" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Sua sessão expirou — entre de novo." });
  let outcome = "";
  await expect(async () => {
    const url = new URL(page.url());
    const onLogin = url.pathname === "/login" && url.searchParams.get("sessao") === "expirada" && url.searchParams.get("next") === summaryPath;
    // Bounded: the page can leave for /login right after the alert shows (better-auth's cookie write
    // re-renders it), and an unbounded read would wait out the whole toPass on a link that's gone.
    const inline =
      (await alert.isVisible()) &&
      ((await alert.getByRole("link", { name: "Entrar" }).getAttribute("href", { timeout: 1000 })) ?? "").includes(
        encodeURIComponent(summaryPath),
      );
    expect(onLogin || inline).toBe(true);
    outcome = onLogin ? "login" : "inline";
  }).toPass({ timeout: 15_000 });
  test.info().annotations.push({ type: "session-expired", description: `Copiar link: ${outcome}` });
  await expect(page.getByText("Não foi possível preparar o compartilhamento. Tente de novo.")).toHaveCount(0);
});

test("going public lets the waiting follow requests in (W-044)", async ({ page, browser }) => {
  const owner = await newOnboardedUser(page, { label: "share-public" });
  const requester = await newUserContext(browser, { label: "share-requester" });
  const requestId = `${owner.id}-req`;
  sql(`INSERT INTO "FollowRequest" (id, "requesterId", "targetId") VALUES (${sqlText(requestId)}, ${sqlText(requester.id)}, ${sqlText(owner.id)})`);

  await page.goto("/app/settings");
  const publicAccount = page.getByRole("switch", { name: /Conta pública/ });
  await expect(publicAccount).not.toBeChecked();
  await publicAccount.click();
  await expect(page.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });
  // The saved switch holds through a server re-render (R5): the same element, still on.
  await publicAccount.evaluate((el) => ((el as HTMLElement).dataset.r5 = "before"));
  await forceServerRerender(page);
  await expect(publicAccount).toBeChecked();
  await expect(publicAccount).toHaveAttribute("data-r5", "before");
  const pair = `"followerId" = ${sqlText(requester.id)} AND "followingId" = ${sqlText(owner.id)}`;
  expect(sql(`SELECT count(*) FROM "Follow" WHERE ${pair}`)).toBe("1");
  expect(sql(`SELECT status FROM "FollowRequest" WHERE id = ${sqlText(requestId)}`)).toBe("ACCEPTED");
  expect(
    sql(`SELECT count(*) FROM "Notification" WHERE "recipientId" = ${sqlText(requester.id)} AND type = 'FOLLOW_ACCEPTED' AND "actorId" = ${sqlText(owner.id)}`),
  ).toBe("1");
  await requester.context.close();
});

test("link-preview bots get the preview up front for /t and /u (htmlLimitedBots); a dead link or a missing profile, the brand card", async ({
  page,
  request,
}) => {
  const owner = await newOnboardedUser(page, { label: "share-preview", name: "Paula Prévia" });
  // A finished workout with a live link, written straight to the DB.
  const token = `pv${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.slice(0, 16).padEnd(16, "x");
  sql(`INSERT INTO "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "durationSeconds", "totalWorkingSets", "updatedAt")
       VALUES (${sqlText(`${token}-s`)}, ${sqlText(owner.id)}, 'Treino de prévia', 'COMPLETED', now() - interval '1 hour', now() - interval '10 minutes', 2400, 4, now())`);
  sql(`INSERT INTO "Activity" (id, "userId", type, "sessionId", summary, "updatedAt", "shareToken", "sharedAt")
       VALUES (${sqlText(`${token}-a`)}, ${sqlText(owner.id)}, 'WORKOUT', ${sqlText(`${token}-s`)},
               '{"workoutName":"Treino de prévia","totalWorkingSets":4,"exercises":[{"name":"Supino Reto","workingSets":4,"bestSet":null}],"prs":[]}',
               now(), ${sqlText(token)}, now())`);

  // Signed out, as a preview bot fetches: the og tags come in <head>, not streamed after it.
  const preview = async (ua: string, path: string) => {
    const res = await request.get(path, { headers: { "user-agent": ua } });
    const html = await res.text();
    const head = html.slice(0, html.indexOf("</head>"));
    const og = head.match(/<meta property="og:image" content="([^"]+)"/);
    expect(og, `${ua} → ${path}: og:image in <head>`).not.toBeNull();
    const image = new URL(og![1].replace(/&amp;/g, "&"));
    const png = await request.get(image.pathname + image.search);
    expect(png.status()).toBe(200);
    expect(png.headers()["content-type"]).toBe("image/png");
    expect(pngSize(await png.body())).toEqual({ width: 1200, height: 630 });
    return { status: res.status(), head, image: image.pathname + image.search };
  };
  for (const ua of ["TelegramBot (like TwitterBot)", "WhatsApp/2.23.20.0", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"]) {
    const shared = await preview(ua, `/t/${token}`);
    expect(shared.status).toBe(200);
    expect(shared.head).toContain('<meta property="og:title" content="Treino de prévia — treino de Paula Prévia"/>');
    const profile = await preview(ua, `/u/${owner.username}`);
    expect(profile.status).toBe(200);
    expect(profile.head).toContain(`@${owner.username}`);
  }
  // Nothing behind them: still an image (the brand card), never a broken preview.
  const missing = await preview("WhatsApp/2.23.20.0", `/u/naoexiste-${Date.now().toString(36)}`);
  // …a handle no one can have included ("%" arrives decoded: decoding it again used to throw a 500).
  const odd = await request.get(missing.image.replace(/^\/u\/[^/]+\//, "/u/100%25/"));
  expect(odd.status()).toBe(200);
  expect(odd.headers()["content-type"]).toBe("image/png");
  sql(`UPDATE "Activity" SET "shareToken" = NULL, "sharedAt" = NULL WHERE id = ${sqlText(`${token}-a`)}`);
  expect((await preview("WhatsApp/2.23.20.0", `/t/${token}`)).status).toBe(404);
});
