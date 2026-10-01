/**
 * Batch 4 — the exercise library, science references, and app-wide
 * accessibility/identity fixes (W-072 … W-077, W-098, W-150, W-153, W-156,
 * W-162 … W-169), on a phone. Batch 5 adds axe-core, light and dark, over the
 * landing and the social and sharing screens (the end of the file).
 */
import { execSync } from "node:child_process";
import { test, expect, devices, type Page } from "@playwright/test";
import { IPHONE, loginAsTestUser, userIdOf } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";
import { QUINTA, finishAndSave, newUserOnGd1, recordSet, startDayFromToday, uniqueEmail } from "./workout-helpers";

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium", timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 120_000 });

/** Runs SQL on the local dev database (docker compose's fgpower-postgres) — test users only. */
function sql(query: string): string {
  return execSync(`docker exec -i fgpower-postgres sh -c 'psql -U "$POSTGRES_USER" -d fgpower -At -v ON_ERROR_STOP=1'`, {
    encoding: "utf8",
    input: query,
  }).trim();
}
const hasDb = (() => {
  try {
    return sql("SELECT 1") === "1";
  } catch {
    return false;
  }
})();

async function onboarded(page: Page, label: string) {
  const email = uniqueEmail(label);
  await loginAsTestUser(page, email);
  await completeOnboarding(page);
  return email;
}

const cards = (page: Page) => page.locator('a[href^="/app/exercises/"] h3');
const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Buscar exercício" });

test("typing a search waits for a pause, replaces the URL and dims the list while it loads (W-072)", async ({ page }) => {
  await onboarded(page, "lib-search");
  await page.goto("/app/today");
  await page.goto("/app/exercises");
  const before = await page.evaluate(() => history.length);

  let requests = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/app/exercises" && r.headers()["rsc"] === "1") requests++;
  });
  await searchBox(page).click();
  await searchBox(page).pressSequentially("supino reto", { delay: 50 });
  // While the list doesn't match the box yet, the count says so.
  await expect(page.getByText("Buscando…")).toBeVisible();
  await expect(page).toHaveURL(/q=supino\+reto/);
  await expect(page.getByText("Buscando…")).toHaveCount(0);
  await expect(cards(page).first()).toHaveText(/^Supino Reto/);
  expect(requests).toBeLessThanOrEqual(2);
  // No history entry per letter: Back leaves the library.
  expect(await page.evaluate(() => history.length)).toBe(before);
  await expect(searchBox(page)).toBeFocused();

  // "Limpar filtros" (a server link in the empty state) moves the URL: the box follows it.
  await page.goto("/app/exercises?q=zzqqxx");
  await expect(page.getByText("Nenhum exercício encontrado")).toBeVisible();
  await page.getByRole("link", { name: "Limpar filtros" }).click();
  await expect(page).toHaveURL(/\/app\/exercises$/);
  await expect(searchBox(page)).toHaveValue("");

  await page.goBack();
  await expect(page).toHaveURL(/q=zzqqxx/);
  await expect(searchBox(page)).toHaveValue("zzqqxx");
});

test("search ranks names that start with the words first, reads muscles, and keeps stretches out unless asked (W-073)", async ({ page }) => {
  await onboarded(page, "lib-rank");

  await page.goto("/app/exercises?q=flexao");
  await expect(cards(page).first()).toHaveText("Flexão de Braço");

  // A muscle word finds the lifts for it — Hip Thrust never says "glúteo" — and no stretch.
  await page.goto("/app/exercises?q=gluteo");
  await expect(cards(page).filter({ hasText: "Hip Thrust com Barra" })).toHaveCount(1);
  await expect(cards(page).filter({ hasText: /^Alongamento/ })).toHaveCount(0);
  await page.goto("/app/exercises?q=peito");
  await expect(cards(page).first()).toHaveText(/^(Supino|Crucifixo)/);

  // Asked for by name, stretches come back.
  await page.goto("/app/exercises?q=alongamento%20gluteo");
  await expect(cards(page).filter({ hasText: /^Alongamento/ }).first()).toBeVisible();
  // The only match for a name is shown even when it is a stretch.
  await page.goto("/app/exercises?q=postura%20da%20crianca");
  await expect(cards(page).first()).toHaveText("Postura da Criança");
  // Browsing never opens on stretches either.
  await page.goto("/app/exercises?muscleGroup=GLUTES");
  await expect(cards(page).filter({ hasText: /^Alongamento/ })).toHaveCount(0);
  // A word asking for that kind of work finds the stretches even when no name says it.
  await page.goto("/app/exercises?q=mobilidade");
  await expect(cards(page).first()).toBeVisible();
  await expect(page.getByText("Nenhum exercício encontrado")).toHaveCount(0);
});

test("filters: muscle chips, a labelled equipment select, 'Mais filtros', a count and 'Limpar filtros' (W-074, W-162)", async ({ page }) => {
  await onboarded(page, "lib-filters");
  await page.goto("/app/exercises");
  const muscles = page.getByRole("group", { name: "Músculo" });
  await expect(muscles.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { level: 2, name: "Biblioteca" })).toBeVisible();
  await expect(page.getByText(/^\d+ exercícios$/)).toBeVisible();

  await muscles.getByRole("button", { name: "Glúteos" }).click();
  await expect(page).toHaveURL(/muscleGroup=GLUTES/);
  await expect(muscles.getByRole("button", { name: "Glúteos" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { level: 2, name: "Resultados" })).toBeVisible();

  // Every select keeps its name after a pick (a visible label, not a placeholder option).
  const equipment = page.getByLabel("Equipamento");
  await equipment.selectOption("barbell");
  await expect(page).toHaveURL(/equipmentId=/);
  await expect(page.getByLabel("Equipamento")).toHaveValue(/.+/);

  // Movement and level wait behind "Mais filtros", which says what the pattern filter can't list.
  const more = page.getByRole("button", { name: /Mais filtros/ });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Movimento")).toBeHidden();
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("Nível")).toBeVisible();
  await page.getByLabel("Nível").selectOption("ADVANCED");
  await expect(page).toHaveURL(/difficulty=ADVANCED/);
  await expect(more).toContainText("· 1");

  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).toHaveURL(/\/app\/exercises$/);
  await expect(muscles.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");

  // Hand-edited enum params list everything instead of failing.
  const bad = await page.goto("/app/exercises?muscleGroup=FOO&difficulty=BAR&lista=zzz");
  expect(bad?.status()).toBe(200);
  await expect(cards(page).first()).toBeVisible();

  // A tap just under a muscle chip stays on it: the Lista row below doesn't take it.
  await page.goto("/app/exercises");
  const under = await muscles.getByRole("button", { name: "Todos" }).evaluate((el) => {
    const r = el.getBoundingClientRect();
    // (Its 44px tap area ends 6px below it, where the next row's begins.)
    return [2, 4, 5].map((dy) => document.elementFromPoint(r.left + r.width / 2, r.bottom + dy)?.closest("button")?.textContent ?? "");
  });
  expect(under).not.toContain("Do meu programa");
  expect(under).not.toContain("Favoritos");
});

test("the library and a history day fit a 320px phone (W-074, W-098)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  // Signed out: the public library fits, and a stray ?lista= (it has no lists) isn't a filter to clear.
  await page.goto("/exercises");
  await expect(page.locator('a[href^="/exercises/"] h3').first()).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.goto("/exercises?lista=favoritos");
  await expect(page.locator('a[href^="/exercises/"] h3').first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Limpar filtros" })).toHaveCount(0);
  await expect(page.locator('form[role="search"] input[name="lista"]')).toHaveCount(0);

  const email = await onboarded(page, "lib-320");
  await page.goto("/app/exercises");
  await expect(cards(page).first()).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);

  test.skip(!hasDb, "the day view needs workouts in the local dev database");
  const userId = sql(`SELECT id FROM "user" WHERE email = '${email}'`);
  sql(
    `INSERT INTO "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "durationSeconds", "totalWorkingSets", "updatedAt") VALUES
     ('${userId}-d1', '${userId}', 'Superior A', 'COMPLETED', '2026-09-27T12:00:00Z', '2026-09-27T13:00:00Z', 3600, 12, now()),
     ('${userId}-d2', '${userId}', 'Inferior B', 'COMPLETED', '2026-09-27T20:00:00Z', '2026-09-27T21:00:00Z', 3600, 12, now())`,
  );
  // The day with 2+ workouts opens this view: a long date label and its count, then the way back.
  await page.goto("/app/history?year=2026&month=8&day=27");
  await expect(page.getByRole("heading", { level: 2, name: "Treinos de 27 de setembro" })).toBeVisible();
  const back = page.getByRole("link", { name: "Ver recentes" });
  await back.scrollIntoViewIfNeeded();
  const box = (await back.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test("'Do meu programa' and 'Favoritos' narrow the library; the technique page says where the lift sits (W-074, W-076)", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  await newUserOnGd1(page, "lib-lists");
  const programSlugs = sql(
    `WITH u AS (SELECT id FROM "user" WHERE email LIKE 'lib-lists-%' ORDER BY "createdAt" DESC LIMIT 1),
     en AS (SELECT "programId" FROM "ProgramEnrollment" WHERE "userId" = (SELECT id FROM u) AND status = 'ACTIVE' ORDER BY "startedAt" DESC LIMIT 1)
     SELECT DISTINCT e.slug FROM "UserProgramExercise" x JOIN "UserProgramDay" d ON d.id = x."dayId"
     JOIN "Exercise" e ON e.id = x."exerciseId" WHERE d."programId" = (SELECT "programId" FROM en)`,
  ).split("\n");
  expect(programSlugs.length).toBeGreaterThan(3);

  await page.goto("/app/exercises");
  await page.getByRole("group", { name: "Lista" }).getByRole("button", { name: "Do meu programa" }).click();
  await expect(page).toHaveURL(/lista=programa/);
  const hrefs = await page.locator('a[href^="/app/exercises/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) expect(programSlugs).toContain(href!.split("/").pop());

  await page.getByRole("group", { name: "Lista" }).getByRole("button", { name: "Favoritos" }).click();
  await expect(page.getByText("Nenhum favorito ainda")).toBeVisible();

  // The technique page: a way back, labelled frames, and the program's prescription.
  await page.goto("/app/exercises/side-lateral-raise");
  await expect(page.getByRole("link", { name: "Exercícios" }).first()).toHaveAttribute("href", "/app/exercises");
  await expect(page.getByRole("img", { name: /— posição inicial$/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /— posição final$/ })).toBeVisible();
  await expect(page.locator("figcaption", { hasText: "Início" })).toBeVisible();
  const inProgram = page.getByText(/^No seu programa · GD 1/).locator("..");
  await expect(inProgram).toBeVisible();
  await expect(inProgram.getByText(/^\d+×\d+(-\d+)?( s)?$/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Ver programa/ })).toHaveAttribute("href", /^\/app\/programs\/[^/]+$/);

  // Cards: the photo is decorative next to the name (no name read twice).
  await page.goto("/app/exercises");
  expect(await page.locator('a[href^="/app/exercises/"] img').first().getAttribute("alt")).toBe("");
});

test("science references never switch a Portuguese page to an English abstract (W-077)", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  await onboarded(page, "lib-science");
  const abstracts = sql(
    `SELECT s."abstractSummary" FROM "TrainingPrincipleEvidence" e JOIN "TrainingPrinciple" p ON p.id = e."principleId"
     JOIN "EvidenceSource" s ON s.id = e."sourceId" WHERE p.slug = 'rir'`,
  ).split("\n");
  await page.goto("/app/science/rir");
  const refs = page.locator("section", { has: page.getByRole("heading", { name: "Referências" }) });
  await expect(refs.getByRole("heading", { level: 2, name: "Referências" })).toBeVisible();
  for (const text of abstracts) {
    // Either replaced by the pt summary, or folded under "Resumo original (inglês)".
    await expect(refs.getByText(text.slice(0, 60), { exact: false })).toBeHidden();
  }
  const folded = refs.locator("details");
  if ((await folded.count()) > 0) {
    await expect(folded.first().locator("summary")).toHaveText(/Resumo original \(inglês\)/);
  }
  await expect(refs.getByRole("link", { name: /Ver fonte/ }).first()).toBeVisible();
});

test("section labels are headings, sm buttons take 44px taps, the lit tab isn't hue alone (W-164, W-165, W-169)", async ({ page }) => {
  await onboarded(page, "lib-a11y");
  // Section heads are real headings, right under the page's h1.
  await page.goto("/app/science");
  await expect(page.getByRole("heading", { level: 2, name: "Comece aqui" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Todos os princípios" })).toBeVisible();

  await page.goto("/app/profile");
  // A 36px sm button still takes a 44px tap (its ::after hit area).
  const feed = page.getByRole("link", { name: "Feed", exact: true });
  const hit = await feed.evaluate((el) => {
    const after = getComputedStyle(el, "::after");
    return { h: parseFloat(after.height), w: parseFloat(after.width), box: el.getBoundingClientRect().height };
  });
  expect(hit.box).toBeLessThan(44);
  expect(hit.h).toBeGreaterThanOrEqual(44);

  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  const lit = nav.locator('a[aria-current="page"] [data-lit]');
  const unlit = nav.locator('a:not([aria-current]) span.relative').first();
  expect(Number(await lit.evaluate((el) => getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(700);
  expect(Number(await unlit.evaluate((el) => getComputedStyle(el).fontWeight))).toBeLessThan(700);

  // Light --danger reads at AA on --danger-soft (5.1:1).
  const danger = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--danger").trim());
  expect(danger.toLowerCase()).toBe("#c0282a");
});

test("signing out: only in Configurações → Dados e conta, asks first, reports a failure (W-150)", async ({ page, context }) => {
  await onboarded(page, "lib-logout");
  await page.goto("/app/profile");
  await expect(page.getByRole("button", { name: "Sair" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Configurações" })).toBeVisible();

  await page.goto("/app/settings");
  await expect(page.getByRole("heading", { level: 2, name: "Dados e conta" })).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  const confirm = page.getByRole("group", { name: "Confirmar saída" });
  await expect(confirm).toContainText("Sair desta conta neste aparelho?");
  await expect(confirm).not.toContainText("não enviada");
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirm).toHaveCount(0);

  // Sets typed offline live only on this phone: the confirm step says so and links the workout.
  await page.evaluate(() =>
    localStorage.setItem("fg:workout-drafts:s-offline", JSON.stringify({ v: 2, rows: { a: { dirty: true }, b: { dirty: true }, c: { dirty: false } } })),
  );
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(confirm).toContainText("Este aparelho tem 2 séries ainda não enviadas");
  await expect(confirm.getByRole("link", { name: "abra o treino" })).toHaveAttribute("href", "/app/workout/s-offline");
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await page.evaluate(() => localStorage.removeItem("fg:workout-drafts:s-offline"));

  // Offline: the call fails, the user is told and can try again.
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await context.setOffline(true);
  await confirm.getByRole("button", { name: "Sim, sair" }).click();
  await expect(confirm.getByRole("alert")).toContainText(/Sem conexão/);
  await expect(confirm.getByRole("button", { name: "Tentar de novo" })).toBeEnabled();
  await context.setOffline(false);

  await Promise.all([page.waitForURL(/\/login/, { timeout: 30_000 }), confirm.getByRole("button", { name: "Tentar de novo" }).click()]);
  // Really signed out: the app sends back to the login page.
  await page.goto("/app/today");
  await expect(page).toHaveURL(/\/login/);
});

test("settings switches are square 44px rows; the danger zone isn't a panel in a panel (W-098)", async ({ page }) => {
  await onboarded(page, "lib-settings");
  await page.goto("/app/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
  const sw = page.getByRole("switch", { name: /Conta pública/ });
  const row = page.locator("label", { has: sw });
  expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const was = await sw.isChecked();
  await row.click({ position: { x: 20, y: 20 } });
  await expect(sw).toBeChecked({ checked: !was });
  await row.click({ position: { x: 20, y: 20 } });
  await expect(sw).toBeChecked({ checked: was });
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Dados e conta" }) });
  await expect(section.locator(".reg-frame .reg-frame")).toHaveCount(0);
});

test("history: dead month arrows aren't links, and a day says which workout it opens (W-162, W-165)", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const email = await onboarded(page, "lib-history");
  const userId = sql(`SELECT id FROM "user" WHERE email = '${email}'`);
  sql(
    `INSERT INTO "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "durationSeconds", "totalWorkingSets", "updatedAt")
     VALUES ('${userId}-h', '${userId}', 'Superior A', 'COMPLETED', '2026-09-24T20:00:00Z', '2026-09-24T21:00:00Z', 3600, 12, now()),
            ('${userId}-s', '${userId}', 'Sábado — Corpo inteiro (leve)', 'COMPLETED', '2026-09-26T15:00:00Z', '2026-09-26T16:00:00Z', 3600, 12, now())`,
  );
  await page.goto("/app/history?year=2026&month=8");
  await expect(page.getByRole("link", { name: "Mês anterior" })).toHaveAttribute("href", /month=7/);
  await expect(page.getByRole("link", { name: /^Ver treino de 24 de setembro, quinta — Superior A$/ })).toBeVisible();
  // A day named after its weekday doesn't say it twice.
  await expect(page.getByRole("link", { name: /^Ver treino de 26 de setembro — Sábado — Corpo inteiro \(leve\)$/ })).toBeVisible();
  // The current month has no "next": nothing to tap, nothing announced as a link.
  await page.goto("/app/history");
  await expect(page.getByRole("link", { name: "Próximo mês" })).toHaveCount(0);
});

test("a feed card opens as a whole; FG says whose workout it is and doesn't navigate (W-163, W-165)", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const email = await onboarded(page, "lib-feed");
  const userId = sql(`SELECT id FROM "user" WHERE email = '${email}'`);
  const tag = Date.now().toString(36);
  const friend = `libfeed${tag}`;
  sql(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", username) VALUES ('${friend}', 'Bruno Atleta', '${friend}@fgpower.dev', true, now(), now(), 'bruno_${tag}')`);
  sql(`INSERT INTO "Follow" ("followerId", "followingId", "createdAt") VALUES ('${userId}', '${friend}', now())`);
  const summary = JSON.stringify({ workoutName: "Superior (pesado)", durationSeconds: 3600, totalWorkingSets: 18, totalVolumeKg: 8000, prs: [], exercises: [] });
  sql(`INSERT INTO "Activity" (id, "userId", type, visibility, summary, "updatedAt") VALUES ('${friend}-a', '${friend}', 'WORKOUT', 'PUBLIC', '${summary}'::jsonb, now())`);

  await page.goto("/app/feed");
  await expect(page.getByRole("heading", { level: 1, name: "Feed" })).toBeVisible();
  const fg = page.getByRole("button", { name: /^Dar FG no treino Superior \(pesado\) de Bruno Atleta/ });
  expect((await fg.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await fg.click();
  await expect(page.getByRole("button", { name: /^Remover FG do treino Superior \(pesado\) de Bruno Atleta \(1\)$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/\/app\/feed$/);
  // A tap anywhere on the workout block opens it (the stretched "Ver detalhes" takes it).
  const block = (await page.getByText("18 séries de trabalho").boundingBox())!;
  await Promise.all([page.waitForURL(/\/app\/activity\//), page.mouse.click(block.x + block.width / 2, block.y + block.height / 2)]);
});

test("phones don't preload the desktop sidebar's logo (W-156)", async ({ page }) => {
  await onboarded(page, "lib-sidebar");
  await page.goto("/app/today");
  await expect(page.locator('link[rel="preload"][as="image"][imagesrcset*="fgpower-tile"]')).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Navegação lateral" })).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole("navigation", { name: "Navegação lateral" }).getByRole("link", { name: "Configurações" })).toBeVisible();
});

/* ── Batch 5: axe-core, light and dark ─────────────────────────────────── */

/** Another phone in the same test (signed out, or a second person): the app's time zone and language. */
const PHONE = { ...IPHONE, timezoneId: "America/Sao_Paulo", locale: "pt-BR" };

/** Every WCAG 2.0, 2.1 and 2.2 rule of level A or AA that axe-core has. */
const WCAG_A_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

/** The "POWER" of the admin header's FGPOWER wordmark: a logotype, which WCAG 1.4.3 exempts from contrast. */
const ADMIN_WORDMARK = 'header a[href="/admin"] .text-accent-strong';

/**
 * No axe-core violation of WCAG 2.0/2.1/2.2 A or AA on the page as it is now,
 * in the light theme and then in the dark one.
 * - It waits for the title: the page's metadata streams in after its content.
 * - Transitions and animations go off first, and each theme is checked only
 *   once its colors hold still. A color transition still running after the
 *   switch made axe read text halfway between the two themes: dark-mode
 *   contrast failures that weren't there.
 * - Left out: the dev-only Next.js tools badge (<nextjs-portal>), and
 *   `exclude` (CSS selectors, e.g. a logotype).
 * - Contrast skips what is hidden from assistive tech: decoration such as the
 *   "01" ordinals and the public header's brand name (WCAG 1.4.3 exempts pure
 *   decoration and logotypes). Every other rule sees it, aria-hidden-focus
 *   included.
 * - It leaves the page as it found it: the theme it had, and its motion back on.
 */
async function expectAxeClean(page: Page, { exclude = [] }: { exclude?: string[] } = {}) {
  await expect(page).toHaveTitle(/\S/);
  const theme = await page.evaluate(() => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  const still = await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
  if (!(await page.evaluate(() => "axe" in window))) {
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  }
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await colorsSettled(page, colorScheme);
    expect(await axeViolations(page, exclude), `axe, ${colorScheme}`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: theme });
  await still.evaluate((style) => (style as Element).remove());
}

/** Waits for the theme to apply and for every element's colors to read the same on two looks 100 ms apart. */
async function colorsSettled(page: Page, colorScheme: "light" | "dark") {
  await page.waitForFunction(
    (scheme) => {
      if (!matchMedia(`(prefers-color-scheme: ${scheme})`).matches) return false;
      const w = window as unknown as { axeColors?: string };
      const colors = Array.from(document.querySelectorAll("body *"), (el) => {
        const s = getComputedStyle(el);
        return `${s.color} ${s.backgroundColor} ${s.opacity}`;
      }).join("|");
      const settled = colors === w.axeColors;
      w.axeColors = colors;
      return settled;
    },
    colorScheme,
    { polling: 100, timeout: 10_000 },
  );
}

/** axe-core's violations, one line per rule: its id and targets (with the colors read, for contrast). */
async function axeViolations(page: Page, exclude: string[]) {
  return page.evaluate(
    async ({ tags, exclude }) => {
      type Check = { data?: { fgColor?: string; bgColor?: string; contrastRatio?: number } | null };
      type Result = { violations: { id: string; nodes: { target: unknown[]; any: Check[] }[] }[] };
      const { axe } = window as unknown as { axe: { run(context: unknown, options: unknown): Promise<Result> } };
      const leaveOut = (selectors: string[]) => ({ exclude: selectors.map((selector) => [selector]) });
      const skipped = ["nextjs-portal", ...exclude];
      const all = await axe.run(leaveOut(skipped), {
        runOnly: { type: "tag", values: tags },
        rules: { "color-contrast": { enabled: false } },
      });
      const contrast = await axe.run(leaveOut([...skipped, '[aria-hidden="true"]']), {
        runOnly: { type: "rule", values: ["color-contrast"] },
      });
      return [...all.violations, ...contrast.violations].map((v) => {
        const nodes = v.nodes.map((n) => {
          const c = n.any[0]?.data;
          return JSON.stringify(n.target) + (c?.contrastRatio ? ` (${c.fgColor} on ${c.bgColor}, ${c.contrastRatio}:1)` : "");
        });
        return `${v.id}: ${nodes.join(" ")}`;
      });
    },
    { tags: WCAG_A_AA, exclude },
  );
}

/** A public account (Profile included), straight into the DB; returns its id. */
function publicAccount(key: string, name: string, extra: { bio?: string } = {}) {
  const id = `a11y${key}`;
  sql(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", username)
       VALUES ('${id}', '${name}', '${id}@fgpower.dev', true, now(), now(), '${key}')`);
  sql(`INSERT INTO "Profile" (id, "userId", "displayName", bio, "onboardingCompletedAt", "isPublicAccount", "updatedAt")
       VALUES ('${id}-p', '${id}', '${name}', ${extra.bio ? `'${extra.bio}'` : "null"}, now(), true, now())`);
  return id;
}

/** A finished workout and its post; returns the activity id. */
function postedWorkout(key: string, userId: string, name: string, visibility: "FOLLOWERS" | "PUBLIC" | "PRIVATE", hoursAgo = 2) {
  const summary = JSON.stringify({
    workoutName: name,
    durationSeconds: 3600,
    totalWorkingSets: 9,
    totalVolumeKg: null,
    prs: [],
    exercises: [
      { name: "Agachamento livre", workingSets: 3, bestSet: null },
      { name: "Leg press 45°", workingSets: 3, bestSet: null },
      { name: "Prancha", slug: "plank", timed: true, workingSets: 3, bestSet: null },
    ],
  });
  sql(`INSERT INTO "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "durationSeconds", visibility, "updatedAt")
       VALUES ('${key}-s', '${userId}', '${name}', 'COMPLETED', now() - interval '${hoursAgo + 1} hours', now() - interval '${hoursAgo} hours', 3600, '${visibility}', now())`);
  sql(`INSERT INTO "Activity" (id, "userId", type, "sessionId", visibility, summary, "createdAt", "updatedAt")
       VALUES ('${key}-a', '${userId}', 'WORKOUT', '${key}-s', '${visibility}', '${summary}'::jsonb, now() - interval '${hoursAgo} hours', now())`);
  return `${key}-a`;
}

test("the inbox, the follower lists and the moderation queue pass axe (W-042, W-138, W-141)", async ({ page, context }) => {
  test.skip(!hasDb, "needs the local dev database");
  const email = await onboarded(page, "a11y-social");
  const me = sql(`SELECT id FROM "user" WHERE email = '${email}'`);
  const tag = Date.now().toString(36);
  const person = (key: string, name: string) => {
    const id = `a11y${key}${tag}`;
    sql(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", username) VALUES ('${id}', '${name}', '${id}@fgpower.dev', true, now(), now(), '${key}_${tag}')`);
    sql(`INSERT INTO "Profile" (id, "userId", "displayName", "onboardingCompletedAt", "isPublicAccount", "updatedAt") VALUES ('${id}-p', '${id}', '${name}', now(), true, now())`);
    return id;
  };
  const ana = person("ana", "Ana Souza");
  const bruno = person("bruno", "Bruno Lima");
  const carla = person("carla", "Carla Dias");
  const davi = person("davi", "Davi Rocha");
  const workout = (id: string, userId: string, name: string) => {
    const summary = JSON.stringify({ workoutName: name, durationSeconds: 3600, totalWorkingSets: 12, totalVolumeKg: null, prs: [], exercises: [] });
    sql(`INSERT INTO "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "durationSeconds", visibility, "updatedAt") VALUES ('${id}-s', '${userId}', '${name}', 'COMPLETED', now() - interval '2 hours', now() - interval '1 hour', 3600, 'PUBLIC', now())`);
    sql(`INSERT INTO "Activity" (id, "userId", type, "sessionId", visibility, caption, summary, "updatedAt") VALUES ('${id}-a', '${userId}', 'WORKOUT', '${id}-s', 'PUBLIC', 'Supino 500 kg', '${summary}'::jsonb, now())`);
  };
  workout(`a11ymine${tag}`, me, "Superior (pesado)");
  workout(`a11ybruno${tag}`, bruno, "Inferior A");
  const note = (key: string, actorId: string | null, type: string, extra: string, extraValues: string, read = false) =>
    sql(`INSERT INTO "Notification" (id, "recipientId", "actorId", type, "dedupeKey", "readAt"${extra}) VALUES ('${key}${tag}', '${me}', ${actorId ? `'${actorId}'` : "null"}, '${type}', '${key}${tag}', ${read ? "now()" : "null"}${extraValues})`);
  // Two FGs on one workout (one grouped line), a new follower, a request waiting, a record of your own.
  for (const giver of [ana, bruno]) {
    sql(`INSERT INTO "ActivityFG" ("activityId", "userId") VALUES ('a11ymine${tag}-a', '${giver}')`);
    note(`fg${giver}`, giver, "FG_RECEIVED", `, "activityId"`, `, 'a11ymine${tag}-a'`);
  }
  sql(`INSERT INTO "Follow" ("followerId", "followingId") VALUES ('${carla}', '${me}'), ('${me}', '${bruno}')`);
  note("follower", carla, "NEW_FOLLOWER", "", "");
  sql(`INSERT INTO "FollowRequest" (id, "requesterId", "targetId") VALUES ('a11yreq${tag}', '${davi}', '${me}')`);
  note("request", davi, "FOLLOW_REQUEST", `, "followRequestId"`, `, 'a11yreq${tag}'`);
  note("pr", null, "PERSONAL_RECORD", `, "sessionId", data`, `, 'a11ymine${tag}-s', '{"count":1,"exercises":["Supino Reto com Barra"]}'::jsonb`, true);

  await page.goto("/app/notifications");
  await expect(page.getByText(/^(Ana Souza e Bruno Lima|Bruno Lima e Ana Souza) deram FG no seu treino Superior \(pesado\)$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Seguir de volta" })).toBeVisible();
  await expectAxeClean(page);

  await page.goto("/app/profile/seguidores");
  await expect(page.getByRole("heading", { level: 2, name: "Solicitações" })).toBeVisible();
  await expectAxeClean(page);
  await page.goto("/app/profile/seguindo");
  await expect(page.getByRole("button", { name: "Seguindo" })).toBeVisible();
  await expectAxeClean(page);

  // An admin's queue: a report with its preview, then "Resolvidas" (the role is read on the next request).
  sql(`UPDATE "user" SET role = 'admin' WHERE id = '${me}'`);
  const keep = (await context.cookies()).filter((c) => c.name !== "better-auth.session_data");
  await context.clearCookies();
  await context.addCookies(keep);
  sql(`INSERT INTO "UserReport" (id, "reporterId", "reportedUserId", "activityId", reason, details) VALUES ('a11yrep${tag}', '${ana}', '${bruno}', 'a11ybruno${tag}-a', 'FAKE_DATA', 'Cargas impossíveis.')`);
  sql(`INSERT INTO "UserReport" (id, "reporterId", "reportedUserId", reason, status, "resolvedAt", "resolutionNote") VALUES ('a11ydone${tag}', '${ana}', '${davi}', 'SPAM', 'DISMISSED', now(), 'Sem problema.')`);
  await page.goto("/admin/reports");
  await expect(page.locator(`[data-report="a11yrep${tag}"]`)).toContainText("Inferior A");
  await expectAxeClean(page, { exclude: [ADMIN_WORDMARK] });
  await page.goto("/admin/reports?status=resolvidas");
  await expect(page.locator(`[data-report="a11ydone${tag}"]`)).toContainText("Sem problema.");
  await expectAxeClean(page, { exclude: [ADMIN_WORDMARK] });
  sql(`UPDATE "UserReport" SET status = 'DISMISSED', "resolvedAt" = now() WHERE id = 'a11yrep${tag}'`);
});

test("the landing passes axe, signed out and signed in (W-066, W-067)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Criar conta grátis" }).first()).toBeVisible();
  await expectAxeClean(page);
  await onboarded(page, "a11y-landing");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Abrir o app" }).first()).toBeVisible();
  await expectAxeClean(page);
});

test("a shared workout (/t) passes axe for its owner, a stranger, someone signed out — and once the link is off (W-008)", async ({
  page,
  browser,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  await newUserOnGd1(page, "a11y-share");
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");
  await finishAndSave(page);
  // The link "Copiar link" mints, written straight to the workout auto-published on finish.
  const token = `a11y${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`.slice(0, 16).padEnd(16, "x");
  sql(`UPDATE "Activity" SET "shareToken" = '${token}', "sharedAt" = now() WHERE "userId" = '${await userIdOf(page)}'`);

  await page.goto(`/t/${token}`);
  await expect(page.getByText("Assim o seu treino aparece para quem abre o link.")).toBeVisible();
  await expectAxeClean(page);

  const signedOut = await browser.newContext(PHONE);
  const anon = await signedOut.newPage();
  await anon.goto(`/t/${token}`);
  await expect(anon.getByRole("link", { name: "Criar conta grátis" })).toBeVisible();
  await expectAxeClean(anon);
  await anon.goto("/t/AAAAAAAAAAAAAAAA");
  await expect(anon.getByRole("heading", { name: "Este link não está mais ativo." })).toBeVisible();
  await expectAxeClean(anon);
  await signedOut.close();

  const other = await browser.newContext(PHONE);
  const stranger = await other.newPage();
  await onboarded(stranger, "a11y-share-stranger");
  await stranger.goto(`/t/${token}`);
  await expect(stranger.getByRole("button", { name: "Denunciar" })).toBeVisible();
  await expectAxeClean(stranger);
  await other.close();
});

test("a public profile passes axe signed in, to its owner, signed out and when missing — menus and confirms open too (W-140, W-045)", async ({
  page,
  browser,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  const email = await onboarded(page, "a11y-profile");
  const me = sql(`SELECT id FROM "user" WHERE email = '${email}'`);
  const myHandle = sql(`SELECT username FROM "user" WHERE id = '${me}'`);
  const tag = Date.now().toString(36);
  const rita = publicAccount(`rita_${tag}`, "Rita Alves", { bio: "Treino cedo, antes do trabalho." });
  sql(`INSERT INTO "UserProgram" (id, "userId", name, "sourceTemplateId", status, "createdAt", "updatedAt")
       SELECT '${rita}-prog', '${rita}', 'GD 1', id, 'ACTIVE', now(), now() FROM "WorkoutTemplate" WHERE slug = 'gd-1'`);
  postedWorkout(`a11yu${tag}`, rita, "Inferior A", "PUBLIC");
  // Following each other: "Seguindo" asks before undoing it, and ⋯ offers "Remover dos seguidores".
  sql(`INSERT INTO "Follow" ("followerId", "followingId") VALUES ('${me}', '${rita}'), ('${rita}', '${me}')`);

  await page.goto(`/u/rita_${tag}`);
  await expect(page.getByRole("link", { name: /Treinando: GD 1/ })).toBeVisible();
  await expectAxeClean(page);
  await page.getByRole("button", { name: "Seguindo" }).click();
  await expect(page.getByRole("dialog", { name: `Deixar de seguir @rita_${tag}?` })).toBeVisible();
  await expectAxeClean(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Mais opções" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectAxeClean(page);
  await page.keyboard.press("Escape");

  // The owner's own profile: counts that open the lists, edit and share.
  await page.goto(`/u/${myHandle}`);
  await expect(page.getByRole("link", { name: "1 seguidor — ver lista" })).toBeVisible();
  await expectAxeClean(page);
  await page.goto(`/u/ninguem_${tag}`);
  await expect(page.getByText("404 · Perfil")).toBeVisible();
  await expectAxeClean(page);

  // Signed out: the public header and footer around the same profile.
  const signedOut = await browser.newContext(PHONE);
  const anon = await signedOut.newPage();
  await anon.goto(`/u/rita_${tag}`);
  await expect(anon.getByRole("banner").getByRole("link", { name: "Criar conta" })).toBeVisible();
  await expectAxeClean(anon);
  await anon.goto(`/u/ninguem_${tag}`);
  await expect(anon.getByText("404 · Perfil")).toBeVisible();
  await expectAxeClean(anon);
  await signedOut.close();
});

test("Descobrir, the feed, a workout's page and Today's team strip pass axe — the owner's controls and confirm too (W-047, W-139, W-142, W-143)", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  const email = await onboarded(page, "a11y-social-c2");
  const me = sql(`SELECT id FROM "user" WHERE email = '${email}'`);
  const tag = Date.now().toString(36);
  const rita = publicAccount(`rita2_${tag}`, "Rita Alves");
  const bruno = publicAccount(`bruno2_${tag}`, "Bruno Lima");
  const hers = postedWorkout(`a11yf${tag}`, rita, "Inferior A", "PUBLIC");
  postedWorkout(`a11yb${tag}`, bruno, "Pull B", "PUBLIC", 30);
  const mine = postedWorkout(`a11ym${tag}`, me, "Superior A", "FOLLOWERS", 1);
  sql(`INSERT INTO "Follow" ("followerId", "followingId") VALUES ('${me}', '${rita}')`);
  // Bruno gave FG to Rita's workout: its page names him.
  sql(`INSERT INTO "ActivityFG" ("activityId", "userId") VALUES ('${hers}', '${bruno}')`);
  sql(`UPDATE "Activity" SET "fgCount" = 1 WHERE id = '${hers}'`);

  await page.goto("/app/discover");
  await expect(page.getByRole("heading", { name: "Convide um amigo" })).toBeVisible();
  await expectAxeClean(page);
  await page.goto(`/app/discover?q=${encodeURIComponent(`bruno2_${tag}`)}`);
  await expect(page.getByRole("link", { name: new RegExp(`bruno2_${tag}`) })).toBeVisible();
  await expectAxeClean(page);

  await page.goto("/app/feed");
  await expect(page.getByRole("link", { name: "Visibilidade: Seguidores. Alterar" })).toBeVisible();
  await expectAxeClean(page);

  await page.goto(`/app/activity/${hers}`);
  await expect(page.getByText("FG de Bruno Lima")).toBeVisible();
  await expectAxeClean(page);
  await page.goto(`/app/activity/${mine}`);
  await expect(page.getByRole("radiogroup", { name: "Quem vê" })).toBeVisible();
  await expectAxeClean(page);
  await page.getByRole("button", { name: "Excluir publicação" }).click();
  await expect(page.getByRole("dialog", { name: "Excluir publicação?" })).toBeVisible();
  await expectAxeClean(page);
  await page.keyboard.press("Escape");

  await page.goto("/app/today");
  await expect(page.getByRole("heading", { name: "Da sua equipe" })).toBeVisible();
  await expectAxeClean(page);
});
