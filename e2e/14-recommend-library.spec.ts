import { execSync } from "node:child_process";
import { test, expect, devices, type Page } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { uniqueEmail, waitForWorkoutScreen } from "./workout-helpers";

/*
 * Activation and choosing (Batch 2, cluster C): the onboarding answers pick a
 * program on Today and at the top of the library, one tap activates it and
 * opens the first workout; the library is filtered by the profile, shelved,
 * and its search speaks Portuguese; the dossier explains its notation, echoes
 * the user's limitations, opens the section a jump link points at and only
 * pins its start bar once the masthead buttons scrolled away.
 */

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium" });
test.describe.configure({ timeout: 120_000 });

/** Runs SQL on the local dev database (docker compose's fgpower-postgres). */
function sql(query: string): string {
  return execSync(
    `docker exec -i fgpower-postgres sh -c 'psql -U "$POSTGRES_USER" -d fgpower -At -v ON_ERROR_STOP=1'`,
    {
      encoding: "utf8",
      input: query,
    },
  ).trim();
}
const hasDb = (() => {
  try {
    return sql("SELECT 1") === "1";
  } catch {
    return false;
  }
})();

interface Answers {
  goal?: string;
  experience?: string;
  daysPerWeek?: number;
  sessionMinutes?: number;
  equipmentAccess?: string;
  limitations?: string | null;
}

/**
 * A new user whose onboarding answers are exactly `answers` (written straight
 * to the profile, so these tests don't depend on the wizard's screens).
 */
async function newUserWith(page: Page, label: string, answers: Answers = {}) {
  const email = uniqueEmail(label);
  await loginAsTestUser(page, email);
  const a = {
    goal: "HYPERTROPHY",
    experience: "BEGINNER",
    daysPerWeek: 3,
    sessionMinutes: 60,
    equipmentAccess: "FULL_GYM",
    limitations: null,
    ...answers,
  };
  const userId = sql(`SELECT id FROM "user" WHERE email = '${email}'`);
  const limitations = a.limitations ? `'${a.limitations.replace(/'/g, "''")}'` : "NULL";
  sql(`INSERT INTO "Profile" (id, "userId", "displayName", goal, experience, "daysPerWeek", "sessionMinutes",
         "equipmentAccess", limitations, "onboardingCompletedAt", "updatedAt")
       VALUES ('e2e_' || md5(random()::text), '${userId}', 'Teste E2E', '${a.goal}', '${a.experience}', ${a.daysPerWeek},
         ${a.sessionMinutes}, '${a.equipmentAccess}', ${limitations}, now(), now())
       ON CONFLICT ("userId") DO UPDATE SET goal = EXCLUDED.goal, experience = EXCLUDED.experience,
         "daysPerWeek" = EXCLUDED."daysPerWeek", "sessionMinutes" = EXCLUDED."sessionMinutes",
         "equipmentAccess" = EXCLUDED."equipmentAccess", limitations = EXCLUDED.limitations,
         "onboardingCompletedAt" = now()`);
  return userId;
}

const panel = (page: Page) => page.getByTestId("recommended-panel");

test.beforeEach(() => {
  test.skip(!hasDb, "needs the local dev database");
});

test("Today recommends from the onboarding answers and one tap opens the first workout", async ({ page }) => {
  const userId = await newUserWith(page, "rec-today", { daysPerWeek: 5 });
  await page.goto("/app/today");

  // 5 days a week, beginner, full gym: the GD series entry, with why.
  await expect(panel(page).getByText("Recomendado para você")).toBeVisible();
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("GD Adaptação");
  const reasons = panel(page).getByRole("list", { name: "Por que este programa" });
  await expect(reasons).toContainText("5×/semana");
  await expect(reasons).toContainText("Iniciante");
  await expect(reasons).toContainText("Academia completa");
  await expect(panel(page).getByText("Outras opções")).toBeVisible();
  await expect(panel(page).getByRole("link", { name: /GD 1/ })).toHaveAttribute("href", "/app/programs/templates/gd-1");
  await expect(panel(page).getByRole("link", { name: "Ver programa" })).toHaveAttribute(
    "href",
    "/app/programs/templates/gd-adaptacao",
  );

  // The main button sits above the bottom nav on a phone.
  const start = panel(page).getByRole("button", { name: "Ativar e começar" });
  const box = await start.boundingBox();
  const nav = await page.getByRole("navigation", { name: "Navegação principal" }).boundingBox();
  expect(box && nav && box.y + box.height <= nav.y).toBeTruthy();

  await Promise.all([page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }), start.click()]);
  await waitForWorkoutScreen(page);
  const [name, status, linked] = sql(
    `SELECT s.name, p.status, (s."enrollmentId" IS NOT NULL) FROM "WorkoutSession" s
     JOIN "UserProgram" p ON p.id = s."programId" WHERE s."userId" = '${userId}'`,
  ).split("|");
  expect(name).toBe("Segunda — Superior A (máquinas)");
  expect(status).toBe("ACTIVE");
  expect(linked).toBe("t");
});

test("a fat-loss goal gets the honest line and full-body picks", async ({ page }) => {
  await newUserWith(page, "rec-fat", { goal: "FAT_LOSS" });
  await page.goto("/app/today");
  await expect(panel(page)).toContainText("Musculação preserva músculo no déficit; quem emagrece é a dieta.");
  await expect(panel(page).getByRole("link", { name: /Sem Medo das Máquinas/ })).toBeVisible();

  // The library's "Emagrecer" preset keeps the program the panel recommends.
  await page.goto("/app/programs");
  await expect(panel(page).getByRole("heading", { level: 2 })).toContainText("Adaptação FGPOWER");
  const filters = page.getByRole("group", { name: "Filtros" });
  await expect(filters.getByRole("button", { name: "Emagrecer" })).toHaveAttribute("aria-pressed", "true");
  const library = page.getByRole("region", { name: "Biblioteca de programas" });
  await expect(
    library.locator('a[href="/app/programs/templates/fgpower-adaptation"]').filter({ hasText: "Para você" }),
  ).toBeVisible();
});

test("someone who already trains is never started mid-series or off their week", async ({ page }) => {
  // Intermediate, 5 days: a 5-day plan at their level, not GD 4 ("meses 11-13").
  await newUserWith(page, "rec-int5", { experience: "INTERMEDIATE", daysPerWeek: 5 });
  await page.goto("/app/today");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText(/Divisão Clássica/);
  await expect(panel(page)).not.toContainText(/Bloco \d de 9/);

  // Advanced, 3 days: no 5×/week plan among the pick and its alternates.
  await newUserWith(page, "rec-adv3", { experience: "ADVANCED", daysPerWeek: 3 });
  await page.goto("/app/today");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText(/Full Body Ancorado/);
  await expect(panel(page)).not.toContainText("5×/semana");
  // The chips say which answers match, for screen readers too.
  await expect(panel(page).getByRole("list", { name: "Por que este programa" }).first()).toContainText(
    "3×/semana (confere com o seu perfil)",
  );
});

test("a 2-day home-dumbbell beginner gets the 2-day dumbbell plan", async ({ page }) => {
  await newUserWith(page, "rec-home2", { equipmentAccess: "HOME_DUMBBELLS", daysPerWeek: 2, sessionMinutes: 45 });
  await page.goto("/app/today");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Corpo Inteiro Express");
  const reasons = panel(page).getByRole("list", { name: "Por que este programa" });
  await expect(reasons).toContainText("2×/semana (confere com o seu perfil)");
  await expect(reasons).toContainText("40 min (confere com o seu perfil)");

  // "Outras opções" names read whole on a 320px phone (two lines, not one truncated one).
  await page.setViewportSize({ width: 320, height: 640 });
  const alt = panel(page).getByRole("link", { name: /Halteres em Casa — Base Full-Body para Iniciantes/ });
  const title = alt.locator(".line-clamp-2");
  await expect(title).toHaveText("Halteres em Casa — Base Full-Body para Iniciantes");
  expect(await title.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);

  // The wizard's defaults (hypertrophy, 60 min) don't swap in a 3-day plan for a 2-day week.
  await newUserWith(page, "rec-home2-60", { equipmentAccess: "HOME_DUMBBELLS", daysPerWeek: 2, sessionMinutes: 60 });
  await page.goto("/app/today");
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Corpo Inteiro Express");
  await expect(panel(page).getByRole("list", { name: "Por que este programa" })).toContainText(
    "2×/semana (confere com o seu perfil)",
  );
});

test("the library leads with the pick's shelf, and the GD plan is one series card that starts by profile", async ({ page }) => {
  await newUserWith(page, "lib-int5", { experience: "INTERMEDIATE", daysPerWeek: 5 });
  await page.goto("/app/programs");
  const library = page.getByRole("region", { name: "Biblioteca de programas" });
  const shelves = library.locator("section[aria-label]");
  // Preset "5× · Intermediário · Academia · Hipertrofia": the pick's shelf comes first, the pick leads it.
  await expect(shelves.first()).toHaveAttribute("aria-label", "Força & hipertrofia");
  await expect(shelves.first().locator("a").first()).toContainText("Para você");
  await expect(shelves.first().locator("a").first()).toContainText("Divisão Clássica");
  // The GD plan is one card, not nine look-alikes: its rail, and — for someone who already
  // trains — "Começar pelo GD 1" (a newcomer is sent to the Adaptação).
  const gd = library.getByRole("region", { name: "Plano GD" });
  const card = gd.locator('[data-series="gd"]');
  await expect(card).toContainText("Plano GD");
  await expect(card.getByRole("img", { name: /^9 blocos em sequência/ })).toBeVisible();
  await expect(card.getByRole("link", { name: /Começar pelo GD 1/ })).toHaveAttribute(
    "href",
    "/app/programs/templates/gd-1",
  );
  // Filtered by the profile: the list opens on the blocks the chips kept, each a link.
  const matches = Number((await gd.getByText(/^\d+ de 9 blocos$/).innerText()).split(" ")[0]);
  expect(matches).toBeGreaterThan(0);
  const blocks = card.locator('ol a[href^="/app/programs/templates/gd-"]');
  await expect(blocks.filter({ visible: true })).toHaveCount(matches);

  // Typing beats the profile chips: "30 min" finds the shortest of all programs, not of the chips.
  const search = page.getByLabel("Buscar programa");
  await search.fill("30 min");
  await expect(page.getByText("Nada com os filtros escolhidos — buscando em todos os programas.")).toBeVisible();
  await expect(page.getByText("Nenhum programa cabe em 30 min — estes são os mais curtos.")).toBeVisible();
  await expect(page.locator('a[href="/app/programs/templates/full-body-express"]')).toBeVisible();
  await expect(page.locator('a[href="/app/programs/templates/gd-4"]')).toHaveCount(0);
  await search.fill("sem equipamento");
  await expect(page.getByText("Nada com os filtros escolhidos — buscando em todos os programas.")).toBeVisible();
  await expect(page.getByText(/mostrando todos os programas/)).toHaveCount(0);
  // A program asked for by name comes up even when the chips hide it (and GD 3/4 share "ano 1").
  await search.fill("GD 1");
  await expect(page.getByText("GD 1 está fora dos filtros escolhidos — buscando em todos os programas.")).toBeVisible();
  await expect(library.locator('a[href^="/app/programs/templates/"]').first()).toHaveAttribute(
    "href",
    "/app/programs/templates/gd-1",
  );
});

test("the library starts filtered by the profile, shelved, and its search speaks Portuguese", async ({ page }) => {
  await newUserWith(page, "lib", { equipmentAccess: "HOME_DUMBBELLS", sessionMinutes: 45 });
  await page.goto("/app/programs");

  // The pick for a home-dumbbell beginner leads, and "Criar" doesn't.
  await expect(panel(page).getByRole("heading", { level: 2 })).toContainText("Halteres em Casa");
  await expect(page.getByRole("link", { name: "Criar" })).not.toHaveClass(/bg-accent-strong/);
  await expect(page.getByText("Meus programas")).toHaveCount(0);

  const filters = page.getByRole("group", { name: "Filtros" });
  await expect(filters.getByRole("button", { name: "Casa", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(filters.getByRole("button", { name: "Iniciante" })).toHaveAttribute("aria-pressed", "true");
  await expect(filters).toContainText("Filtrado pelo seu perfil");
  const library = page.getByRole("region", { name: "Biblioteca de programas" });
  await expect(library.getByRole("region", { name: "Casa & mínimo" })).toBeVisible();
  await expect(library.getByRole("region", { name: "Plano GD" })).toHaveCount(0);

  await filters.getByRole("button", { name: "Limpar" }).click();
  const gd = library.getByRole("region", { name: "Plano GD" });
  await expect(gd).toBeVisible();
  // Unfiltered, shelves preview their first cards; every program is still in the page.
  const hrefs = await library
    .locator('a[href^="/app/programs/templates/"]')
    .evaluateAll((links) => new Set(links.map((a) => a.getAttribute("href"))).size);
  expect(hrefs).toBe(48);
  // The GD card folds its 9 blocks away (still links in the page) behind one toggle.
  const gdBlocks = gd.locator('ol a[href^="/app/programs/templates/"]');
  await expect(gdBlocks).toHaveCount(9);
  await expect(gdBlocks.filter({ visible: true })).toHaveCount(0);
  await expect(gd.getByRole("link", { name: "Começar pela Adaptação" })).toBeVisible();
  await gd.getByRole("button", { name: "Ver os 9 blocos" }).click();
  await expect(gdBlocks.filter({ visible: true })).toHaveCount(9);
  await expect(gd.getByRole("button", { name: "Esconder os blocos" })).toHaveAttribute("aria-expanded", "true");
  await expect(filters.getByRole("button", { name: "5 dias por semana" })).toHaveAttribute("aria-pressed", "false");
  await filters.getByRole("button", { name: "Usar meu perfil" }).click();
  await expect(filters).toContainText("Filtrado pelo seu perfil");

  // Everyday words find programs: fat loss (with the honest line), no equipment, "treino ABC".
  const search = page.getByLabel("Buscar programa");
  await search.fill("emagrecer");
  await expect(page.getByText(/^Musculação preserva músculo no déficit/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Halteres em Casa/ })).toBeVisible();
  await search.fill("sem equipamento");
  await expect(page.getByRole("link", { name: /Escada Corporal/ })).toBeVisible();

  // Nothing found: suggestions and the user's picks instead of a dead end.
  await search.fill("xyzzy");
  await expect(page.getByText("Nenhum programa encontrado para “xyzzy”.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "em casa", exact: true }).click();
  await expect(search).toHaveValue("em casa");
  await expect(page.getByRole("link", { name: /Halteres em Casa/ })).toBeVisible();

  // One clear button: a stylesheet rule hides the browser's own (computed styles
  // of that pseudo-element aren't readable).
  const hidesNativeClear = await search.evaluate((el) => {
    const rules = [...document.styleSheets].flatMap((sheet) => {
      try {
        return [...sheet.cssRules];
      } catch {
        return [];
      }
    });
    const flat = (list: CSSRule[]): CSSStyleRule[] =>
      list.flatMap((r) =>
        r instanceof CSSStyleRule
          ? [r, ...flat([...r.cssRules])]
          : "cssRules" in r
            ? flat([...(r as CSSGroupingRule).cssRules])
            : [],
      );
    return flat(rules).some((r) => {
      if (!r.selectorText.includes("::-webkit-search-cancel-button") || r.style.appearance !== "none") return false;
      // Tailwind nests the pseudo under the utility class: "&::-webkit-search-cancel-button".
      const base = r.selectorText.startsWith("&")
        ? (r.parentRule as CSSStyleRule | null)?.selectorText
        : r.selectorText.split("::")[0];
      return Boolean(base && el.matches(base));
    });
  });
  expect(hidesNativeClear).toBe(true);
  await expect(page.getByRole("button", { name: "Limpar busca" })).toHaveCount(1);
});

test("program cards read their days and never widen a 320px screen", async ({ page }) => {
  await newUserWith(page, "cards");
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/app/programs");
  await page.getByRole("group", { name: "Filtros" }).getByRole("button", { name: "Limpar" }).click();
  const home = page.locator('a[href="/app/programs/templates/home-dumbbells"]').last();
  await expect(home.getByText("A", { exact: true })).toBeVisible();
  // The GD plan's card (rail and all) fits too.
  await page.getByRole("region", { name: "Plano GD" }).getByRole("button", { name: "Ver os 9 blocos" }).click();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(320);
  // A GD block found by name is a full card, its weekday-named days read as such.
  await page.getByLabel("Buscar programa").fill("GD Adaptação");
  const gd = page.locator('a[href="/app/programs/templates/gd-adaptacao"]').first();
  await expect(gd).toContainText("SEG · SUP A");
  await expect(gd).toContainText("QUA · TÉC");
  // Led by its outcome; its place in the series is a mono line.
  await expect(gd).toContainText("Bloco 1 de 9 · mês 1");
  await expect(gd).toContainText("Aprenda os movimentos");
  await page.getByLabel("Buscar programa").fill("");
  // The masthead's "Criar" stays inside the gutter, level with the search box.
  const criar = await page.getByRole("link", { name: "Criar" }).boundingBox();
  const searchBox = await page.getByLabel("Buscar programa").boundingBox();
  expect(criar && searchBox && criar.x + criar.width <= searchBox.x + searchBox.width + 0.5).toBeTruthy();

  // The dossier's start button wraps inside itself instead of spilling out, and never says a bare letter.
  for (const [slug, label] of [
    ["gd-7", "Ativar e iniciar Empurrar"],
    ["athletic-power", "Ativar e iniciar Potência Inferior A"],
    ["kettlebell-strong", "Ativar e iniciar Treino A"],
  ]) {
    await page.goto(`/app/programs/templates/${slug}`);
    const start = page.locator("#dossier-actions").getByRole("button", { name: label });
    await expect(start).toBeVisible();
    const fits = await start.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const inner = [...el.querySelectorAll("span, svg")].map((c) => c.getBoundingClientRect());
      return el.scrollWidth <= el.clientWidth && inner.every((c) => c.left >= r.left - 0.5 && c.right <= r.right + 0.5);
    });
    expect(fits, slug).toBe(true);
  }

  // The public library too.
  const visitor = await page
    .context()
    .browser()!
    .newContext({ ...devices["iPhone 13"], viewport: { width: 320, height: 700 } });
  try {
    const p = await visitor.newPage();
    await p.goto(`${test.info().project.use.baseURL}/programs`);
    // The GD plan's card sends a visitor to the Adaptação; every block is still a link in the page.
    await expect(p.getByRole("link", { name: "Começar pela Adaptação" })).toHaveAttribute("href", "/programs/gd-adaptacao");
    await expect(p.locator('a[href="/programs/gd-1"]')).toHaveCount(1);
    expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    // Signing up from a public program page comes back to that program.
    await p.goto(`${test.info().project.use.baseURL}/programs/gd-1`);
    await expect(p.getByRole("link", { name: /Começar este programa/ })).toHaveAttribute(
      "href",
      "/login?next=%2Fapp%2Fprograms%2Ftemplates%2Fgd-1",
    );
  } finally {
    await visitor.close();
  }
});

test("the dossier explains its notation, echoes limitations and starts training in one tap", async ({ page }) => {
  await newUserWith(page, "dossier", { limitations: "evitar agachamento profundo por causa do joelho" });
  await page.goto("/app/programs/templates/full-body-beginner");

  await expect(page.getByLabel("Suas limitações")).toContainText("evitar agachamento profundo por causa do joelho");
  await expect(page.getByText(/= pare com ~[\d,]+ reps? sobrando/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Entenda o RIR →" })).toHaveAttribute("href", "/app/science/rir");
  await expect(page.getByText("Corpo inteiro", { exact: true }).first()).toBeVisible();
  await expect(page.locator("#estrutura").getByText(/\baq\b/)).toHaveCount(0);

  // The jump nav opens the collapsed section it points at.
  await page.getByRole("navigation", { name: "Seções" }).getByRole("link", { name: "Descrição" }).click();
  await expect
    .poll(() => page.evaluate(() => (document.getElementById("descricao") as HTMLDetailsElement).open))
    .toBe(true);

  // The sticky bar only appears once the masthead buttons scrolled away, with "Personalizar".
  await page.evaluate(() => window.scrollTo(0, 0));
  const sticky = page.getByTestId("dossier-sticky-actions");
  await expect(sticky).toBeHidden();
  await page.evaluate(() => document.getElementById("estrutura")!.scrollIntoView());
  await expect(sticky).toBeVisible();
  await expect(sticky.getByRole("button", { name: "Personalizar" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(sticky).toBeHidden();

  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    page.getByRole("button", { name: "Ativar e iniciar Sessão A" }).click(),
  ]);
  await waitForWorkoutScreen(page);
});

test("Today's recent records: one row per exercise, no session volume", async ({ page }) => {
  const userId = await newUserWith(page, "prs");
  const [a, b, c] = sql(`SELECT id FROM "Exercise" ORDER BY slug LIMIT 3`).split("\n");
  // One workout broke three records of exercise A (and a volume "record"); an
  // older one broke one of B; an even older one a bodyweight rep record of C.
  sql(`INSERT INTO "ExercisePersonalRecord" (id, "userId", "exerciseId", kind, value, "weightKg", reps, "achievedAt") VALUES
    ('pr1_' || md5(random()::text), '${userId}', '${a}', 'MAX_WEIGHT', 62.5, 62.5, 8, now()),
    ('pr2_' || md5(random()::text), '${userId}', '${a}', 'ESTIMATED_1RM', 79.2, 62.5, 8, now()),
    ('pr3_' || md5(random()::text), '${userId}', '${a}', 'SESSION_VOLUME', 1225, NULL, NULL, now()),
    ('pr4_' || md5(random()::text), '${userId}', '${b}', 'MAX_REPS_AT_WEIGHT', 12, 40, 12, now() - interval '1 day'),
    ('pr5_' || md5(random()::text), '${userId}', '${c}', 'MAX_REPS_AT_WEIGHT', 15, 0, 15, now() - interval '2 days')`);
  // Same moment, no session: rows of one exercise are still one row.
  await page.goto("/app/today");
  const records = page.locator("section", { has: page.getByText("Recordes recentes") }).getByRole("link");
  await expect(records).toHaveCount(3);
  await expect(records.first()).toContainText("62,5 kg");
  await expect(records.first()).not.toContainText("1225");
  await expect(records.nth(1)).toContainText("40 kg × 12");
  // Bodyweight: "15 reps", never "0 kg × 15".
  await expect(records.last()).toContainText("15 reps");
  await expect(records.last()).toContainText(/peso corporal/i);
  await expect(records.last()).not.toContainText("0 kg");
});

test("science pages lead back to training", async ({ page }) => {
  await newUserWith(page, "science");
  await page.goto("/app/science");
  await expect(page.getByText("Comece aqui")).toBeVisible();
  await page.goto("/app/science/rir");
  const practice = page.locator("section", { has: page.getByText("Na prática") });
  await expect(practice.locator('a[href^="/app/programs/templates/"]')).toHaveCount(3);
  const next = page.getByRole("link", { name: /Próximo princípio/ });
  await expect(next).toHaveAttribute("href", "/app/science/double-progression");
});
