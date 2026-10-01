import { test, expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import {
  IPHONE,
  follow,
  loginAsTestUser,
  newOnboardedUser,
  newUserContext,
  setProfile,
  sql,
  sqlText,
  userIdOf,
  type TestUser,
} from "./fixtures";
import { newUserOnGd1, uniqueEmail } from "./workout-helpers";

/**
 * Discovery, feed, workout page and public profile (Batch 5, cluster C2):
 * a profile opened from the app keeps the app around it (W-140), undoing a
 * follow asks first (W-045), Descobrir suggests people and follows in place
 * (W-047, W-145), the feed grows in steps (W-142) and marks your own posts'
 * audience (W-144), a post's owner controls who sees it or deletes it and
 * everyone sees who gave FG (W-143), Today shows the team (W-139), a
 * profile's program links to its dossier (W-146), FG explains itself once
 * (W-147) and the owner's empty profile says why (W-048 §6).
 */
test.use(IPHONE);
test.describe.configure({ timeout: 150_000 });

const tag = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5);

/** A finished workout and its post, written straight to the DB. Returns their ids. */
function seedWorkout(
  userId: string,
  opts: {
    name?: string;
    visibility?: "PRIVATE" | "FOLLOWERS" | "PUBLIC";
    /** SQL timestamp expression. */
    at?: string;
    exercises?: object[];
    showDetailedLoads?: boolean;
    id?: string;
  } = {},
) {
  const id = opts.id ?? `${userId}-${tag()}`;
  const name = opts.name ?? "Superior (pesado)";
  const at = opts.at ?? "now()";
  const visibility = opts.visibility ?? "FOLLOWERS";
  const summary = {
    workoutName: name,
    durationSeconds: 3600,
    totalWorkingSets: 18,
    totalVolumeKg: null,
    prs: [],
    exercises: opts.exercises ?? [],
  };
  sql(`INSERT INTO "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "durationSeconds", visibility, "updatedAt")
       VALUES (${sqlText(`${id}-s`)}, ${sqlText(userId)}, ${sqlText(name)}, 'COMPLETED', ${at} - interval '1 hour', ${at}, 3600, '${visibility}', ${at})`);
  sql(`INSERT INTO "Activity" (id, "userId", type, "sessionId", visibility, "showDetailedLoads", summary, "createdAt", "updatedAt")
       VALUES (${sqlText(`${id}-a`)}, ${sqlText(userId)}, 'WORKOUT', ${sqlText(`${id}-s`)}, '${visibility}', ${opts.showDetailedLoads ?? false},
               ${sqlText(JSON.stringify(summary))}::jsonb, ${at}, ${at})`);
  return { sessionId: `${id}-s`, activityId: `${id}-a` };
}

/** Puts `userId` on the GD 1 template (an ACTIVE fork), as activating it would. */
function onGd1(userId: string, name = "GD 1") {
  sql(`INSERT INTO "UserProgram" (id, "userId", name, "sourceTemplateId", status, "createdAt", "updatedAt")
       SELECT ${sqlText(`${userId}-p`)}, ${sqlText(userId)}, ${sqlText(name)}, id, 'ACTIVE', now(), now()
       FROM "WorkoutTemplate" WHERE slug = 'gd-1'`);
}

/** Clicks and waits for the server action it runs (an optimistic UI changes before the server has it). */
async function clickAction(page: Page, target: Locator) {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined),
    target.click(),
  ]);
}

async function noSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
}

/**
 * A server re-render of the page on screen (router.refresh()) — what
 * better-auth's session refresh sets off inside any action run 5+ minutes
 * after the last one (recovery R5): what a tap just confirmed must read the
 * same after it. `landed` is something only the new render shows (a row
 * changed in the DB meanwhile), proving it arrived.
 */
async function rerender(page: Page, landed?: Locator) {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "GET" && r.request().headers()["rsc"] === "1"),
    page.evaluate(() => (window as unknown as { next: { router: { refresh(): void } } }).next.router.refresh()),
  ]);
  if (landed) await expect(landed).toBeVisible();
  // React commits the new tree in a transition.
  else await page.waitForTimeout(500);
}

/**
 * R5's real trigger: drops better-auth's 5-minute session cache cookie, so the
 * next action re-reads the session and writes the cookie again — and Next
 * re-renders the page on screen inside that action, as in real use 5+ minutes
 * after the last one.
 */
async function expireSessionCache(context: BrowserContext) {
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name.endsWith("session_data"))).toBe(true);
  await context.clearCookies();
  await context.addCookies(cookies.filter((c) => !c.name.endsWith("session_data")));
}

/** Clicks, waits for the server action, and says whether its response rewrote a cookie (the re-render's cause). */
async function clickActionRewritingCookie(page: Page, target: Locator) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined),
    target.click(),
  ]);
  expect((await response.allHeaders())["set-cookie"] ?? "", "the action rewrote the session cache cookie").toContain("session_data");
}

/** A public, onboarded account with `handle`, written straight to the DB (no browser). Returns its id. */
function publicPerson(handle: string, name: string): string {
  const id = `c2-person-${handle}`;
  sql(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", username, "displayUsername")
       VALUES (${sqlText(id)}, ${sqlText(name)}, ${sqlText(`${id}@fgpower.dev`)}, true, now(), now(), ${sqlText(handle)}, ${sqlText(handle)})`);
  sql(`INSERT INTO "Profile" (id, "userId", "displayName", "onboardingCompletedAt", "isPublicAccount", "updatedAt")
       VALUES (${sqlText(`${id}-p`)}, ${sqlText(id)}, ${sqlText(name)}, now(), true, now())`);
  return id;
}

/** A banned account (an admin's "Banir"), written straight to the DB. Returns its id. */
function bannedUser(label: string): string {
  const id = `c2-banned-${label}-${tag()}`;
  sql(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", banned)
       VALUES (${sqlText(id)}, 'Conta Banida', ${sqlText(`${id}@fgpower.dev`)}, true, now(), now(), true)`);
  return id;
}

test("a profile opened from the app keeps the app around it; signed out, it has a way in (W-140)", async ({ browser }) => {
  const t = tag();
  const author = await newUserContext(browser, { label: "c2-author", name: "Ana Autora", handle: `ana_${t}`, isPublicAccount: true });
  const viewer = await newUserContext(browser, { label: "c2-viewer", name: "Vitor Leitor", handle: `vitor_${t}` });
  follow(viewer.id, author.id);
  // A banned account's follow isn't counted (the lists leave it out too).
  follow(bannedUser("fan"), author.id);
  seedWorkout(author.id, { name: "Push A" });
  const page = viewer.page;

  // From the feed, the author's name opens their profile inside the app.
  await page.goto("/app/feed");
  await Promise.all([page.waitForURL(`/u/ana_${t}`), page.getByRole("link", { name: /Ana Autora/ }).first().click()]);
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "Perfil" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "Ana Autora" })).toBeVisible();
  // "Voltar" goes back to where the user was.
  await Promise.all([page.waitForURL(/\/app\/feed$/), page.getByRole("link", { name: "Voltar" }).click()]);

  // Opened directly (a shared link): "Voltar" falls back to the feed.
  await page.goto(`/u/ana_${t}`);
  await expect(page.getByRole("link", { name: "Voltar" })).toHaveAttribute("href", "/app/feed");
  await expect(page).toHaveTitle(new RegExp(`Ana Autora \\(@ana_${t}\\)`));
  // Someone else's counts are plain text: the lists are the owner's own.
  await expect(page.locator("[data-follower-count]")).toHaveText("1 seguidor");
  await expect(page.getByRole("link", { name: /ver lista/ })).toHaveCount(0);

  // Your own profile: back to Perfil, with its edit and share buttons…
  await page.goto(`/u/vitor_${t}`);
  await expect(page.getByRole("link", { name: "Voltar" })).toHaveAttribute("href", "/app/profile");
  await expect(page.getByRole("link", { name: "Editar perfil" })).toHaveAttribute("href", "/app/settings");
  await expect(page.getByRole("button", { name: "Compartilhar perfil" })).toBeVisible();
  // …and counts that open your lists (named as on Perfil).
  const followers = page.getByRole("link", { name: "0 seguidores — ver lista" });
  await expect(followers).toHaveAttribute("href", "/app/profile/seguidores");
  expect((await followers.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await Promise.all([
    page.waitForURL(/\/app\/profile\/seguindo$/),
    page.getByRole("link", { name: "Seguindo 1 pessoa — ver lista" }).click(),
  ]);
  await expect(page.getByRole("heading", { level: 1, name: "Seguindo" })).toBeVisible();
  await expect(page.locator("li").filter({ hasText: `@ana_${t}` })).toBeVisible();
  // Ana's own view: the banned follower isn't in her count either.
  await author.page.goto(`/u/ana_${t}`);
  await expect(author.page.getByRole("link", { name: "1 seguidor — ver lista" })).toHaveAttribute("href", "/app/profile/seguidores");

  // A profile that doesn't exist, signed in: ways back into the app, titled like every 404 (one title, not two).
  await page.goto(`/u/ninguem_${t}`);
  await expect(page.getByRole("heading", { name: /Perfil não encontrado/ })).toBeVisible();
  await expect(page).toHaveTitle("Página não encontrada · FGPOWER");
  expect(new Set(await page.locator("head title").allTextContents())).toEqual(new Set(["Página não encontrada · FGPOWER"]));
  await expect(page.getByRole("link", { name: "Ir para Hoje" })).toHaveAttribute("href", "/app/today");
  await expect(page.getByRole("link", { name: "Descobrir pessoas" })).toHaveAttribute("href", "/app/discover");

  // Signed out: the public header, no app navigation, a way in that comes back here.
  const anonContext = await browser.newContext(IPHONE);
  const anon = await anonContext.newPage();
  await anon.goto(`/u/ana_${t}`);
  await expect(anon.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);
  const header = anon.locator("header");
  await expect(header.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", `/login?next=${encodeURIComponent(`/u/ana_${t}`)}`);
  await expect(header.getByRole("link", { name: "Criar conta" })).toBeVisible();
  const brand = header.getByRole("link", { name: "FGPOWER — página inicial" });
  expect((await brand.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(anon.getByRole("link", { name: "Entre para seguir" })).toBeVisible();
  await expect(anon.getByRole("link", { name: /Criar conta grátis/ })).toBeVisible();
  // Public account, findable: search engines may index it.
  await expect(anon.locator('meta[name="robots"]')).toHaveAttribute("content", /^index/);
  for (const width of [320, 390]) {
    await anon.setViewportSize({ width, height: 800 });
    await noSideScroll(anon);
    await expect(header.getByRole("link", { name: "Criar conta" })).toBeInViewport();
  }
  await anonContext.close();

  // Signed in, onboarding unfinished: "Concluir cadastro" comes back here.
  const newbieContext = await browser.newContext(IPHONE);
  const newbie = await newbieContext.newPage();
  await loginAsTestUser(newbie, uniqueEmail("c2-newbie"));
  await newbie.goto(`/u/ana_${t}`);
  await expect(newbie.getByRole("link", { name: "Concluir cadastro" })).toHaveAttribute(
    "href",
    `/onboarding?next=${encodeURIComponent(`/u/ana_${t}`)}`,
  );
  await expect(newbie.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);
  await newbieContext.close();

  await author.context.close();
  await viewer.context.close();
});

test("undoing a follow or a request asks first (W-045)", async ({ browser }) => {
  const t = tag();
  const pub = await newUserContext(browser, { label: "c2-pub", name: "Paula Pública", handle: `paula_${t}`, isPublicAccount: true });
  const priv = await newUserContext(browser, { label: "c2-priv", name: "Pedro Privado", handle: `pedro_${t}`, isPublicAccount: false });
  const fan = await newUserContext(browser, { label: "c2-fan", name: "Fábio Fã" });
  follow(fan.id, pub.id);
  const page = fan.page;

  await page.goto(`/u/paula_${t}`);
  const count = page.locator("[data-follower-count]");
  await expect(count).toHaveText("1 seguidor");
  await page.getByRole("button", { name: "Seguindo" }).click();
  const sheet = page.getByRole("dialog", { name: `Deixar de seguir @paula_${t}?` });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("saem do seu feed");
  // Cancelar (the focused choice) changes nothing.
  await expect(sheet.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await sheet.getByRole("button", { name: "Cancelar" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(count).toHaveText("1 seguidor");
  await page.reload();
  await page.getByRole("button", { name: "Seguindo" }).click();
  await clickAction(page, page.getByRole("dialog").getByRole("button", { name: "Deixar de seguir" }));
  await expect(page.getByRole("button", { name: "Seguir", exact: true })).toBeVisible();
  const unfollowed = page.getByRole("status").filter({ hasText: `Você deixou de seguir @paula_${t}.` });
  await expect(unfollowed).toHaveCount(1);
  // The count follows the tap at once (the action doesn't re-render the page)…
  await expect(count).toHaveText("0 seguidores");
  // …and a server re-render (R5) — with Pedro following Paula meanwhile — keeps all of it right.
  follow(priv.id, pub.id);
  await rerender(page, count.getByText("1", { exact: true }));
  await expect(count).toHaveText("1 seguidor");
  await expect(page.getByRole("button", { name: "Seguir", exact: true })).toBeVisible();
  await expect(unfollowed).toHaveCount(1);
  expect(sql(`SELECT count(*) FROM "Follow" WHERE "followerId" = ${sqlText(fan.id)}`)).toBe("0");
  // Following again counts the fan in, through a re-render and a reload.
  await clickAction(page, page.getByRole("button", { name: "Seguir", exact: true }));
  await expect(page.getByRole("button", { name: "Seguindo" })).toBeVisible();
  await expect(count).toHaveText("2 seguidores");
  await rerender(page);
  await expect(count).toHaveText("2 seguidores");
  await expect(page.getByRole("button", { name: "Seguindo" })).toBeVisible();
  await page.reload();
  await expect(count).toHaveText("2 seguidores");
  await expect(page.getByRole("button", { name: "Seguindo" })).toBeVisible();

  // A private account: a request, and cancelling it asks too; Escape keeps it. A request isn't a follower.
  await page.goto(`/u/pedro_${t}`);
  await expect(count).toHaveText("0 seguidores");
  await clickAction(page, page.getByRole("button", { name: "Solicitar seguir" }));
  await expect(count).toHaveText("0 seguidores");
  await page.getByRole("button", { name: "Solicitação enviada" }).click();
  const cancel = page.getByRole("dialog", { name: `Cancelar a solicitação para @pedro_${t}?` });
  await expect(cancel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cancel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Solicitação enviada" })).toBeVisible();
  await page.getByRole("button", { name: "Solicitação enviada" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar solicitação" }).click();
  await expect(page.getByRole("button", { name: "Solicitar seguir" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Solicitar seguir" })).toBeVisible();

  // Unfollowing a private account warns the workouts go until a new approval.
  follow(fan.id, priv.id);
  await page.reload();
  await page.getByRole("button", { name: "Seguindo" }).click();
  await expect(page.getByRole("dialog")).toContainText("esperar a aprovação");

  for (const u of [pub, priv, fan]) await u.context.close();
});

test("a follow still reads right after going into a workout and back (W-045, W-145)", async ({ browser }) => {
  const t = tag();
  const author = await newUserContext(browser, { label: "c2-back-author", name: "Beatriz Volta", handle: `bea_${t}`, isPublicAccount: true });
  const fan = await newUserContext(browser, { label: "c2-back-fan", name: "Fernando Ida" });
  const post = seedWorkout(author.id, { name: "Push D", visibility: "PUBLIC" });
  const page = fan.page;
  const count = page.locator("[data-follower-count]");
  const intoWorkout = () =>
    Promise.all([page.waitForURL(new RegExp(post.activityId)), page.getByRole("link", { name: /Ver detalhes/ }).click()]);

  // Back/forward reuses a page's last render: the follow must be in it, not only in the button's state.
  await page.goto(`/u/bea_${t}`);
  await expect(count).toHaveText("0 seguidores");
  await clickAction(page, page.getByRole("button", { name: "Seguir", exact: true }));
  await expect(count).toHaveText("1 seguidor");
  await intoWorkout();
  await Promise.all([page.waitForURL(new RegExp(`/u/bea_${t}$`)), page.getByRole("link", { name: "Voltar" }).click()]);
  await expect(page.getByRole("button", { name: "Seguindo" })).toBeVisible();
  await expect(count).toHaveText("1 seguidor");

  // An unfollow, then the system back.
  await page.getByRole("button", { name: "Seguindo" }).click();
  await clickAction(page, page.getByRole("dialog").getByRole("button", { name: "Deixar de seguir" }));
  await expect(count).toHaveText("0 seguidores");
  await intoWorkout();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/u/bea_${t}$`));
  await expect(page.getByRole("button", { name: "Seguir", exact: true })).toBeVisible();
  await expect(count).toHaveText("0 seguidores");

  // Descobrir: follow from a search result, open the profile, come back.
  await page.goto(`/app/discover?q=${encodeURIComponent(`bea_${t}`)}`);
  const row = page.locator(".reg-frame").filter({ has: page.getByRole("link", { name: new RegExp(`bea_${t}`) }) });
  await clickAction(page, row.getByRole("button", { name: "Seguir", exact: true }));
  await expect(row.getByRole("button", { name: "Seguindo" })).toBeVisible();
  await Promise.all([page.waitForURL(new RegExp(`/u/bea_${t}$`)), row.getByRole("link", { name: new RegExp(`bea_${t}`) }).click()]);
  await expect(page.getByRole("button", { name: "Seguindo" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/discover\?q=/);
  await expect(row.getByRole("button", { name: "Seguindo" })).toBeVisible();
  expect(sql(`SELECT count(*) FROM "Follow" WHERE "followerId" = ${sqlText(fan.id)} AND "followingId" = ${sqlText(author.id)}`)).toBe("1");

  await author.context.close();
  await fan.context.close();
});

test("Descobrir suggests people, follows in place and invites a friend (W-047, W-145)", async ({ page, browser, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const t = tag();
  await newUserOnGd1(page, "c2-disc");
  const meId = await userIdOf(page);
  const meHandle = sql(`SELECT username FROM "user" WHERE id = ${sqlText(meId)}`);
  const myName = sql(`SELECT "displayName" FROM "Profile" WHERE "userId" = ${sqlText(meId)}`);

  // Dora runs GD 1 and trained today; Edu trained this week on something else.
  const dora = await newUserContext(browser, { label: "c2-dora", name: `Dora ${t}`, handle: `dora_${t}`, isPublicAccount: true });
  onGd1(dora.id);
  seedWorkout(dora.id, { name: "Superior A", visibility: "PUBLIC" });
  const edu = await newUserContext(browser, { label: "c2-edu", name: `Edu ${t}`, handle: `edu_${t}`, isPublicAccount: true });
  seedWorkout(edu.id, { name: "Pull B", visibility: "PUBLIC" });

  await page.goto("/app/discover");
  await expect(page.getByText("Encontre amigos pelo nome ou @usuário.")).toBeVisible();
  const same = page.locator("section").filter({ has: page.getByRole("heading", { name: "Treinando o mesmo programa" }) });
  const doraRow = same.locator(".reg-frame").filter({ has: page.getByRole("link", { name: new RegExp(`dora_${t}`) }) });
  await expect(doraRow).toContainText(`Dora ${t}`);
  await expect(doraRow).toContainText(/Treinando: GD 1/i);
  const active = page.locator("section").filter({ has: page.getByRole("heading", { name: "Ativos esta semana" }) });
  const eduRow = active.locator(".reg-frame").filter({ has: page.getByRole("link", { name: new RegExp(`edu_${t}`) }) });
  await expect(eduRow).toContainText(/Treinou hoje · Pull B/i);
  // Nobody twice on the page.
  await expect(page.getByRole("link", { name: new RegExp(`dora_${t}`) })).toHaveCount(1);

  // Follow straight from the row. A server re-render (R5) keeps the row and its "Seguindo" in
  // place; after a reload Dora is no longer a suggestion.
  const sameCount = same.getByText(/^\d+ pessoas?$/);
  const listed = await sameCount.textContent();
  await clickAction(page, doraRow.getByRole("button", { name: "Seguir", exact: true }));
  await expect(doraRow.getByRole("button", { name: "Seguindo" })).toBeVisible();
  await rerender(page);
  await expect(doraRow.getByRole("button", { name: "Seguindo" })).toBeVisible();
  await expect(sameCount).toHaveText(listed!);
  await page.reload();
  await expect(page.getByRole("link", { name: new RegExp(`dora_${t}`) })).toHaveCount(0);

  // The invite: the profile link goes to the clipboard.
  const invite = page.locator("section").filter({ has: page.getByRole("heading", { name: "Convide um amigo" }) });
  await expect(invite).toContainText("Treinar junto rende mais.");
  await invite.getByRole("button", { name: "Compartilhar perfil" }).click();
  await expect(invite.getByText("Link do perfil copiado")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`/u/${meHandle}$`));

  // Search: never yourself; a result says the relation and follows in place.
  await page.goto(`/app/discover?q=${encodeURIComponent(myName)}`);
  await expect(page.getByRole("link", { name: new RegExp(meHandle) })).toHaveCount(0);
  await page.goto(`/app/discover?q=${encodeURIComponent(`@dora_${t}`)}`);
  const result = page.locator(".reg-frame").filter({ has: page.getByRole("link", { name: new RegExp(`dora_${t}`) }) });
  await expect(result.getByRole("button", { name: "Seguindo" })).toBeVisible();
  await page.goto(`/app/discover?q=${encodeURIComponent(`edu_${t}`)}`);
  const eduResult = page.locator(".reg-frame").filter({ has: page.getByRole("link", { name: new RegExp(`edu_${t}`) }) });
  await clickAction(page, eduResult.getByRole("button", { name: "Seguir", exact: true }));
  await expect(eduResult.getByRole("button", { name: "Seguindo" })).toBeVisible();
  await page.reload();
  await expect(eduResult.getByRole("button", { name: "Seguindo" })).toBeVisible();

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/app/discover");
    await noSideScroll(page);
  }

  // An account without a @handle yet (older ones) is sent to choose one, at Settings' "Usuário público"
  // (landing on it in view: the Settings-landing test at the end).
  sql(`UPDATE "user" SET username = NULL, "displayUsername" = NULL WHERE id = ${sqlText(meId)}`);
  await page.goto("/app/discover");
  await expect(invite.getByRole("button", { name: "Compartilhar perfil" })).toHaveCount(0);
  await Promise.all([
    page.waitForURL(/\/app\/settings#usuario$/),
    invite.getByRole("link", { name: "Escolha seu @usuário" }).click(),
  ]);
  await expect(page.locator("#usuario").getByRole("heading", { level: 2, name: "Usuário público" })).toBeVisible();

  await dora.context.close();
  await edu.context.close();
});

test("an empty feed shows the community, and FG explains itself until the first one (W-047, W-147)", async ({ page, browser }) => {
  const t = tag();
  const star = await newUserContext(browser, { label: "c2-star", name: `Estrela ${t}`, handle: `estrela_${t}`, isPublicAccount: true });
  const starPost = seedWorkout(star.id, { name: `Treino da Estrela ${t}`, visibility: "PUBLIC" });
  await newOnboardedUser(page, { label: "c2-lonely" });

  await page.goto("/app/feed");
  await expect(page.getByText("Seu feed está vazio")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Da comunidade" })).toBeVisible();
  const card = page.locator("article").filter({ hasText: `Treino da Estrela ${t}` });
  await expect(card).toBeVisible();
  const hint = page.getByText("FG é o reconhecimento pelo treino: toque no ♥ para dar o seu.");
  await expect(hint).toHaveCount(1);
  await expect(card.getByText(/FG é o reconhecimento/)).toBeVisible();
  const fg = card.getByRole("button", { name: /^Dar FG no treino/ });
  await expect(fg).toHaveAttribute("title", "FG — reconhecimento pelo treino");
  await clickAction(page, fg);
  const given = card.getByRole("button", { name: /^Remover FG .*\(1\)$/ });
  await expect(given).toHaveAttribute("aria-pressed", "true");
  await expect(hint).toHaveCount(0);
  // A server re-render (R5; the new caption shows it landed) keeps the FG and its count.
  sql(`UPDATE "Activity" SET caption = 'Dia de costas' WHERE id = ${sqlText(starPost.activityId)}`);
  await rerender(page, card.getByText("Dia de costas"));
  await expect(given).toHaveAttribute("aria-pressed", "true");
  await expect(hint).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Da comunidade" })).toBeVisible();
  await expect(hint).toHaveCount(0);

  await star.context.close();
});

test("a profile grows 20 workouts at a time, landing on the first new one (W-142)", async ({ page, browser }) => {
  const t = tag();
  const prolific = await newUserContext(browser, { label: "c2-prolific", name: "Pedro Constante", handle: `pedro_${t}`, isPublicAccount: true });
  for (let i = 0; i < 21; i++) seedWorkout(prolific.id, { name: `Sessão ${i + 1}`, visibility: "PUBLIC", at: `now() - interval '${i + 1} hours'` });
  await newOnboardedUser(page, { label: "c2-profile-reader" });

  await page.goto(`/u/pedro_${t}`);
  const cards = page.locator("article");
  await expect(cards).toHaveCount(20);
  await expect(page.getByRole("status").filter({ hasText: "Mostrando 20 treinos" })).toHaveCount(1);
  // From the keyboard: the page re-renders around the longer list, and focus lands on the first new card.
  await page.getByRole("link", { name: "Carregar mais" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/u/pedro_${t}\\?p=2#treino-21$`));
  await expect(cards).toHaveCount(21);
  await expect(page.locator("#treino-21")).toBeInViewport();
  await expect(page.locator("#treino-21")).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Mostrando 21 treinos" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Carregar mais" })).toHaveCount(0);

  await prolific.context.close();
});

test("the feed grows in steps and marks who sees your own posts (W-142, W-144)", async ({ page, browser }) => {
  const reader = await newOnboardedUser(page, { label: "c2-reader" });
  const busy = await newUserContext(browser, { label: "c2-busy", name: "Bia Assídua", isPublicAccount: true });
  follow(reader.id, busy.id);
  for (let i = 0; i < 20; i++) seedWorkout(busy.id, { name: `Treino ${i + 1}`, at: `now() - interval '${i + 2} hours'` });
  // A long workout: its "Quem vê" sits below the fold.
  const mine = seedWorkout(reader.id, {
    name: "Meu privado",
    visibility: "PRIVATE",
    at: "now() - interval '1 hour'",
    exercises: Array.from({ length: 16 }, (_, i) => ({ name: `Exercício ${i + 1}`, workingSets: 3, bestSet: null })),
  });
  const shared = seedWorkout(reader.id, { name: "Meu compartilhado", visibility: "FOLLOWERS", at: "now() - interval '90 minutes'" });

  await page.goto("/app/feed");
  const cards = page.locator("article");
  await expect(cards).toHaveCount(15);
  // Your own posts carry who sees them; other people's don't.
  const own = cards.filter({ hasText: "Meu privado" });
  await expect(own.getByRole("link", { name: "Visibilidade: Privado. Alterar" })).toBeVisible();
  await expect(cards.filter({ hasText: "Meu compartilhado" }).getByRole("link", { name: "Visibilidade: Seguidores. Alterar" })).toBeVisible();
  await expect(cards.filter({ hasText: "Bia Assídua" }).first().getByRole("link", { name: /^Visibilidade/ })).toHaveCount(0);

  await page.getByRole("link", { name: "Carregar mais" }).click();
  await expect(page).toHaveURL(/\/app\/feed\?p=2/);
  await expect(cards).toHaveCount(22);
  // The page lands on the first card it added, not back at the top — focus too (the link is gone).
  await expect(page.locator("#treino-16")).toBeInViewport();
  await expect(page.locator("#treino-16")).toBeFocused();
  await expect(page.getByRole("link", { name: "Carregar mais" })).toHaveCount(0);
  await expect(page.getByText("Fim do feed")).toBeVisible();

  // The chip opens the post's "Quem vê", in view (its page loads behind a skeleton).
  await page.goto("/app/feed");
  await page.mouse.wheel(0, 300);
  await Promise.all([
    page.waitForURL(new RegExp(`/app/activity/${mine.activityId}#quem-ve$`)),
    own.getByRole("link", { name: "Visibilidade: Privado. Alterar" }).click(),
  ]);
  await expect(page.getByRole("radiogroup", { name: "Quem vê" })).toBeInViewport();
  await expect(page.getByText("Exercício 16")).toBeVisible();
  expect(shared.activityId).toBeTruthy();

  await busy.context.close();
});

test("a post's owner decides who sees it or deletes it; everyone sees who gave FG (W-143)", async ({ browser }) => {
  const owner = await newUserContext(browser, { label: "c2-owner", name: "Olga Dona", isPublicAccount: false });
  const fan = await newUserContext(browser, { label: "c2-ofan", name: "Caio Fã" });
  follow(fan.id, owner.id);
  const post = seedWorkout(owner.id, {
    name: "Inferior B",
    showDetailedLoads: true,
    exercises: [
      { name: "Agachamento", workingSets: 3, bestSet: { weightKg: 100, reps: 5 } },
      { name: "Flexão de braço", workingSets: 3, bestSet: { weightKg: 0, reps: 15 } },
      { name: "Prancha", slug: "plank", workingSets: 2, bestSet: { weightKg: 0, reps: 45 } },
      // A legacy summary kept skipped exercises: never shown as "0 séries".
      { name: "Leg press", workingSets: 0, bestSet: null },
    ],
  });
  const url = `/app/activity/${post.activityId}`;

  // The fan sees it, gives FG, and reads the sets as the app prints them.
  await fan.page.goto(url);
  await expect(fan.page.getByText("Flexão de braço")).toBeVisible();
  await expect(fan.page.getByText("3 séries · × 15")).toBeVisible();
  await expect(fan.page.getByText("2 séries · 45 s")).toBeVisible();
  await expect(fan.page.getByText("Leg press")).toHaveCount(0);
  await expect(fan.page.getByText(/0 séries/)).toHaveCount(0);
  await expect(fan.page.getByRole("region", { name: "Quem vê" })).toHaveCount(0);
  await clickAction(fan.page, fan.page.getByRole("button", { name: /Dar FG neste treino/ }));
  await expect(fan.page.getByRole("button", { name: /Remover seu FG/ })).toHaveAttribute("aria-pressed", "true");

  // The owner: who gave FG, then "Quem vê".
  const page = owner.page;
  await page.goto(url);
  await expect(page.getByText("FG de Caio Fã")).toBeVisible();
  await expect(page.getByRole("link", { name: "Perfil de Caio Fã" })).toBeVisible();
  const quemVe = page.getByRole("radiogroup", { name: "Quem vê" });
  await expect(quemVe.getByRole("radio", { name: "Seguidores" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Seus seguidores veem este treino.")).toBeVisible();
  await quemVe.getByRole("radio", { name: "Privado" }).click();
  await expect(page.getByText("Só você vê este treino.")).toBeVisible();
  const saved = page.getByRole("status").filter({ hasText: "Salvo" });
  await expect(saved).toBeVisible();
  expect(sql(`SELECT visibility FROM "WorkoutSession" WHERE id = ${sqlText(post.sessionId)}`)).toBe("PRIVATE");
  // A server re-render (R5; the caption set meanwhile shows it landed) keeps the choice and "Salvo".
  sql(`UPDATE "Activity" SET caption = 'Pernas em dia' WHERE id = ${sqlText(post.activityId)}`);
  await rerender(page, page.getByText("Pernas em dia"));
  await expect(quemVe.getByRole("radio", { name: "Privado" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Só você vê este treino.")).toBeVisible();
  await expect(saved).toBeVisible();

  await fan.page.goto(url);
  await expect(fan.page).toHaveTitle(/Página não encontrada/);
  await quemVe.getByRole("radio", { name: "Seguidores" }).click();
  await expect(page.getByText("Seus seguidores veem este treino.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Salvo" })).toBeVisible();
  await fan.page.goto(url);
  await expect(fan.page.getByRole("heading", { level: 1, name: "Inferior B" })).toBeVisible();

  await expect(page.getByRole("link", { name: "Editar legenda e cargas" })).toHaveAttribute(
    "href",
    `/app/workout/${post.sessionId}/summary`,
  );

  // Deleting asks first; the workout stays in the history, private.
  await page.getByRole("button", { name: "Excluir publicação" }).click();
  const sheet = page.getByRole("dialog", { name: "Excluir publicação?" });
  await expect(sheet).toContainText("O treino continua no seu histórico.");
  await sheet.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: "Excluir publicação" }).click();
  await Promise.all([page.waitForURL(/\/app\/feed/), sheet.getByRole("button", { name: "Excluir", exact: true }).click()]);
  const deleted = page.getByRole("status").filter({ hasText: "Publicação excluída. O treino continua no histórico." });
  await expect(deleted).toBeVisible();
  // The confirm went with the page: the notice takes focus, so it's said and Tab goes on into the feed.
  await expect(deleted).toBeFocused();
  await expect(page).toHaveURL(/\/app\/feed$/);
  expect(sql(`SELECT count(*) FROM "Activity" WHERE id = ${sqlText(post.activityId)}`)).toBe("0");
  expect(sql(`SELECT status || '|' || visibility FROM "WorkoutSession" WHERE id = ${sqlText(post.sessionId)}`)).toBe("COMPLETED|PRIVATE");
  // A server re-render of the feed — now without ?excluida (R5; a new post shows it landed) — keeps the notice.
  seedWorkout(owner.id, { name: "Superior C" });
  await rerender(page, page.locator("article").filter({ hasText: "Superior C" }));
  await expect(deleted).toBeVisible();
  // …and ?excluida=1 stays out of the address: a reload wouldn't say it again.
  await expect(page).toHaveURL(/\/app\/feed$/);
  await page.goto(url);
  await expect(page).toHaveTitle(/Página não encontrada/);

  await owner.context.close();
  await fan.context.close();
});

test("a post hidden by moderation can't be published again by its owner (W-143)", async ({ page }) => {
  const owner = await newOnboardedUser(page, { label: "c2-moderated" });
  const post = seedWorkout(owner.id, { name: "Oculto", visibility: "PRIVATE" });
  sql(`UPDATE "Activity" SET "moderatedAt" = now() WHERE id = ${sqlText(post.activityId)}`);
  await page.goto(`/app/activity/${post.activityId}`);
  await expect(page.getByText("Esta publicação foi ocultada pela moderação.")).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Quem vê" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Excluir publicação" })).toHaveCount(0);
});

test("Today shows the team's workouts, or invites once there is a workout to show (W-139)", async ({ page, browser }) => {
  const reader = await newOnboardedUser(page, { label: "c2-team" });
  const pal = await newUserContext(browser, { label: "c2-pal", name: "Rafa Parceiro" });
  follow(reader.id, pal.id);
  seedWorkout(pal.id, { name: "Push A", at: "now() - interval '1 day'" });

  await page.goto("/app/today");
  const team = page.locator("section").filter({ has: page.getByRole("heading", { name: "Da sua equipe" }) });
  await expect(team).toContainText("Rafa Parceiro");
  await expect(team).toContainText(/ontem · Push A/i);
  await expect(team.getByRole("link", { name: "Ver feed" })).toHaveAttribute("href", "/app/feed");
  const fg = team.getByRole("button", { name: /^Dar FG no treino Push A de Rafa Parceiro/ });
  expect((await fg.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await clickAction(page, fg);
  await expect(team.getByRole("button", { name: /^Remover FG do treino Push A de Rafa Parceiro \(1\)$/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await pal.context.close();

  // Following nobody: a brand-new user sees no invite; after a first workout, the invite.
  const solo = await browser.newContext(IPHONE);
  const soloPage = await solo.newPage();
  const loner = await newOnboardedUser(soloPage, { label: "c2-solo" });
  await soloPage.goto("/app/today");
  await expect(soloPage.getByRole("heading", { name: "Treine com amigos" })).toHaveCount(0);
  seedWorkout(loner.id, { name: "Primeiro", visibility: "PRIVATE", at: "now() - interval '2 days'" });
  await soloPage.reload();
  const invite = soloPage.locator("section").filter({ has: soloPage.getByRole("heading", { name: "Treine com amigos" }) });
  await expect(invite).toContainText("Siga quem treina com você");
  await expect(invite.getByRole("link", { name: "Encontrar pessoas" })).toHaveAttribute("href", "/app/discover");
  await expect(invite.getByRole("button", { name: "Compartilhar perfil" })).toBeVisible();
  await clickAction(soloPage, invite.getByRole("button", { name: "Agora não" }));
  const inviteHeading = soloPage.getByRole("heading", { name: "Treine com amigos" });
  const closed = soloPage.getByRole("status").filter({ hasText: "Convite fechado. Ele volta em 30 dias." });
  await expect(inviteHeading).toHaveCount(0);
  await expect(closed).toHaveCount(1);
  // Stored on the server (30 days, every device): a re-render (R5) keeps it closed and said; a reload
  // keeps it closed without saying it again.
  await rerender(soloPage);
  await expect(inviteHeading).toHaveCount(0);
  await expect(closed).toHaveCount(1);
  await soloPage.reload();
  await expect(inviteHeading).toHaveCount(0);
  await expect(closed).toHaveCount(0);
  expect(sql(`SELECT count(*) FROM "UserDismissal" WHERE "userId" = ${sqlText(loner.id)} AND key = 'team-invite'`)).toBe("1");
  await solo.close();
});

test("the session refresh inside an action — R5's real trigger — keeps each confirmation (W-139, W-045, W-137, W-143)", async ({
  page,
  context,
}) => {
  const t = tag();
  const me = await newOnboardedUser(page, { label: "c2-r5" });

  // Today's invite (following nobody, one finished workout): "Agora não" stays closed, and said.
  seedWorkout(me.id, { name: "Primeiro", visibility: "PRIVATE", at: "now() - interval '2 days'" });
  await page.goto("/app/today");
  const invite = page.getByRole("heading", { name: "Treine com amigos" });
  await expect(invite).toBeVisible();
  await expireSessionCache(context);
  await clickActionRewritingCookie(page, page.locator("section").filter({ has: invite }).getByRole("button", { name: "Agora não" }));
  await expect(invite).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Convite fechado. Ele volta em 30 dias." })).toHaveCount(1);

  // Seguir on a profile: the button and the count.
  const star = publicPerson(`r5star_${t}`, "Rita Estrela");
  seedWorkout(star, { name: "Pull C", visibility: "PUBLIC" });
  await page.goto(`/u/r5star_${t}`);
  await expireSessionCache(context);
  await clickActionRewritingCookie(page, page.getByRole("button", { name: "Seguir", exact: true }));
  await expect(page.getByRole("button", { name: "Seguindo" })).toBeVisible();
  await expect(page.locator("[data-follower-count]")).toHaveText("1 seguidor");

  // FG on a feed card: pressed, with its count.
  await page.goto("/app/feed");
  const card = page.locator("article").filter({ hasText: "Pull C" });
  await expireSessionCache(context);
  await clickActionRewritingCookie(page, card.getByRole("button", { name: /^Dar FG/ }));
  await expect(card.getByRole("button", { name: /^Remover FG .*\(1\)$/ })).toHaveAttribute("aria-pressed", "true");

  // The owner's "Quem vê": the choice and "Salvo".
  const mine = seedWorkout(me.id, { name: "Meu treino", visibility: "FOLLOWERS" });
  await page.goto(`/app/activity/${mine.activityId}`);
  const quemVe = page.getByRole("radiogroup", { name: "Quem vê" });
  await expireSessionCache(context);
  await clickActionRewritingCookie(page, quemVe.getByRole("radio", { name: "Privado" }));
  await expect(quemVe.getByRole("radio", { name: "Privado" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("status").filter({ hasText: "Salvo" })).toBeVisible();
  expect(sql(`SELECT visibility FROM "Activity" WHERE id = ${sqlText(mine.activityId)}`)).toBe("PRIVATE");
});

test("a profile's program links to its dossier, and the owner's empty profile says why (W-146, W-048)", async ({ page, browser }) => {
  const t = tag();
  const coach = await newUserContext(browser, { label: "c2-coach", name: "Gabi Técnica", handle: `gabi_${t}`, isPublicAccount: true });
  onGd1(coach.id);
  const custom = await newUserContext(browser, { label: "c2-custom", name: "Hugo Livre", handle: `hugo_${t}`, isPublicAccount: true });
  sql(`INSERT INTO "UserProgram" (id, "userId", name, status, "createdAt", "updatedAt")
       VALUES (${sqlText(`${custom.id}-p`)}, ${sqlText(custom.id)}, 'Meu treino', 'ACTIVE', now(), now())`);

  const viewer: TestUser = await newOnboardedUser(page, { label: "c2-prog" });
  await page.goto(`/u/gabi_${t}`);
  await expect(page.getByRole("link", { name: /Treinando: GD 1/ })).toHaveAttribute("href", "/app/programs/templates/gd-1");
  await expect(page.getByRole("link", { name: "Treinar o mesmo programa →" })).toHaveAttribute("href", "/app/programs/templates/gd-1");
  onGd1(viewer.id, "GD 1");
  await page.reload();
  await expect(page.getByText("Vocês treinam o mesmo programa")).toBeVisible();
  await expect(page.getByRole("link", { name: "Treinar o mesmo programa →" })).toHaveCount(0);

  await page.goto(`/u/hugo_${t}`);
  await expect(page.getByText("Treinando: Meu treino")).toBeVisible();
  await expect(page.getByRole("link", { name: /Treinando/ })).toHaveCount(0);

  const anonContext = await browser.newContext(IPHONE);
  const anon = await anonContext.newPage();
  await anon.goto(`/u/gabi_${t}`);
  await expect(anon.getByRole("link", { name: /Treinando: GD 1/ })).toHaveAttribute("href", "/programs/gd-1");
  await expect(anon.getByRole("link", { name: "Treinar o mesmo programa →" })).toHaveCount(0);
  await anonContext.close();

  // The owner's own empty profile, by how new workouts are published.
  setProfile(viewer.id, { defaultWorkoutVisibility: "FOLLOWERS" });
  await page.goto(`/u/${viewer.username}`);
  await expect(page.getByText("Nenhum treino publicado ainda.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ajustar padrão" })).toHaveAttribute("href", "/app/settings#privacidade");
  setProfile(viewer.id, { defaultWorkoutVisibility: "PRIVATE" });
  await page.reload();
  await expect(page.getByText("Seus treinos são privados.")).toBeVisible();

  await coach.context.close();
  await custom.context.close();
});

/**
 * C2's links into a Settings section — Descobrir's "Como te encontram" and the owner's empty
 * profile's "Ajustar padrão" (#privacidade), Descobrir's "Escolha seu @usuário" (#usuario) —
 * land on it. Settings has a loading skeleton, and Next scrolls to a #hash only when its target
 * is in the navigation's first commit (the skeleton's), then gives up: Settings' own ScrollToHash
 * lands them once the sections are in.
 */
test("a link into a Settings section lands on that section", async ({ page }) => {
  const me = await newOnboardedUser(page, { label: "c2-anchor", defaultWorkoutVisibility: "FOLLOWERS" });
  const privacy = page.locator("#privacidade").getByRole("heading", { level: 2, name: "Privacidade" });

  await page.goto("/app/discover");
  await Promise.all([page.waitForURL(/\/app\/settings#privacidade$/), page.getByRole("link", { name: "Como te encontram" }).click()]);
  await expect(privacy).toBeInViewport();

  await page.goto(`/u/${me.username}`);
  await Promise.all([page.waitForURL(/\/app\/settings#privacidade$/), page.getByRole("link", { name: "Ajustar padrão" }).click()]);
  await expect(privacy).toBeInViewport();

  sql(`UPDATE "user" SET username = NULL, "displayUsername" = NULL WHERE id = ${sqlText(me.id)}`);
  await page.goto("/app/discover");
  await Promise.all([page.waitForURL(/\/app\/settings#usuario$/), page.getByRole("link", { name: "Escolha seu @usuário" }).click()]);
  await expect(page.locator("#usuario").getByRole("heading", { level: 2, name: "Usuário público" })).toBeInViewport();
});
