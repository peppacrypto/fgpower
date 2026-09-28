/**
 * Batch 4 — the exercise library, science references, and app-wide
 * accessibility/identity fixes (W-072 … W-077, W-098, W-150, W-153, W-156,
 * W-162 … W-169), on a phone.
 */
import { execSync } from "node:child_process";
import { test, expect, devices, type Page } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";
import { newUserOnGd1, uniqueEmail } from "./workout-helpers";

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
