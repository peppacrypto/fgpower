import { test, expect, type APIRequestContext, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { IPHONE, follow, loginAsTestUser, newUserContext, revokeSessions, setProfile, sql, sqlText, userIdOf } from "./fixtures";
import {
  QUINTA,
  finishAndSave,
  newUserOnGd1,
  recordSet,
  sessionIdFromUrl,
  startDayFromToday,
  todayDayRow,
  waitForWorkoutScreen,
} from "./workout-helpers";

/**
 * The social inbox, graph and moderation (Batch 5, cluster C1): an unread
 * pip that follows the user around the app and clears when the list is seen;
 * FGs on one workout as one line; follow requests that say what happened and
 * offer "Seguir de volta"; asking again after unfollowing a private account
 * really asks; the achievements log (created read); follower lists with
 * "Remover"; a profile's "⋯" (report, remove, block) and unblocking in Settings; a
 * report that reaches the admin with a preview and a decision that sticks;
 * the moderation queue's decisions (two identical ones in a row, delete, ban,
 * unban), for admins only — also to a request that skips the admin layout —
 * with "Abrir no app" only where it opens and old reports (no person named)
 * still showing their author. Every confirmation survives a server re-render
 * (R5), and an expired session says so.
 */
test.use(IPHONE);
test.describe.configure({ timeout: 150_000 });

const tag = () => Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 4);

/** A finished workout shared with `visibility`, written straight to the DB. Returns ids. */
function seedWorkout(userId: string, opts: { name: string; visibility?: "PUBLIC" | "FOLLOWERS" | "PRIVATE"; caption?: string }) {
  const id = `${userId}-${tag()}`;
  const visibility = opts.visibility ?? "PUBLIC";
  const summary = { workoutName: opts.name, durationSeconds: 3600, totalWorkingSets: 12, totalVolumeKg: null, prs: [], exercises: [] };
  sql(`insert into "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "durationSeconds", visibility, "updatedAt")
       values (${sqlText(`${id}-s`)}, ${sqlText(userId)}, ${sqlText(opts.name)}, 'COMPLETED', now() - interval '2 hours', now() - interval '1 hour', 3600, ${sqlText(visibility)}, now())`);
  sql(`insert into "Activity" (id, "userId", type, "sessionId", visibility, caption, summary, "updatedAt")
       values (${sqlText(`${id}-a`)}, ${sqlText(userId)}, 'WORKOUT', ${sqlText(`${id}-s`)}, ${sqlText(visibility)}, ${
         opts.caption ? sqlText(opts.caption) : "null"
       }, ${sqlText(JSON.stringify(summary))}::jsonb, now())`);
  return { sessionId: `${id}-s`, activityId: `${id}-a` };
}

/** Taps a button that calls a server action, and waits for the server's answer (the UI is optimistic). */
async function tapAndSettle(page: Page, button: Locator) {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined),
    button.click(),
  ]);
}

/**
 * Re-renders the current page on the server — what a refresh, the app resuming
 * or the session cookie refreshed inside any action does (R5) — and returns
 * the server's new payload, so a test can show the server no longer lists
 * what the screen still confirms.
 */
async function serverRerender(page: Page): Promise<string> {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "GET" && r.request().headers()["rsc"] === "1"),
    page.evaluate(() => (window as unknown as { next: { router: { refresh(): void } } }).next.router.refresh()),
  ]);
  const payload = await response.text();
  // Let React commit the new server tree before the test looks.
  await page.waitForTimeout(500);
  return payload;
}

/** Signed out meanwhile: the inline "Sua sessão expirou … Entrar" back to `path`, or the sign-in page with it (R5). */
async function expectSessionExpired(page: Page, path: string) {
  const alert = page.getByRole("alert").filter({ hasText: "Sua sessão expirou — entre de novo." });
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

/** Gives an FG from the activity page, waiting for the server to take it. */
async function giveFg(page: Page, activityId: string) {
  await page.goto(`/app/activity/${activityId}`);
  await tapAndSettle(page, page.getByRole("button", { name: /Dar FG neste treino/ }));
  await expect(page.getByRole("button", { name: /Remover seu FG/ })).toBeVisible();
}

const bottomNav = (page: Page) => page.getByRole("navigation", { name: "Navegação principal" });
const row = (page: Page, text: string | RegExp) => page.locator("div.border-b").filter({ hasText: text });

/** Makes `userId` an admin through the role column; the 5-minute session cache cookie goes, so the next request reads it. */
async function makeAdmin(userId: string, context: BrowserContext) {
  sql(`UPDATE "user" SET role = 'admin' WHERE id = ${sqlText(userId)}`);
  const keep = (await context.cookies()).filter((c) => c.name !== "better-auth.session_data");
  await context.clearCookies();
  await context.addCookies(keep);
}

test("an FG lights the unread pip across the app; the inbox groups FGs and marks them seen once", async ({ browser }) => {
  const t = tag();
  const author = await newUserContext(browser, { label: "inbox-author", name: "Bruno Autor", handle: `bruno_${t}`, isPublicAccount: true });
  const { activityId } = seedWorkout(author.id, { name: "Superior (pesado)" });
  const ana = await newUserContext(browser, { label: "inbox-ana", name: "Ana Fã" });
  await giveFg(ana.page, activityId);

  // Today: the bell and the Perfil tab carry the count.
  const page = author.page;
  await page.goto("/app/today");
  const bell = page.getByRole("link", { name: "Notificações, 1 nova" });
  await expect(bell).toBeVisible();
  const perfil = bottomNav(page).getByRole("link", { name: /^Perfil/ });
  await expect(perfil).toHaveAccessibleName(/^Perfil\s*, 1 notificação nova$/);
  await expect(perfil.locator("[data-unread-pip]")).toHaveText("1");
  // Desktop: the sidebar's Notificações link carries it too.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("navigation", { name: "Navegação lateral" }).getByRole("link", { name: /Notificações\s*, 1 notificação nova/ })).toBeVisible();
  await page.setViewportSize(IPHONE.viewport);

  await bell.click();
  await expect(page).toHaveURL(/\/app\/notifications$/);
  const fgLine = row(page, "Ana Fã deu FG no seu treino Superior (pesado)");
  await expect(fgLine).toHaveAttribute("data-unread", "true");
  await expect(fgLine.locator("time")).toHaveText(/^(agora|há \d+\s+min)$/);
  await expect(fgLine.getByRole("link")).toHaveAttribute("href", `/app/activity/${activityId}`);
  await expect(page.getByRole("heading", { level: 2, name: "Hoje" })).toBeVisible();
  await expect(page.getByText("1 nova", { exact: true })).toBeVisible();

  // Seen once shown: the pip goes without a reload, the line keeps its marker for this visit —
  // through a server re-render too, which already has the line read.
  await expect(bottomNav(page).getByRole("link", { name: "Perfil", exact: true })).toBeVisible();
  await expect(fgLine).toHaveAttribute("data-unread", "true");
  await serverRerender(page);
  await expect(bottomNav(page).getByRole("link", { name: "Perfil", exact: true })).toBeVisible();
  await expect(fgLine).toHaveAttribute("data-unread", "true");
  await expect(page.getByText("1 nova", { exact: true })).toBeVisible();
  // (dispatchEvent: in dev the Next.js tools button sits over the first tab.)
  await bottomNav(page).getByRole("link", { name: "Hoje", exact: true }).dispatchEvent("click");
  await expect(page.getByRole("link", { name: "Notificações", exact: true })).toBeVisible();
  await page.goto("/app/notifications");
  await expect(fgLine).not.toHaveAttribute("data-unread", /.*/);
  await expect(page.getByText("1 nova", { exact: true })).toHaveCount(0);

  // A second FG on the same workout: one line, newest first.
  const caio = await newUserContext(browser, { label: "inbox-caio", name: "Caio Fã" });
  await giveFg(caio.page, activityId);
  await page.reload();
  await expect(page.locator('[data-notification="FG_RECEIVED"]')).toHaveCount(1);
  await expect(row(page, /deram FG/)).toContainText("Caio Fã e Ana Fã deram FG no seu treino Superior (pesado)");
  await expect(row(page, /deram FG/)).toHaveAttribute("data-unread", "true");

  // An FG taken back before it was seen leaves no trace (and no pip); one already seen stays as history.
  const duda = await newUserContext(browser, { label: "inbox-duda", name: "Duda Fã" });
  await giveFg(duda.page, activityId);
  await page.goto("/app/today");
  await expect(page.getByRole("link", { name: "Notificações, 1 nova" })).toBeVisible();
  await tapAndSettle(duda.page, duda.page.getByRole("button", { name: /Remover seu FG/ }));
  await tapAndSettle(caio.page, caio.page.getByRole("button", { name: /Remover seu FG/ }));
  await page.reload();
  await expect(page.getByRole("link", { name: "Notificações", exact: true })).toBeVisible();
  await page.goto("/app/notifications");
  await expect(row(page, /FG no seu treino/)).toContainText("Caio Fã e Ana Fã deram FG no seu treino Superior (pesado)");

  for (const u of [author, ana, caio, duda]) await u.context.close();
});

test("a follow request says what happened, offers 'Seguir de volta', and asking again after unfollowing really asks", async ({
  browser,
}) => {
  const t = tag();
  const diana = await newUserContext(browser, { label: "req-diana", name: "Diana Privada", handle: `diana_${t}`, isPublicAccount: false });
  const edu = await newUserContext(browser, { label: "req-edu", name: "Edu Pedido", handle: `edu_${t}`, isPublicAccount: true });

  await edu.page.goto(`/u/diana_${t}`);
  await tapAndSettle(edu.page, edu.page.getByRole("button", { name: "Solicitar seguir" }));
  await expect(edu.page.getByRole("button", { name: "Solicitação enviada" })).toBeVisible();

  await diana.page.goto("/app/notifications");
  const line = row(diana.page, "Edu Pedido");
  await expect(line.getByText("Edu Pedido pediu para seguir você")).toBeVisible();
  await line.getByRole("button", { name: "Aceitar" }).click();
  await expect(line.getByText("Edu Pedido agora segue você", { exact: true })).toBeVisible();
  await expect(line.getByRole("status").filter({ hasText: "Solicitação" })).toHaveText("Solicitação aceita");
  // The buttons are gone: the focus stays on the line.
  await expect(line.getByRole("link")).toBeFocused();
  await tapAndSettle(diana.page, line.getByRole("button", { name: "Seguir de volta" }));
  await expect(line.getByRole("button", { name: "Seguindo" })).toBeVisible();
  // A server re-render (it now says Diana follows Edu) keeps the answered line and its button.
  await serverRerender(diana.page);
  await expect(line.getByText("Edu Pedido agora segue você", { exact: true })).toBeVisible();
  await expect(line.getByText("Solicitação aceita")).toBeVisible();
  await expect(line.getByRole("button", { name: "Seguindo" })).toBeVisible();
  await diana.page.reload();
  await expect(line.getByText("Edu Pedido agora segue você", { exact: true })).toBeVisible();
  await expect(line.getByRole("button", { name: "Seguir de volta" })).toHaveCount(0);

  // Edu unfollows (it asks first) and asks again: the request is real — it survives a reload…
  await edu.page.goto(`/u/diana_${t}`);
  await edu.page.getByRole("button", { name: "Seguindo" }).click();
  await tapAndSettle(edu.page, edu.page.getByRole("dialog").getByRole("button", { name: "Deixar de seguir" }));
  await tapAndSettle(edu.page, edu.page.getByRole("button", { name: "Solicitar seguir" }));
  await expect(edu.page.getByRole("button", { name: "Solicitação enviada" })).toBeVisible();
  await edu.page.reload();
  await expect(edu.page.getByRole("button", { name: "Solicitação enviada" })).toBeVisible();

  // …and Diana has it as new, once.
  await diana.page.goto("/app/notifications");
  await expect(line).toHaveCount(1);
  await expect(line.getByText("Edu Pedido pediu para seguir você")).toBeVisible();
  await expect(line).toHaveAttribute("data-unread", "true");
  await line.getByRole("button", { name: "Recusar" }).click();
  await expect(line.getByText("Você recusou o pedido de Edu Pedido")).toBeVisible();
  await expect(line.getByText("Solicitação recusada")).toBeVisible();
  await serverRerender(diana.page);
  await expect(line.getByText("Você recusou o pedido de Edu Pedido")).toBeVisible();
  await expect(line.getByText("Solicitação recusada")).toBeVisible();
  await expect(line).toHaveAttribute("data-unread", "true");

  for (const u of [diana, edu]) await u.context.close();
});

test("your own achievements are in the log already read, with their words and links", async ({ browser }) => {
  const lifter = await newUserContext(browser, { label: "log-lifter", name: "Lia Lifter" });
  const { sessionId } = seedWorkout(lifter.id, { name: "Inferior A", visibility: "PRIVATE" });
  const insert = (type: string, key: string, data: object) =>
    sql(`insert into "Notification" (id, "recipientId", "actorId", type, "sessionId", "dedupeKey", data, "readAt", "createdAt")
         values (${sqlText(`${sessionId}-${key}`)}, ${sqlText(lifter.id)}, null, ${sqlText(type)}, ${sqlText(sessionId)}, ${sqlText(key)},
                 ${sqlText(JSON.stringify(data))}::jsonb, now(), now())`);
  insert("PERSONAL_RECORD", `pr:${sessionId}`, { sessionId, count: 2, exercises: ["Supino Reto com Barra", "Remada Curvada"] });
  insert("PROGRAM_WEEK_COMPLETE", "week:1", { monday: 1, done: 4, target: 4, deload: false, streak: 5, programName: "GD 1", programWeek: 3 });
  insert("WORKOUT_MILESTONE", "milestone:10", { count: 10, sessionId });

  const page = lifter.page;
  await page.goto("/app/today");
  await expect(page.getByRole("link", { name: "Notificações", exact: true })).toBeVisible();
  await page.goto("/app/notifications");
  await expect(row(page, "2 recordes: Supino Reto com Barra e Remada Curvada").getByRole("link")).toHaveAttribute(
    "href",
    `/app/workout/${sessionId}/summary`,
  );
  await expect(row(page, "Semana 3 de GD 1 completa · 4 de 4 treinos · 5 semanas seguidas").getByRole("link")).toHaveAttribute(
    "href",
    "/app/history",
  );
  await expect(row(page, "Dossiê nº 10 · 10 treinos registrados")).toBeVisible();
  await expect(page.locator("[data-unread]")).toHaveCount(0);
  await lifter.context.close();
});

test("a record from a real workout lands in the log already read", async ({ page }) => {
  await newUserOnGd1(page, "log-real");
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  await finishAndSave(page);
  // The same day again, heavier: a record.
  await page.goto("/app/today");
  const day = todayDayRow(page, QUINTA);
  await day.getByRole("button", { name: "Refazer" }).click();
  await Promise.all([page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }), day.getByRole("button", { name: "Sim, treinar de novo" }).click()]);
  await waitForWorkoutScreen(page);
  const second = sessionIdFromUrl(page.url());
  await recordSet(page, 1, "45", "10");
  await finishAndSave(page);

  await page.goto("/app/today");
  await expect(page.getByRole("link", { name: "Notificações", exact: true })).toBeVisible();
  await page.goto("/app/notifications");
  const record = row(page, /Novo recorde em Puxada Alta Unilateral no Pulley/);
  await expect(record).toHaveCount(1);
  await expect(record.getByRole("link")).toHaveAttribute("href", `/app/workout/${second}/summary`);
  await expect(record).not.toHaveAttribute("data-unread", /.*/);
});

test("Seguidores and Seguindo list your people; 'Remover' asks first and the person isn't told", async ({ browser }) => {
  const t = tag();
  const owner = await newUserContext(browser, { label: "lists-owner", name: "Olga Dona", handle: `olga_${t}`, isPublicAccount: true });
  const fan = await newUserContext(browser, { label: "lists-fan", name: "Fábio Fã", handle: `fabio_${t}`, isPublicAccount: true });
  const idol = await newUserContext(browser, { label: "lists-idol", name: "Ivo Ídolo", handle: `ivo_${t}`, isPublicAccount: true });
  const page = owner.page;

  // Nobody yet: say so, and where to find people.
  await page.goto("/app/profile/seguidores");
  await expect(page.getByText("Ninguém segue você ainda.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Encontrar pessoas" })).toHaveAttribute("href", "/app/discover");
  await page.goto("/app/profile/seguindo");
  await expect(page.getByText("Você ainda não segue ninguém.")).toBeVisible();

  follow(fan.id, owner.id);
  follow(owner.id, idol.id);
  await page.goto("/app/profile");
  // "Compartilhar perfil" sits beside "Ver perfil público" (W-008); with no share sheet the link is copied.
  await owner.context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  await page.getByRole("button", { name: "Compartilhar perfil" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Link do perfil copiado" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`/u/olga_${t}$`));
  await page.getByRole("link", { name: "1 seguidor — ver lista" }).click();
  await expect(page).toHaveURL(/\/app\/profile\/seguidores$/);
  await expect(page.getByRole("heading", { level: 1, name: "Seguidores" })).toBeVisible();
  const fanRow = page.locator("li").filter({ hasText: `@fabio_${t}` });
  await expect(fanRow.getByRole("link", { name: /Fábio Fã/ })).toHaveAttribute("href", `/u/fabio_${t}`);
  await expect(fanRow.getByRole("button", { name: "Seguir de volta" })).toBeVisible();
  await fanRow.getByRole("button", { name: `Remover @fabio_${t} dos seguidores` }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Remover @fabio_${t} dos seguidores?` })).toBeVisible();
  await expect(dialog).toContainText(`@fabio_${t} não é avisado.`);
  await dialog.getByRole("button", { name: "Remover", exact: true }).click();
  // Said through the row's status region; the focus stays on the row (its person).
  await expect(fanRow.getByRole("status").filter({ hasText: "Removido" })).toHaveText(`Removido: @fabio_${t}`);
  await expect(fanRow.getByRole("link", { name: /Fábio Fã/ })).toBeFocused();
  // A server re-render no longer lists Fábio: the row stays, saying so, until the next visit.
  expect(await serverRerender(page)).not.toContain(`fabio_${t}`);
  await expect(page.getByRole("region", { name: "Seguidores" })).toContainText("0 pessoas");
  await expect(fanRow.getByText("Removido")).toBeVisible();
  await expect(page.getByText("Ninguém segue você ainda.")).toHaveCount(0);

  // Fábio no longer follows (and nothing told him).
  await fan.page.goto(`/u/olga_${t}`);
  await expect(fan.page.getByRole("button", { name: "Seguir", exact: true })).toBeVisible();
  expect(sql(`SELECT count(*) FROM "Notification" WHERE "recipientId" = ${sqlText(fan.id)}`)).toBe("0");

  // Seguindo, and back.
  await page.goto("/app/profile");
  await page.getByRole("link", { name: "Seguindo 1 pessoa — ver lista" }).click();
  await expect(page).toHaveURL(/\/app\/profile\/seguindo$/);
  const idolRow = page.locator("li").filter({ hasText: `@ivo_${t}` });
  await expect(idolRow.getByRole("button", { name: "Seguindo" })).toBeVisible();
  // Unfollowing asks first; the row stays, reading "Seguir", through a server re-render that no longer lists Ivo.
  await idolRow.getByRole("button", { name: "Seguindo" }).click();
  await tapAndSettle(page, page.getByRole("dialog").getByRole("button", { name: "Deixar de seguir" }));
  await expect(idolRow.getByRole("button", { name: "Seguir", exact: true })).toBeVisible();
  expect(await serverRerender(page)).not.toContain(`ivo_${t}`);
  await expect(page.getByRole("region", { name: "Seguindo" })).toContainText("0 pessoas");
  await expect(idolRow.getByRole("button", { name: "Seguir", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Voltar/ }).click();
  await expect(page).toHaveURL(/\/app\/profile$/);

  // A private account answers requests right there.
  setProfile(owner.id, { isPublicAccount: false });
  for (const who of [fan, idol]) {
    await who.page.goto(`/u/olga_${t}`);
    await tapAndSettle(who.page, who.page.getByRole("button", { name: "Solicitar seguir" }));
    await expect(who.page.getByRole("button", { name: "Solicitação enviada" })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole("link", { name: /0 seguidores e 2 pedidos para seguir — ver lista/ })).toBeVisible();
  await page.goto("/app/profile/seguidores");
  const requests = page.getByRole("region", { name: "Solicitações" });
  await expect(requests.getByRole("heading", { level: 2, name: "Solicitações" })).toBeVisible();
  const request = requests.locator("li").filter({ hasText: `@fabio_${t}` });
  await request.getByRole("button", { name: "Aceitar Fábio Fã" }).click();
  await expect(request.getByRole("status")).toHaveText("Solicitação aceita");
  await expect(request.getByRole("link", { name: /Fábio Fã/ })).toBeFocused();
  const declined = requests.locator("li").filter({ hasText: `@ivo_${t}` });
  await declined.getByRole("button", { name: "Recusar Ivo Ídolo" }).click();
  await expect(declined.getByRole("status")).toHaveText("Solicitação recusada");
  // The server no longer has them waiting (Fábio follows now): both answers stay on screen.
  await serverRerender(page);
  await expect(requests).toContainText("0 pedidos");
  await expect(request.getByText("Solicitação aceita")).toBeVisible();
  await expect(declined.getByText("Solicitação recusada")).toBeVisible();
  // Fábio joined the followers, with "Seguir de volta"; following back survives a re-render too.
  const follower = page.getByRole("region", { name: "Seguidores" }).locator("li").filter({ hasText: `@fabio_${t}` });
  await tapAndSettle(page, follower.getByRole("button", { name: "Seguir de volta" }));
  await expect(follower.getByRole("button", { name: "Seguindo" })).toBeVisible();
  await serverRerender(page);
  await expect(follower.getByRole("button", { name: "Seguindo" })).toBeVisible();

  for (const u of [owner, fan, idol]) await u.context.close();
});

test("a profile's ⋯ reports, removes a follower and blocks; blocking hides both ways; Settings unblocks", async ({ browser }) => {
  const t = tag();
  const me = await newUserContext(browser, { label: "block-me", name: "Bia Bloqueia", handle: `bia_${t}`, isPublicAccount: true });
  const pest = await newUserContext(browser, { label: "block-pest", name: "Pedro Chato", handle: `pedro_${t}`, isPublicAccount: true });
  follow(pest.id, me.id);
  follow(me.id, pest.id);

  await me.page.goto(`/u/pedro_${t}`);
  const menu = me.page.getByRole("button", { name: "Mais opções" });
  const sheet = me.page.getByRole("dialog");

  // "Denunciar perfil": the report sheet about the person.
  await menu.click();
  await expect(sheet.getByRole("heading", { name: `@pedro_${t}` })).toBeVisible();
  await sheet.getByRole("button", { name: "Denunciar perfil" }).click();
  await expect(sheet.getByRole("heading", { name: `Denunciar @pedro_${t}` })).toBeVisible();
  await sheet.getByLabel("Assédio ou ofensa").check();
  await sheet.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(sheet.getByText("Denúncia enviada. A equipe do FGPOWER vai analisar.")).toBeVisible();
  await sheet.getByRole("button", { name: "Fechar" }).click();
  await expect(menu).toBeFocused();
  const aboutPedro = `"reporterId" = ${sqlText(me.id)} AND "reportedUserId" = ${sqlText(pest.id)}`;
  expect(sql(`SELECT reason || '|' || coalesce("activityId", 'perfil') FROM "UserReport" WHERE ${aboutPedro}`)).toBe("HARASSMENT|perfil");
  // Out of the admin queue again (a test report).
  sql(`UPDATE "UserReport" SET status = 'DISMISSED', "resolvedAt" = now() WHERE ${aboutPedro}`);

  // "Remover dos seguidores" asks first; what happened is said under the menu, through a server re-render too.
  await menu.click();
  await sheet.getByRole("button", { name: "Remover dos seguidores" }).click();
  await expect(sheet.getByRole("heading", { name: `Remover @pedro_${t} dos seguidores?` })).toBeVisible();
  await sheet.getByRole("button", { name: "Remover", exact: true }).click();
  const removed = me.page.getByRole("status").filter({ hasText: `@pedro_${t} não segue mais você.` });
  await expect(removed).toBeVisible();
  await serverRerender(me.page);
  await expect(removed).toBeVisible();
  expect(sql(`SELECT count(*) FROM "Follow" WHERE "followerId" = ${sqlText(pest.id)} AND "followingId" = ${sqlText(me.id)}`)).toBe("0");

  await menu.click();
  await expect(sheet.getByRole("button", { name: "Remover dos seguidores" })).toHaveCount(0);
  await sheet.getByRole("button", { name: `Bloquear @pedro_${t}` }).click();
  const confirm = me.page.getByRole("dialog");
  await expect(confirm.getByRole("heading", { name: `Bloquear @pedro_${t}?` })).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await confirm.getByRole("button", { name: "Bloquear", exact: true }).click();

  await me.page.waitForURL(/\/app\/settings/);
  await expect(me.page.getByText("Conta bloqueada.")).toBeVisible();
  await expect.poll(() => new URL(me.page.url()).searchParams.has("bloqueado")).toBe(false);
  const blocked = me.page.locator("[data-blocked-row]").filter({ hasText: `@pedro_${t}` });
  await expect(blocked).toBeVisible();
  // The address no longer asks for the notice: a server re-render keeps it for this visit.
  await serverRerender(me.page);
  await expect(me.page.getByText("Conta bloqueada.")).toBeVisible();
  expect(
    sql(`SELECT count(*) FROM "Follow" WHERE ("followerId" = ${sqlText(me.id)} AND "followingId" = ${sqlText(pest.id)})
         OR ("followerId" = ${sqlText(pest.id)} AND "followingId" = ${sqlText(me.id)})`),
  ).toBe("0");

  // Pedro can't see Bia any more.
  await pest.page.goto(`/u/bia_${t}`);
  await expect(pest.page.getByRole("heading", { level: 1, name: "Perfil não encontrado ou publicação privada." })).toBeVisible();

  // Unblock: the row says so (read out; the focus stays on the row), through a server
  // re-render that no longer lists Pedro; a reload shows the empty list.
  await blocked.getByRole("button", { name: `Desbloquear @pedro_${t}` }).click();
  await expect(blocked.getByRole("status")).toHaveText(`Desbloqueado: @pedro_${t}`);
  await expect(blocked.getByText("Pedro Chato", { exact: true })).toBeFocused();
  expect(await serverRerender(me.page)).not.toContain(`pedro_${t}`);
  await expect(blocked.getByText("Desbloqueado")).toBeVisible();
  await expect(me.page.getByText("Conta bloqueada.")).toBeVisible();
  await me.page.reload();
  await expect(me.page.getByText("Ninguém bloqueado. Para bloquear alguém, abra o perfil e toque em ⋯.")).toBeVisible();
  await expect(me.page.getByText("Conta bloqueada.")).toHaveCount(0);

  for (const u of [me, pest]) await u.context.close();
});

test("a report reaches the admin with a preview; hiding the workout closes it for the reporter", async ({ browser }) => {
  const t = tag();
  const author = await newUserContext(browser, { label: "rep-author", name: "Rui Relatado", handle: `rui_${t}`, isPublicAccount: true });
  const { activityId } = seedWorkout(author.id, { name: `Treino suspeito ${t}`, caption: "Supino 500 kg fácil" });
  const reporter = await newUserContext(browser, { label: "rep-rita", name: "Rita Relata" });

  await reporter.page.goto(`/app/activity/${activityId}`);
  await reporter.page.getByRole("button", { name: "Denunciar" }).click();
  const sheet = reporter.page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Denunciar treino" })).toBeVisible();
  await sheet.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Escolha um motivo.");
  await sheet.getByLabel("Dados falsos (cargas ou treinos inventados)").check();
  await sheet.getByLabel("Detalhes (opcional)").fill(`500 kg no supino? ${t}`);
  await sheet.getByRole("button", { name: "Enviar denúncia" }).click();
  await expect(sheet.getByText("Denúncia enviada. A equipe do FGPOWER vai analisar.")).toBeVisible();
  await expect(sheet.getByRole("button", { name: `Bloquear @rui_${t} também` })).toBeVisible();
  await serverRerender(reporter.page);
  await expect(sheet.getByText("Denúncia enviada. A equipe do FGPOWER vai analisar.")).toBeVisible();
  await sheet.getByRole("button", { name: "Fechar" }).click();
  await expect(reporter.page.getByRole("dialog")).toHaveCount(0);

  // Only admins see "Painel admin" in Settings (phones have no sidebar).
  await reporter.page.goto("/app/settings");
  await expect(reporter.page.getByText("Painel admin")).toHaveCount(0);
  const admin = await newUserContext(browser, { label: "rep-admin", name: "Ada Admin" });
  await makeAdmin(admin.id, admin.context);
  await admin.page.goto("/app/settings");
  await expect(admin.page.getByText("Painel admin")).toBeVisible();
  await admin.page.getByRole("link", { name: "Abrir o painel admin" }).click();
  await expect(admin.page).toHaveURL(/\/admin\/reports$/);

  const card = admin.page.locator("[data-report]").filter({ hasText: `500 kg no supino? ${t}` });
  await expect(card).toContainText("Dados falsos");
  await expect(card).toContainText(`Treino suspeito ${t}`);
  await expect(card).toContainText("Supino 500 kg fácil");
  await expect(card.getByRole("link", { name: /Rita Relata/ })).toHaveAttribute("href", `/u/${reporter.username}`);
  await expect(card.getByRole("link", { name: /Rui Relatado/ })).toHaveAttribute("href", `/u/rui_${t}`);
  await card.getByRole("button", { name: "Ocultar treino" }).click();
  await admin.page.getByRole("dialog").getByRole("button", { name: "Ocultar treino" }).click();
  await expect(admin.page.getByText(/Denúncia resolvida · Ação tomada/)).toBeVisible();
  await expect(card).toHaveCount(0);
  await serverRerender(admin.page);
  await expect(admin.page.getByText(/Denúncia resolvida · Ação tomada/)).toBeVisible();
  await expect(card).toHaveCount(0);

  await admin.page.getByRole("link", { name: "Resolvidas" }).click();
  const resolved = admin.page.locator("[data-report]").filter({ hasText: `500 kg no supino? ${t}` });
  await expect(resolved).toContainText("Ação tomada");
  await expect(resolved).toContainText("Treino ocultado.");

  // The reporter (and anyone else) no longer sees it; the author still has it, private.
  await reporter.page.goto(`/app/activity/${activityId}`);
  await expect(reporter.page.getByRole("heading", { name: "Esta página não existe (ou saiu do ar)." })).toBeVisible();
  expect(sql(`SELECT visibility || '|' || ("moderatedAt" IS NOT NULL) FROM "Activity" WHERE id = ${sqlText(activityId)}`)).toBe("PRIVATE|true");

  for (const u of [author, reporter, admin]) await u.context.close();
});

test("the moderation queue: two identical decisions in a row both leave it; delete, ban and unban", async ({ browser }) => {
  const t = tag();
  const ari = await newUserContext(browser, { label: "mod-ari", name: "Ari Autor", handle: `ari_${t}`, isPublicAccount: true });
  const beto = await newUserContext(browser, { label: "mod-beto", name: "Beto Banido", handle: `beto_${t}`, isPublicAccount: true });
  const reporter = await newUserContext(browser, { label: "mod-rep", name: "Rô Relata" });
  const one = seedWorkout(ari.id, { name: `Revisar um ${t}` });
  const two = seedWorkout(beto.id, { name: `Revisar dois ${t}` });
  const gone = seedWorkout(ari.id, { name: `Excluir ${t}` });
  const report = (id: string, reason: string, reportedUserId: string, activityId?: string) =>
    sql(`INSERT INTO "UserReport" (id, "reporterId", "reportedUserId", "activityId", reason, details)
         VALUES (${sqlText(id)}, ${sqlText(reporter.id)}, ${sqlText(reportedUserId)}, ${activityId ? sqlText(activityId) : "null"},
                 ${sqlText(reason)}, ${sqlText(`Detalhes ${id}`)})`);
  report(`r1-${t}`, "SPAM", ari.id, one.activityId);
  report(`r2-${t}`, "SPAM", beto.id, two.activityId);
  report(`r3-${t}`, "INAPPROPRIATE_CONTENT", ari.id, gone.activityId);
  report(`r4-${t}`, "HARASSMENT", beto.id);

  const admin = await newUserContext(browser, { label: "mod-admin", name: "Ada Admin" });
  await makeAdmin(admin.id, admin.context);
  const page = admin.page;
  await page.goto("/admin/reports");
  const card = (id: string) => page.locator(`[data-report="${id}-${t}"]`);
  const notice = page.getByRole("status").filter({ hasText: /^Denúncia resolvida/ });

  // Two decisions with the same outcome land on the same address: each card still leaves,
  // and the outcome line takes the focus each time (the card acted on is gone).
  await card("r1").getByRole("button", { name: "Marcar revisado" }).click();
  await expect(card("r1")).toHaveCount(0);
  await expect(notice).toHaveText("Denúncia resolvida · Revisada");
  await expect(notice).toBeFocused();
  const address = page.url();
  await card("r2").getByRole("button", { name: "Marcar revisado" }).click();
  await expect(card("r2")).toHaveCount(0);
  expect(page.url()).toBe(address);
  await expect(notice).toHaveText("Denúncia resolvida · Revisada");
  await expect(notice).toBeFocused();
  await serverRerender(page);
  await expect(notice).toHaveText("Denúncia resolvida · Revisada");
  await expect(card("r1").or(card("r2"))).toHaveCount(0);

  // "Excluir publicação" asks first; the post goes, the workout stays in its owner's history, private.
  await card("r3").getByRole("button", { name: "Excluir publicação" }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm.getByRole("heading", { name: "Excluir a publicação?" })).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await confirm.getByRole("button", { name: "Excluir publicação" }).click();
  await expect(card("r3")).toHaveCount(0);
  await expect(notice).toHaveText("Denúncia resolvida · Ação tomada");
  expect(sql(`SELECT count(*) FROM "Activity" WHERE id = ${sqlText(gone.activityId)}`)).toBe("0");
  expect(sql(`SELECT visibility FROM "WorkoutSession" WHERE id = ${sqlText(gone.sessionId)}`)).toBe("PRIVATE");

  // "Banir" asks for the reason and keeps it; the account leaves the app and disappears for everyone.
  await card("r4").getByRole("button", { name: `Banir @beto_${t}` }).click();
  const ban = page.getByRole("dialog");
  await expect(ban.getByRole("heading", { name: `Banir @beto_${t}?` })).toBeVisible();
  await ban.getByLabel("Motivo (fica registrado)").fill(`Assédio repetido ${t}`);
  await ban.getByRole("button", { name: `Banir @beto_${t}` }).click();
  await expect(card("r4")).toHaveCount(0);
  await expect(notice).toHaveText("Denúncia resolvida · Ação tomada");
  expect(sql(`SELECT banned::text || '|' || coalesce("banReason", '') FROM "user" WHERE id = ${sqlText(beto.id)}`)).toBe(
    `true|Assédio repetido ${t}`,
  );
  expect(sql(`SELECT count(*) FROM "session" WHERE "userId" = ${sqlText(beto.id)}`)).toBe("0");
  await reporter.page.goto(`/u/beto_${t}`);
  await expect(reporter.page.getByRole("heading", { level: 1, name: "Perfil não encontrado ou publicação privada." })).toBeVisible();

  // "Resolvidas" shows the decisions; lifting the ban brings the profile back.
  await page.getByRole("link", { name: "Resolvidas" }).click();
  await expect(card("r1")).toContainText("Revisada");
  await expect(card("r3")).toContainText(`Publicação excluída: Excluir ${t}`);
  await expect(card("r4")).toContainText(`Assédio repetido ${t}`);
  await expect(card("r4").getByText("Banido", { exact: true })).toBeVisible();
  await card("r4").getByRole("button", { name: `Desbanir @beto_${t}` }).click();
  const lifted = page.getByRole("status").filter({ hasText: "Banimento retirado." });
  await expect(lifted).toBeVisible();
  await expect(lifted).toBeFocused();
  await expect(page.getByRole("button", { name: `Desbanir @beto_${t}` })).toHaveCount(0);
  await serverRerender(page);
  await expect(lifted).toBeVisible();
  expect(sql(`SELECT coalesce(banned::text, 'null') FROM "user" WHERE id = ${sqlText(beto.id)}`)).toBe("false");
  await reporter.page.reload();
  await expect(reporter.page.getByRole("heading", { level: 1, name: "Beto Banido" })).toBeVisible();

  for (const u of [ari, beto, reporter, admin]) await u.context.close();
});

/**
 * What a client navigation from /admin to /admin/reports asks the server for:
 * only the segments that change — the admin layout is said to be on screen
 * already, so it isn't rendered again (nor its admin check). Next first sends
 * such a request to its ?_rsc= address. Returns the RSC payload.
 */
async function reportsPageWithoutTheLayout(request: APIRequestContext): Promise<string> {
  const headers = {
    RSC: "1",
    "Next-Router-State-Tree": encodeURIComponent(JSON.stringify(["", { children: ["admin", { children: ["__PAGE__", {}] }] }])),
  };
  let response = await request.get("/admin/reports", { headers, maxRedirects: 0 });
  if (response.status() === 307) response = await request.get(response.headers().location, { headers, maxRedirects: 0 });
  expect(response.status()).toBe(200);
  return response.text();
}

test("the moderation queue is only for admins — also to a request that skips the admin layout", async ({ browser }) => {
  const t = tag();
  const person = (key: string, name: string) => {
    const id = `gate-${key}-${t}`;
    sql(`INSERT INTO "user" (id, name, email, "emailVerified", username, "createdAt", "updatedAt")
         VALUES (${sqlText(id)}, ${sqlText(name)}, ${sqlText(`${id}@fgpower.test`)}, true, ${sqlText(`${key}_${t}`)}, now(), now())`);
    return id;
  };
  const reporter = person("rel", "Rê Relata");
  const reported = person("alvo", "Alvo Denunciado");
  const secret = `Detalhe só para admins ${t}`;
  sql(`INSERT INTO "UserReport" (id, "reporterId", "reportedUserId", reason, details)
       VALUES (${sqlText(`gate-${t}`)}, ${sqlText(reporter)}, ${sqlText(reported)}, 'HARASSMENT', ${sqlText(secret)})`);

  // Signed out, and signed in without the role: sent away (to sign in / to the app), nothing of the queue.
  const anonymous = await browser.newContext();
  const asAnonymous = await reportsPageWithoutTheLayout(anonymous.request);
  expect(asAnonymous).not.toContain(secret);
  expect(asAnonymous).not.toContain(`alvo_${t}`);
  expect(asAnonymous).toContain("NEXT_REDIRECT;replace;/login");

  const member = await browser.newContext();
  const memberPage = await member.newPage();
  await loginAsTestUser(memberPage, `gate-member-${t}@fgpower.dev`, "Membro Comum");
  const asMember = await reportsPageWithoutTheLayout(member.request);
  expect(asMember).not.toContain(secret);
  expect(asMember).toContain("NEXT_REDIRECT;replace;/app/today");

  // An admin gets the page through the very same request (so the two above really asked for it).
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();
  await loginAsTestUser(adminPage, `gate-admin-${t}@fgpower.dev`, "Ada Admin");
  await makeAdmin(await userIdOf(adminPage), admin);
  expect(await reportsPageWithoutTheLayout(admin.request)).toContain(secret);

  sql(`UPDATE "UserReport" SET status = 'DISMISSED', "resolvedAt" = now() WHERE id = ${sqlText(`gate-${t}`)}`);
  for (const context of [anonymous, member, admin]) await context.close();
});

test("'Abrir no app' on a reported workout is offered only where the admin can open it", async ({ browser }) => {
  const t = tag();
  const person = (key: string, name: string) => {
    const id = `open-${key}-${t}`;
    sql(`INSERT INTO "user" (id, name, email, "emailVerified", username, "createdAt", "updatedAt")
         VALUES (${sqlText(id)}, ${sqlText(name)}, ${sqlText(`${id}@fgpower.test`)}, true, ${sqlText(`${key}_${t}`)}, now(), now());
         INSERT INTO "Profile" (id, "userId", "displayName", "onboardingCompletedAt", "isPublicAccount", "updatedAt")
         VALUES (${sqlText(`${id}-p`)}, ${sqlText(id)}, ${sqlText(name)}, now(), true, now())`);
    return id;
  };
  const author = person("autora", "Ana Autora");
  const reporter = person("rel", "Rê Relata");
  const open = seedWorkout(author, { name: `Aberto ${t}` });
  const closed = seedWorkout(author, { name: `Só seguidores ${t}`, visibility: "FOLLOWERS" });
  for (const [key, activityId] of [["pub", open.activityId], ["seg", closed.activityId]]) {
    sql(`INSERT INTO "UserReport" (id, "reporterId", "reportedUserId", "activityId", reason)
         VALUES (${sqlText(`open-${key}-${t}`)}, ${sqlText(reporter)}, ${sqlText(author)}, ${sqlText(activityId)}, 'SPAM')`);
  }
  const admin = await newUserContext(browser, { label: "open-admin", name: "Ada Admin" });
  await makeAdmin(admin.id, admin.context);
  const page = admin.page;
  const openIn = (key: string) => page.locator(`[data-report="open-${key}-${t}"]`).getByRole("link", { name: "Abrir no app" });

  // A public post opens; a followers-only one (the default) is shown on the card, with no link to a "página não existe".
  await page.goto("/admin/reports");
  await expect(page.locator(`[data-report="open-seg-${t}"]`)).toContainText(`Só seguidores ${t}`);
  await expect(openIn("seg")).toHaveCount(0);
  await openIn("pub").click();
  await expect(page).toHaveURL(new RegExp(`/app/activity/${open.activityId}$`));
  await expect(page.getByText(`Aberto ${t}`).first()).toBeVisible();

  // Once the admin follows the author, that post opens too.
  follow(admin.id, author);
  await page.goto("/admin/reports");
  await openIn("seg").click();
  await expect(page).toHaveURL(new RegExp(`/app/activity/${closed.activityId}$`));
  await expect(page.getByText(`Só seguidores ${t}`).first()).toBeVisible();

  sql(`UPDATE "UserReport" SET status = 'DISMISSED', "resolvedAt" = now() WHERE id LIKE ${sqlText(`open-%-${t}`)}`);
  await admin.context.close();
});

test("a workout report from before reports named a person shows the author, who can be banned from it", async ({ browser }) => {
  const t = tag();
  const person = (key: string, name: string) => {
    const id = `old-${key}-${t}`;
    sql(`INSERT INTO "user" (id, name, email, "emailVerified", username, "createdAt", "updatedAt")
         VALUES (${sqlText(id)}, ${sqlText(name)}, ${sqlText(`${id}@fgpower.test`)}, true, ${sqlText(`${key}_${t}`)}, now(), now());
         INSERT INTO "Profile" (id, "userId", "displayName", "onboardingCompletedAt", "isPublicAccount", "updatedAt")
         VALUES (${sqlText(`${id}-p`)}, ${sqlText(id)}, ${sqlText(name)}, now(), true, now())`);
    return id;
  };
  const author = person("velho", "Vítor Velho");
  const reporter = person("rel", "Rê Relata");
  const { activityId } = seedWorkout(author, { name: `Treino antigo ${t}` });
  // As the old report button filed them: the workout and a reason, no person, no snapshot.
  sql(`INSERT INTO "UserReport" (id, "reporterId", "activityId", reason) VALUES (${sqlText(`old-${t}`)}, ${sqlText(reporter)}, ${sqlText(activityId)}, 'SPAM');
       INSERT INTO "UserReport" (id, "reporterId", reason) VALUES (${sqlText(`orphan-${t}`)}, ${sqlText(reporter)}, 'SPAM')`);

  const admin = await browser.newContext();
  const page = await admin.newPage();
  await loginAsTestUser(page, `old-admin-${t}@fgpower.dev`, "Ada Admin");
  const adminId = await userIdOf(page);
  await makeAdmin(adminId, admin);
  // Someone reported the admin: an admin is never banned (moderateReport refuses), so no button offers it.
  sql(`INSERT INTO "UserReport" (id, "reporterId", "reportedUserId", reason) VALUES (${sqlText(`self-${t}`)}, ${sqlText(reporter)}, ${sqlText(adminId)}, 'SPAM')`);
  await page.goto("/admin/reports");
  const aboutAdmin = page.locator(`[data-report="self-${t}"]`);
  await expect(aboutAdmin.getByRole("button", { name: "Marcar revisado" })).toBeVisible();
  await expect(aboutAdmin.getByRole("button", { name: /^Banir/ })).toHaveCount(0);
  const card = page.locator(`[data-report="old-${t}"]`);
  await expect(card.getByRole("link", { name: /Vítor Velho/ })).toHaveAttribute("href", `/u/velho_${t}`);
  // The orphan (its post gone, no person): nobody to name or ban.
  const orphan = page.locator(`[data-report="orphan-${t}"]`);
  await expect(orphan).toContainText("Não identificado");
  await expect(orphan.getByRole("button", { name: /^Banir/ })).toHaveCount(0);

  await card.getByRole("button", { name: `Banir @velho_${t}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: `Banir @velho_${t}` }).click();
  await expect(card).toHaveCount(0);
  expect(sql(`SELECT banned::text FROM "user" WHERE id = ${sqlText(author)}`)).toBe("true");
  await page.getByRole("link", { name: "Resolvidas" }).click();
  await expect(card.getByText("Banido", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: `Desbanir @velho_${t}` }).click();
  await expect(page.getByRole("status").filter({ hasText: "Banimento retirado." })).toBeVisible();
  expect(sql(`SELECT banned::text FROM "user" WHERE id = ${sqlText(author)}`)).toBe("false");

  sql(`UPDATE "UserReport" SET status = 'DISMISSED', "resolvedAt" = now() WHERE id IN (${sqlText(`orphan-${t}`)}, ${sqlText(`self-${t}`)})`);
  await admin.close();
});

test("signed out meanwhile: a report and a removal say the session expired, with a way back", async ({ browser }) => {
  const t = tag();
  const author = await newUserContext(browser, { label: "exp-author", name: "Eva Autora", handle: `eva_${t}`, isPublicAccount: true });
  const { activityId } = seedWorkout(author.id, { name: `Treino ${t}` });
  const viewer = await newUserContext(browser, { label: "exp-viewer", name: "Vic Vê" });
  follow(viewer.id, author.id);

  // Reporting a workout.
  const workoutPath = `/app/activity/${activityId}`;
  await viewer.page.goto(workoutPath);
  await viewer.page.getByRole("button", { name: "Denunciar" }).click();
  await viewer.page.getByRole("dialog").getByLabel("Spam").check();
  await revokeSessions(viewer.id, viewer.context);
  await viewer.page.getByRole("dialog").getByRole("button", { name: "Enviar denúncia" }).click();
  await expectSessionExpired(viewer.page, workoutPath);
  expect(sql(`SELECT count(*) FROM "UserReport" WHERE "reporterId" = ${sqlText(viewer.id)}`)).toBe("0");

  // Removing a follower.
  await author.page.goto("/app/profile/seguidores");
  const row = author.page.locator("li").filter({ hasText: `@${viewer.username}` });
  await revokeSessions(author.id, author.context);
  await row.getByRole("button", { name: `Remover @${viewer.username} dos seguidores` }).click();
  await author.page.getByRole("dialog").getByRole("button", { name: "Remover", exact: true }).click();
  await expectSessionExpired(author.page, "/app/profile/seguidores");
  expect(sql(`SELECT count(*) FROM "Follow" WHERE "followerId" = ${sqlText(viewer.id)} AND "followingId" = ${sqlText(author.id)}`)).toBe("1");

  for (const u of [author, viewer]) await u.context.close();
});
