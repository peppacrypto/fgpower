import { execSync } from "node:child_process";
import { test, expect, devices, type Page } from "@playwright/test";
import { loginAsTestUser } from "./fixtures";
import { completeOnboarding } from "./onboarding-helper";
import { newUserOnGd1, uniqueEmail } from "./workout-helpers";

/**
 * Batch 4 — the builder on the phone and programs that fit the real gym
 * (W-033, W-071, W-079, W-099…W-106, W-109…W-112, W-115). Each test uses a
 * fresh account.
 */

// Drop defaultBrowserType (WebKit): only Chromium is installed for the suite.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use(iPhone);
test.describe.configure({ timeout: 120_000 });

/** Runs SQL on the local dev database (docker compose's fgpower-postgres). */
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

async function newUser(page: Page, label: string) {
  const email = uniqueEmail(label);
  await loginAsTestUser(page, email);
  await completeOnboarding(page);
  const userId = hasDb ? sql(`SELECT id FROM "user" WHERE email = '${email}'`) : "";
  return { email, userId };
}

async function newCustomProgram(page: Page, label: string, name = "Meu treino") {
  const user = await newUser(page, label);
  await page.goto("/app/programs/new");
  await page.getByLabel("Nome do programa").fill(name);
  await Promise.all([
    page.waitForURL(/\/app\/programs\/[^/]+\/edit$/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Continuar" }).click(),
  ]);
  return { ...user, programId: page.url().match(/\/app\/programs\/([^/]+)\/edit$/)![1] };
}

const picker = (page: Page) => page.locator("dialog[open]");
const pickerRows = (page: Page) => picker(page).locator("button[data-exercise-id]");
const rows = (page: Page) => page.locator("[data-row-id]");
const rowNames = async (page: Page) =>
  (await rows(page).locator("[data-row-name]").allTextContents()).map((s) => s.trim());

async function openPicker(page: Page) {
  await page.getByRole("button", { name: "Adicionar exercícios", exact: true }).click();
  await expect(picker(page)).toBeVisible();
}

/** Picks the first match of each query in one visit, then adds them all. */
async function addExercises(page: Page, ...queries: string[]) {
  await openPicker(page);
  const search = picker(page).getByRole("searchbox", { name: "Buscar exercício" });
  for (const q of queries) {
    await search.fill(q);
    const hit = pickerRows(page).filter({ hasText: new RegExp(`^${q}`, "i") }).first();
    await expect(hit).toBeVisible({ timeout: 15_000 });
    await expect(picker(page).locator('[aria-busy="true"]')).toHaveCount(0);
    await hit.click();
    await expect(hit).toHaveAttribute("aria-pressed", "true");
  }
  await picker(page)
    .getByRole("button", { name: new RegExp(`^Adicionar ${queries.length} exercícios?$`) })
    .click();
  await expect(picker(page)).toHaveCount(0);
}

async function rowAction(page: Page, row: number, action: string) {
  await rows(page).nth(row).locator("[data-row-actions]").click();
  await picker(page).getByRole("button", { name: action, exact: true }).click();
}

async function dayAction(page: Page, action: string) {
  await page.locator("[data-day-actions]").click();
  await picker(page).getByRole("button", { name: action, exact: true }).click();
}

async function save(page: Page) {
  await page.getByRole("button", { name: /Salvar programa|Salvo/ }).click();
  await expect(page.getByRole("button", { name: "Salvo" })).toBeVisible({ timeout: 15_000 });
}

test("the picker adds several exercises at once, marks the ones already in the day and starts clean", async ({ page }) => {
  await newCustomProgram(page, "b4-picker");
  await openPicker(page);
  const search = picker(page).getByRole("searchbox", { name: "Buscar exercício" });
  await search.fill("supino");
  // The list shows the query's results (the search waits for a pause in typing first).
  await expect(pickerRows(page).nth(1)).toContainText(/supino/i, { timeout: 15_000 });
  await expect(picker(page).locator('[aria-busy="true"]')).toHaveCount(0);
  await pickerRows(page).nth(0).click();
  await pickerRows(page).nth(1).click();
  const picked = await pickerRows(page).locator("span.block").evaluateAll((els) =>
    els.slice(0, 2).map((e) => e.textContent?.trim() ?? ""),
  );
  await picker(page).getByRole("button", { name: "Adicionar 2 exercícios" }).click();
  await expect(picker(page)).toHaveCount(0);
  expect(await rowNames(page)).toEqual(picked);

  // Opens clean: empty search; what is in the day says so.
  await openPicker(page);
  await expect(search).toHaveValue("");
  await search.fill("supino");
  await expect(pickerRows(page).nth(1)).toContainText(/supino/i, { timeout: 15_000 });
  await expect(picker(page).locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(pickerRows(page).filter({ hasText: picked[0] }).first()).toContainText("No dia");

  // Filters and paging: a muscle chip narrows, "Carregar mais" goes past the first 24.
  await search.fill("");
  await expect(picker(page).locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(pickerRows(page)).toHaveCount(24);
  await picker(page).getByRole("button", { name: /^Carregar mais/ }).click();
  await expect(pickerRows(page)).toHaveCount(48);
  const all = Number((await picker(page).getByText(/^\d+ exercícios$/).innerText()).split(" ")[0]);
  await picker(page).getByRole("button", { name: "Bíceps", exact: true }).click();
  await expect(picker(page).getByRole("button", { name: "Bíceps", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => Number((await picker(page).getByText(/^\d+ exercícios?$/).innerText()).split(" ")[0]))
    .toBeLessThan(all);

  // Favoritos: none with the chip on; none at all says how to get some.
  await picker(page).getByRole("tab", { name: "Favoritos" }).click();
  await expect(picker(page).getByText("Nenhum favorito com esses filtros.")).toBeVisible();
  await picker(page).getByRole("button", { name: "Limpar filtros" }).click();
  await expect(picker(page).getByText(/Você ainda não tem favoritos/)).toBeVisible();
  await picker(page).getByRole("button", { name: "Fechar" }).click();
  await expect(picker(page)).toHaveCount(0);
});

test("a home-dumbbell user's picker starts on their equipment", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newCustomProgram(page, "b4-picker-home");
  sql(`UPDATE "Profile" SET "equipmentAccess" = 'HOME_DUMBBELLS' WHERE "userId" = '${userId}'`);
  await page.reload();
  await openPicker(page);
  await expect(picker(page).getByRole("button", { name: "Seu equipamento" })).toHaveAttribute("aria-pressed", "true");
  await expect(picker(page).locator('[aria-busy="true"]')).toHaveCount(0);
  const lines = await pickerRows(page).locator("span.font-mono").allInnerTexts();
  expect(lines.length).toBeGreaterThan(5);
  for (const line of lines) expect(line).not.toMatch(/MÁQUINA|CABO|BARRA RETA|SMITH/);
});

test("the picker's Favoritos find by muscle like Todos, and browsing leaves stretches out", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newCustomProgram(page, "b4-picker-lists");
  sql(`INSERT INTO "FavoriteExercise" ("userId", "exerciseId") SELECT '${userId}', id FROM "Exercise" WHERE slug = 'dumbbell-bench-press'`);
  const search = async (params: string) => {
    const res = await page.request.get(`/api/exercises/search?${params}`);
    expect(res.ok()).toBe(true);
    return (await res.json()) as { total: number; items: { namePt: string }[] };
  };
  // A muscle word finds the favorite, as in Todos; a query with no searchable word finds nothing.
  expect((await search("tab=favoritos&q=peito")).items.map((e) => e.namePt)).toEqual(["Supino Reto com Halteres"]);
  expect((await search("tab=favoritos&q=-")).total).toBe(0);
  // Browsing a muscle lists lifts, not stretches; asking for them still finds them.
  const browse = await search("muscle=gluteos");
  expect(browse.total).toBeGreaterThan(0);
  expect(browse.items.some((e) => /^Alongamento/.test(e.namePt))).toBe(false);
  expect((await search("muscle=gluteos&q=alongamento")).items.some((e) => /^Alongamento/.test(e.namePt))).toBe(true);
  // The gym name for the lat pulldown.
  expect((await search("q=puxador")).items[0].namePt).toBe("Puxada Alta pela Frente - Pegada Aberta");
});

test("removing is undoable, a day with exercises asks first, days duplicate and exercises move between days", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  const { programId } = await newCustomProgram(page, "b4-days");
  await addExercises(page, "Supino Reto com Barra", "Remada Curvada");
  const names = await rowNames(page);

  // Remover → "… removido · Desfazer".
  await rowAction(page, 0, "Remover");
  await expect(rows(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Desfazer" }).click();
  expect(await rowNames(page)).toEqual(names);

  // Duplicar dia: a copy right after it, selected.
  await dayAction(page, "Duplicar dia");
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Nome do dia")).toHaveValue("Dia 2");
  expect(await rowNames(page)).toEqual(names);

  // Mover para outro dia: the row leaves this day for the other.
  await rowAction(page, 0, "Mover para outro dia…");
  await picker(page).getByRole("button", { name: /D1 Dia 1$/ }).click();
  await expect(rows(page)).toHaveCount(1);
  await tabs.nth(0).click();
  await expect(rows(page)).toHaveCount(3);

  // A day with exercises asks before it goes, and can come back.
  await dayAction(page, "Remover dia");
  await expect(picker(page).getByText("3 exercícios saem deste dia", { exact: false })).toBeVisible();
  await picker(page).getByRole("button", { name: "Remover dia" }).click();
  await expect(tabs).toHaveCount(1);
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(tabs).toHaveCount(2);

  await save(page);
  expect(
    sql(`SELECT string_agg(n::text, ',' ORDER BY "dayIndex") FROM (SELECT d."dayIndex", count(e.id) n FROM "UserProgramDay" d LEFT JOIN "UserProgramExercise" e ON e."dayId" = d.id WHERE d."programId" = '${programId}' GROUP BY d."dayIndex") x`),
  ).toBe("3,1");

  // A generic "Dia 1" copies to the end as "Dia 3" (its number matches its tab);
  // a named day copies right after itself.
  await tabs.nth(0).click();
  await dayAction(page, "Duplicar dia");
  await expect(tabs).toHaveCount(3);
  expect(await tabs.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual(["Dia 1", "Dia 2", "Dia 3"]);
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  await tabs.nth(0).click();
  await page.getByLabel("Nome do dia").fill("Superior");
  await dayAction(page, "Duplicar dia");
  expect(await tabs.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual([
    "Superior",
    "Superior (cópia)",
    "Dia 2",
    "Dia 3",
  ]);
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
});

test("rows fold to one line; defaults follow the exercise, and rest chips, steppers, the note and the day focus save", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  const { programId } = await newCustomProgram(page, "b4-rows");
  await addExercises(page, "Rosca Direta com Barra", "Agachamento Hack");
  // An isolation starts lighter and closer to failure than a compound.
  await expect(rows(page).nth(0)).toContainText("3 × 10–15 · RIR 1 · 1:30");
  await expect(rows(page).nth(1)).toContainText("3 × 6–10 · RIR 2 · 2:30 · +1 aquec.");
  await expect(rows(page).nth(0).locator("input")).toHaveCount(0);

  const row = rows(page).nth(0);
  await row.locator("[data-row-toggle]").click();
  await row.getByRole("button", { name: "Aumentar séries", exact: true }).click();
  await expect(row.locator('input[data-field="sets"]')).toHaveValue("4");
  await row.getByRole("button", { name: "3:00", exact: true }).click();
  await expect(row.getByRole("button", { name: "3:00", exact: true })).toHaveAttribute("aria-pressed", "true");
  await row.getByRole("button", { name: "Outro" }).click();
  await row.getByLabel("Descanso em segundos").fill("75");
  await row.getByLabel("Descanso em segundos").blur();
  await row.getByRole("button", { name: "O que é RIR?" }).click();
  await expect(row.getByText(/repetições na reserva/)).toBeVisible();
  await row.getByRole("button", { name: "+ Nota para o treino" }).click();
  await row.getByLabel("Nota · aparece no treino").fill("Cotovelos colados ao tronco");
  await page.getByLabel("Foco do dia").fill("Braço e perna");
  await row.locator("[data-row-toggle]").click();
  await expect(row).toContainText("4 × 10–15 · RIR 1 · 1:15");

  await save(page);
  expect(
    sql(`SELECT e.sets || '|' || e."restSeconds" || '|' || e.notes || '|' || d.focus FROM "UserProgramExercise" e JOIN "UserProgramDay" d ON d.id = e."dayId" WHERE d."programId" = '${programId}' AND e."sortOrder" = 0`),
  ).toBe("4|75|Cotovelos colados ao tronco|Braço e perna");

  // Rewriting a saved note: emptied, its box stays put and keeps the focus
  // (it used to unmount — keyboard closed, the next letters lost).
  await page.reload();
  const again = rows(page).nth(0);
  await again.locator("[data-row-toggle]").click();
  const note = again.getByLabel("Nota · aparece no treino");
  await note.fill("");
  await expect(note).toBeVisible();
  await expect(note).toBeFocused();
  await note.pressSequentially("Punho neutro");
  // RIR steps to the next whole number from a half value: 2,5 → + 3 / − 2 (+ used to jump to 4).
  const rir = again.locator('input[data-field="rirTarget"]');
  await rir.fill("2,5");
  await rir.blur();
  await again.getByRole("button", { name: "Aumentar RIR" }).click();
  await expect(rir).toHaveValue("3");
  await rir.fill("2,5");
  await rir.blur();
  await again.getByRole("button", { name: "Diminuir RIR" }).click();
  await expect(rir).toHaveValue("2");
  await save(page);
  expect(
    sql(`SELECT e.notes || '|' || e."rirTarget" FROM "UserProgramExercise" e JOIN "UserProgramDay" d ON d.id = e."dayId" WHERE d."programId" = '${programId}' AND e."sortOrder" = 0`),
  ).toBe("Punho neutro|2");
});

test("the weekly volume strip counts sets while building and opens the picker on a low muscle", async ({ page }) => {
  await newCustomProgram(page, "b4-volume");
  const strip = page.getByTestId("volume-strip");
  await expect(strip).toContainText("sem exercícios");
  await addExercises(page, "Supino Reto com Barra");
  await expect(strip).toContainText(/abaixo/);
  const position = () => strip.evaluate((el) => getComputedStyle(el).position);
  expect(await position()).toBe("sticky");
  await strip.getByRole("button", { name: /Volume semanal/ }).click();
  // Open, it stays in the page's flow instead of covering the rows while scrolling.
  expect(await position()).not.toBe("sticky");
  await expect(strip.getByRole("group", { name: /^Peitoral: \d/ }).or(strip.getByRole("button", { name: /^Peitoral: \d/ }))).toBeVisible();

  // Named as Progress's "Séries por músculo" names it: "nenhuma série", never "0 séries…, sem séries".
  await strip.getByRole("button", { name: /^Costas: nenhuma série\. Adicionar/ }).click();
  await expect(picker(page)).toBeVisible();
  await expect(picker(page).getByRole("button", { name: "Costas", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("after saving, a draft offers to start it right there", async ({
  page,
}) => {
  await newCustomProgram(page, "b4-after-save");
  await addExercises(page, "Supino Reto com Barra");
  await save(page);
  await Promise.all([
    page.waitForURL(/\/app\/today\?ativado=1/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Iniciar este programa" }).click(),
  ]);
});

test("editing the running program says when changes apply, and ends with 'Ir para Hoje'", async ({ page }) => {
  await newUserOnGd1(page, "b4-active");
  await page.goto("/app/programs");
  await page.locator('a[href^="/app/programs/"]').filter({ hasText: "GD 1" }).first().click();
  await expect(page.getByRole("link", { name: "Editar", exact: true })).toBeVisible();

  // On a 320px phone the program page reads every exercise name whole: wrapped, never cut to a line
  // ("Rosca Direta c…"), and the page doesn't scroll sideways.
  await page.setViewportSize({ width: 320, height: 640 });
  const names = await page.locator('main a[href^="/app/exercises/"]').evaluateAll((links) =>
    links.map((a) => {
      // The element holding the name's own text (after an optional "A1" superset mark).
      const el = [...a.querySelectorAll("span")].find((s) =>
        [...s.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 3),
      )!;
      const style = getComputedStyle(el);
      const line = style.lineHeight.endsWith("px")
        ? parseFloat(style.lineHeight)
        : parseFloat(style.lineHeight) * parseFloat(style.fontSize);
      return {
        name: el.textContent?.trim(),
        whole: el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1,
        wraps: style.whiteSpace !== "nowrap" && style.textOverflow !== "ellipsis",
        lines: Math.round(el.getBoundingClientRect().height / line),
      };
    }),
  );
  expect(names.length).toBeGreaterThan(5);
  expect(names.filter((n) => !n.whole || !n.wraps)).toEqual([]);
  // GD 1's longer names take a second line at this width.
  expect(names.some((n) => n.lines >= 2)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize(iPhone.viewport);

  await page.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Editar programa" })).toBeVisible();
  await expect(page.getByTestId("active-program-note")).toContainText("As mudanças valem a partir do próximo treino.");
  await rows(page).first().locator("[data-row-toggle]").click();
  await rows(page).first().getByRole("button", { name: "Aumentar séries", exact: true }).click();
  await save(page);
  await expect(page.getByRole("link", { name: "Ir para Hoje" })).toBeVisible();
});

test("'Criar programa' can be cancelled, and Duplicar opens the copy still linked to its template", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b4-dup");
  await page.goto("/app/programs/new");
  await Promise.all([page.waitForURL(/\/app\/programs$/), page.getByRole("link", { name: "Cancelar" }).click()]);

  await page.goto("/app/programs/templates/gd-1");
  await page.getByRole("button", { name: "Ativar programa" }).first().click();
  await page.waitForURL(/\/app\/today/, { timeout: 30_000 });
  const original = sql(`SELECT id FROM "UserProgram" WHERE "userId" = '${userId}'`);
  await page.goto(`/app/programs/${original}`);
  await page.getByTestId("program-menu").getByLabel("Mais ações").click();
  await Promise.all([
    page.waitForURL(/\/edit\?copia=1$/, { timeout: 30_000 }),
    page.getByTestId("program-menu").getByRole("button", { name: "Duplicar" }).click(),
  ]);
  await expect(page.getByRole("status").filter({ hasText: "Cópia criada" })).toBeVisible();
  await expect(page.getByRole("link", { name: "GD 1", exact: true })).toBeVisible();
  const copyId = page.url().match(/\/app\/programs\/([^/]+)\/edit/)![1];
  expect(sql(`SELECT (c."sourceTemplateId" = o."sourceTemplateId")::text FROM "UserProgram" c, "UserProgram" o WHERE c.id = '${copyId}' AND o.id = '${original}'`)).toBe("true");
});

test("Personalizar reopens an untouched copy, a draft can be discarded, and the running template is adjusted in place", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b4-customize");
  const customize = async () => {
    await page.goto("/app/programs/templates/upper-lower");
    await expect(page.getByTestId("customize-help")).toContainText("o original não muda");
    await Promise.all([
      page.waitForURL(/\/app\/programs\/[^/]+\/edit$/, { timeout: 30_000 }),
      page.getByRole("button", { name: "Personalizar" }).first().click(),
    ]);
    return page.url().match(/\/app\/programs\/([^/]+)\/edit$/)![1];
  };
  const first = await customize();
  expect(await customize()).toBe(first);
  expect(sql(`SELECT count(*) FROM "UserProgram" WHERE "userId" = '${userId}'`)).toBe("1");

  await page.getByRole("button", { name: "Descartar rascunho" }).click();
  await Promise.all([
    page.waitForURL(/\/app\/programs\/templates\/upper-lower\?descartado=1$/, { timeout: 30_000 }),
    picker(page).getByRole("button", { name: "Descartar rascunho" }).click(),
  ]);
  await expect(page.getByRole("status").filter({ hasText: "Rascunho descartado" })).toBeVisible();
  expect(sql(`SELECT count(*) FROM "UserProgram" WHERE "userId" = '${userId}'`)).toBe("0");

  // The template already running: no second copy, its program is edited in place.
  await page.goto("/app/programs/templates/upper-lower");
  await page.getByRole("button", { name: "Ativar programa" }).first().click();
  await page.waitForURL(/\/app\/today/, { timeout: 30_000 });
  const running = sql(`SELECT id FROM "UserProgram" WHERE "userId" = '${userId}' AND status = 'ACTIVE'`);
  await page.goto("/app/programs/templates/upper-lower");
  await expect(page.getByRole("button", { name: "Personalizar" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Ajustar meu / })).toHaveAttribute("href", `/app/programs/${running}/edit`);
});

test("cards and dossiers say what a program needs, and a home user adapts one after reviewing each swap", async ({
  page,
}) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b4-adapt");
  sql(`UPDATE "Profile" SET "equipmentAccess" = 'HOME_DUMBBELLS' WHERE "userId" = '${userId}'`);

  await page.goto("/app/programs");
  await expect(page.getByTestId("card-equipment").first()).toBeVisible();

  await page.goto("/app/programs/templates/gd-1");
  await expect(page.getByTestId("dossier-requires")).toContainText(/Requer: máquinas, cabos/i);
  const panel = page.getByTestId("adapt-panel");
  await expect(panel).toContainText("Halteres em casa");
  await Promise.all([
    page.waitForURL(/\/templates\/gd-1\/adapt$/, { timeout: 30_000 }),
    panel.getByRole("link", { name: "Adaptar para halteres" }).click(),
  ]);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Adaptar para halteres");
  const swaps = page.getByTestId("adapt-swap");
  expect(await swaps.count()).toBeGreaterThan(5);
  // Only gear "halteres e talvez um banco" covers: a pulldown becomes the
  // one-arm dumbbell row (a pull-up would need a bar); no default is a
  // kettlebell, ball or bar. Rows with no stand-in say so and keep the original.
  await expect(swaps.filter({ hasText: "Puxada Alta pela Frente" }).first().locator("[data-swap-chosen]")).toHaveText(
    "Remada Unilateral com Halter",
  );
  const kept = await swaps.filter({ hasText: "Sem substituto" }).count();
  for (const line of await swaps.locator("[data-swap-choice] p.font-mono").allTextContents()) {
    expect(line).toMatch(/^(Halteres|Peso do corpo|Sem equipamento|Banco) · /);
  }
  // Keep one on purpose ("tenho acesso"): the counts follow.
  const saveButton = page.getByRole("button", { name: /^Salvar com \d+ trocas$/ });
  const before = Number((await saveButton.innerText()).match(/\d+/)![0]);
  const choice = swaps.filter({ has: page.locator("select") }).first();
  // Retried: a change made before hydration is reset by it.
  await expect(async () => {
    await choice.locator("select").selectOption("keep");
    await expect(saveButton).toHaveText(`Salvar com ${before - 1} trocas`, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(choice.locator("[data-swap-chosen]")).toHaveText(await choice.locator(".line-through").innerText());

  await Promise.all([
    page.waitForURL(/\/edit\?adaptado=\d+$/, { timeout: 30_000 }),
    saveButton.click(),
  ]);
  await expect(page.getByRole("status").filter({ hasText: "Adaptado ao seu equipamento" })).toBeVisible();
  const programId = page.url().match(/\/app\/programs\/([^/]+)\/edit/)![1];
  const notAtHome = sql(`
    SELECT count(*) FROM "UserProgramExercise" e JOIN "UserProgramDay" d ON d.id = e."dayId" JOIN "Exercise" x ON x.id = e."exerciseId"
    WHERE d."programId" = '${programId}'
      AND x."equipmentId" NOT IN ('dumbbell','bench','bodyweight','none')`);
  // Only the one kept on purpose and those with no stand-in still need the gym.
  expect(Number(notAtHome)).toBe(kept + 1);
  expect(sql(`SELECT count(*) FROM "UserProgramExercise" e JOIN "UserProgramDay" d ON d.id = e."dayId" WHERE d."programId" = '${programId}' AND e.notes LIKE 'No lugar de %'`)).not.toBe("0");

  // "Personalizar" afterwards is a plain copy of the template, not the adapted one
  // reopened; the template page keeps pointing at the adapted copy.
  await page.goto("/app/programs/templates/gd-1");
  await expect(page.getByTestId("customize-help")).toContainText("continuar “GD 1 (adaptado)”");
  await Promise.all([
    page.waitForURL(/\/app\/programs\/[^/]+\/edit$/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Personalizar" }).first().click(),
  ]);
  expect(page.url()).not.toContain(programId);
  await expect(page.getByRole("textbox", { name: "Nome do programa" })).toHaveValue("GD 1");
  await page.goto("/app/programs/templates/gd-1");
  await expect(page.getByTestId("customize-help")).toContainText("continuar “GD 1 (adaptado)”");

  // A review whose rows the template no longer has (it changed while open) is
  // shown again, not saved as a copy without the swaps chosen.
  const copies = () => sql(`SELECT count(*) FROM "UserProgram" WHERE "userId" = '${userId}'`);
  const copiesBefore = copies();
  await page.goto("/app/programs/templates/gd-1/adapt");
  await page.locator('select[name^="swap:"]').first().evaluate((el) => el.setAttribute("name", "swap:99:0:gone"));
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/adapt")),
    page.getByRole("button", { name: /^Salvar com \d+ trocas$/ }).click(),
  ]);
  await expect(page).toHaveURL(/\/templates\/gd-1\/adapt\?mudou=1$/);
  await expect(page.getByRole("status").filter({ hasText: "foi atualizado enquanto você revisava" })).toBeVisible();
  await expect(page.getByTestId("adapt-swap").first()).toBeVisible();
  await expect(page.locator("form").getByRole("alert")).toHaveCount(0); // sent back, not failed
  expect(copies()).toBe(copiesBefore);
});

test("undoing a switch to a copy started from the builder puts the copy back on the shelf", async ({ page }) => {
  test.skip(!hasDb, "needs the local dev database");
  const { userId } = await newUser(page, "b4-undo-copy");
  await page.goto("/app/programs/templates/gd-1");
  await Promise.all([
    page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Ativar programa" }).first().click(),
  ]);
  sql(`UPDATE "Profile" SET "equipmentAccess" = 'HOME_DUMBBELLS' WHERE "userId" = '${userId}'`);

  /** Starts the copy open in the builder (switching from GD 1), then "Voltar para GD 1" on Today. */
  const startThenUndo = async () => {
    await page.locator("summary", { hasText: "Iniciar este programa" }).click();
    await Promise.all([
      page.waitForURL(/\/app\/today/, { timeout: 30_000 }),
      page.getByRole("button", { name: "Trocar", exact: true }).click(),
    ]);
    await Promise.all([
      page.waitForURL(/retomado=1/, { timeout: 30_000 }),
      page.getByRole("button", { name: "Voltar para GD 1" }).click(),
    ]);
  };

  // An adapted copy holds the swaps the user reviewed: it can start right away, and an undo
  // within seconds must not throw it away like an accidental "Ativar" copy.
  await page.goto("/app/programs/templates/upper-lower/adapt");
  await Promise.all([
    page.waitForURL(/\/edit\?adaptado=\d+$/, { timeout: 30_000 }),
    page.getByRole("button", { name: /^Salvar com \d+ trocas?$|^Salvar meu programa$/ }).click(),
  ]);
  const adapted = page.url().match(/\/app\/programs\/([^/]+)\/edit/)![1];
  await startThenUndo();
  expect(sql(`SELECT status FROM "UserProgram" WHERE id = '${adapted}'`)).toBe("DRAFT");

  // Same for a "Personalizar" copy edited and saved in the builder.
  await page.goto("/app/programs/templates/upper-lower");
  await Promise.all([
    page.waitForURL(/\/app\/programs\/[^/]+\/edit$/, { timeout: 30_000 }),
    page.getByRole("button", { name: "Personalizar" }).first().click(),
  ]);
  const edited = page.url().match(/\/app\/programs\/([^/]+)\/edit$/)![1];
  expect(edited).not.toBe(adapted);
  await page.getByRole("textbox", { name: "Nome do programa" }).fill("UL do meu jeito");
  await save(page);
  await startThenUndo();
  expect(sql(`SELECT status || '|' || name FROM "UserProgram" WHERE id = '${edited}'`)).toBe("DRAFT|UL do meu jeito");
});

test("a dossier lists close alternatives and compares them side by side", async ({ page }) => {
  await newUser(page, "b4-similar");
  await page.goto("/app/programs/templates/push-pull-legs");
  const similar = page.getByTestId("dossier-similar");
  await expect(similar.getByRole("link").first()).toBeVisible();
  await similar.getByText("Comparar lado a lado").click();
  const table = similar.getByRole("table");
  await expect(table).toBeVisible();
  await expect(table.getByRole("rowheader", { name: "Treinos" })).toBeVisible();
  // The page never scrolls sideways at 390 px, the table does inside itself.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the builder has a heading, labelled fields and day tabs, and hydrates without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await newCustomProgram(page, "b4-a11y");
  await addExercises(page, "Supino Reto com Barra");
  await save(page);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Editar programa" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nome do programa" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nome do dia" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Foco do dia" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Dia 1" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /^Opções de / })).toBeVisible();
  expect(errors.filter((e) => /hydrat|did not match|DndDescribedBy/i.test(e))).toEqual([]);
});
