import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { IPHONE, newOnboardedUser, sql, sqlText, type TestUser } from "./fixtures";

/**
 * Dieta (/app/dieta, from Perfil): the owner's eating plan, loaded by the
 * one-off import (scripts/one-off/2026-11-13-diet-plan.ts — dry run, then
 * --apply with the plan on stdin, as in production); its items marked with
 * one tap, an alternative picked, the totals adding up, everything still there
 * after a reload and on Perfil's card; no day after today; marks made offline
 * shown at once, sent when the signal comes back — or on the next visit, when
 * the tab was closed meanwhile; and the day's weight and waist logged through
 * Corpo's action with the 7-day average against the week before.
 */

test.use({ ...IPHONE, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 150_000 });

const NBSP = " ";
const PLAN = "src/lib/diet/test-plan.json";
const SCRIPT = "scripts/one-off/2026-11-13-diet-plan.ts";
const SP = "'America/Sao_Paulo'";
/** São Paulo day number of now() minus `days`, in SQL. */
const spDay = (days = 0) => `(((now() - interval '${days} days') AT TIME ZONE ${SP})::date - DATE '1970-01-01')`;

/** Runs the import for `email`: the plan as a path, or on stdin ("-"). Returns what it printed. */
function importPlan(email: string, opts: { apply: boolean; stdin?: boolean }): string {
  const args = ["tsx", SCRIPT, opts.stdin ? "-" : PLAN, email, ...(opts.apply ? ["--apply"] : [])];
  return execFileSync("npx", args, { encoding: "utf8", input: opts.stdin ? readFileSync(PLAN, "utf8") : "", timeout: 90_000 });
}

/** A fresh account with the test plan loaded. */
async function userWithPlan(page: Page, label: string): Promise<TestUser> {
  const user = await newOnboardedUser(page, { label });
  importPlan(user.email, { apply: true });
  return user;
}

const dietRows = (userId: string) => sql(`SELECT count(*) FROM "DietLog" WHERE "userId" = ${sqlText(userId)}`);
const item = (page: Page, id: string) => page.locator(`[data-diet-item="${id}"]`);
const kcalMeter = (page: Page) => page.getByRole("progressbar", { name: "Calorias" });

async function noHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}

test("Dieta: the import, items marked with an alternative, kept after a reload and on Perfil; no day after today", async ({ page }) => {
  const user = await newOnboardedUser(page, { label: "diet-marks" });

  // No plan yet: Perfil links Dieta all the same, without the card; the page says so plainly.
  await page.goto("/app/profile");
  await expect(page.getByRole("link", { name: "Dieta", exact: true })).toHaveAttribute("href", "/app/dieta");
  await expect(page.locator("[data-diet-card]")).toHaveCount(0);
  await page.goto("/app/dieta");
  await expect(page.getByRole("heading", { level: 1, name: "Dieta" })).toBeVisible();
  await expect(page.getByText("Nenhum plano alimentar ainda")).toBeVisible();
  await expect(page.locator("[data-diet-body]")).toBeVisible();

  // The import: a dry run writes nothing; --apply with the plan on stdin saves it.
  const dry = importPlan(user.email, { apply: false });
  expect(dry).toContain('Plan "Plano de teste" (2026-01-01): 3 meals, 5 items, 1 alternative(s)');
  expect(dry).toContain("has no plan yet");
  expect(dry).toContain("Dry run: nothing written.");
  expect(sql(`SELECT count(*) FROM "DietPlan" WHERE "userId" = ${sqlText(user.id)}`)).toBe("0");
  expect(importPlan(user.email, { apply: true, stdin: true })).toContain("Saved (created)");
  expect(sql(`SELECT title FROM "DietPlan" WHERE "userId" = ${sqlText(user.id)}`)).toBe("Plano de teste");

  // Perfil: today's diet at a glance, the way in.
  await page.goto("/app/profile");
  const card = page.locator("[data-diet-card]");
  await expect(card).toHaveText(`Dieta de hoje: 0 de 5 itens · 0 kcal de 1.800`);
  await Promise.all([page.waitForURL(/\/app\/dieta$/), card.click()]);
  await expect(page.getByText("Plano de teste", { exact: true })).toBeVisible();
  // Perfil's tab stays lit: Dieta opens from it.
  await expect(page.getByRole("navigation", { name: "Navegação principal" }).locator('a[aria-current="page"]')).toContainText("Perfil");

  // Today, and no later day to go to.
  const day = page.locator("nav[aria-label=Dia]");
  await expect(day).toContainText("Hoje");
  await expect(page.getByRole("link", { name: /^Próximo dia/ })).toHaveCount(0);
  await expect(kcalMeter(page)).toHaveAttribute("aria-valuetext", `0 de 1.800${NBSP}kcal`);
  await expect(page.locator("[data-diet-count]")).toHaveText("0 de 5 itens");

  // One tap marks an item; the totals add it at once.
  const pao = page.getByRole("checkbox", { name: /^Pão integral/ });
  await pao.click();
  await expect(pao).toHaveAttribute("aria-checked", "true");
  await expect(kcalMeter(page)).toHaveAttribute("aria-valuetext", `120 de 1.800${NBSP}kcal`);
  await expect(page.getByRole("progressbar", { name: "Proteína" })).toHaveAttribute("aria-valuetext", `6 de 150${NBSP}g`);

  // The alternative: picked under the item, then marked — the tuna's numbers count, not the tilapia's.
  const choice = page.getByRole("radiogroup", { name: "No lugar: Tilápia ou Atum em lata" });
  await expect(choice.getByRole("radio", { name: "Tilápia" })).toHaveAttribute("aria-checked", "true");
  await choice.getByRole("radio", { name: "Atum em lata" }).click();
  await expect(choice.getByRole("radio", { name: "Atum em lata" })).toHaveAttribute("aria-checked", "true");
  const atum = page.getByRole("checkbox", { name: /^Atum em lata, escorrido/ });
  await expect(atum).toHaveAttribute("aria-checked", "false");
  await atum.click();
  await expect(atum).toHaveAttribute("aria-checked", "true");
  await expect(kcalMeter(page)).toHaveAttribute("aria-valuetext", `260 de 1.800${NBSP}kcal`);
  await expect(page.locator("[data-diet-count]")).toHaveText("2 de 5 itens");
  await expect(page.locator('[data-diet-meal="almoco"]')).toContainText(`1 de 2 · 290${NBSP}kcal`);

  // Saved: two rows, the tuna logged as eaten in the tilapia's place.
  await expect.poll(() => dietRows(user.id), { timeout: 15_000 }).toBe("2");
  expect(sql(`SELECT "choiceId", eaten, food FROM "DietLog" WHERE "userId" = ${sqlText(user.id)} AND "itemId" = 'almoco-tilapia'`)).toBe(
    "almoco-atum|t|Atum em lata, escorrido",
  );
  await expect(page.locator("[data-diet-item][data-pending]")).toHaveCount(0);

  // A reload shows the same day.
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /^Pão integral/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: /^Atum em lata, escorrido/ })).toHaveAttribute("aria-checked", "true");
  await expect(kcalMeter(page)).toHaveAttribute("aria-valuetext", `260 de 1.800${NBSP}kcal`);

  // Unmarking is a tap too, and sticks.
  await page.getByRole("checkbox", { name: /^Pão integral/ }).click();
  await expect(kcalMeter(page)).toHaveAttribute("aria-valuetext", `140 de 1.800${NBSP}kcal`);
  await expect.poll(() => dietRows(user.id), { timeout: 15_000 }).toBe("1");
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /^Pão integral/ })).toHaveAttribute("aria-checked", "false");
  await expect(kcalMeter(page)).toHaveAttribute("aria-valuetext", `140 de 1.800${NBSP}kcal`);

  // Yesterday is its own day, empty; from there, the next day is today again.
  await Promise.all([page.waitForURL(/\/app\/dieta\?dia=\d{4}-\d{2}-\d{2}$/), page.getByRole("link", { name: /^Dia anterior/ }).click()]);
  await expect(day).toContainText("Ontem");
  await expect(page.locator('[data-diet-item][data-eaten="true"]')).toHaveCount(0);
  await expect(kcalMeter(page)).toHaveAttribute("aria-valuetext", `0 de 1.800${NBSP}kcal`);
  await Promise.all([page.waitForURL(/\/app\/dieta$/), page.getByRole("link", { name: /^Próximo dia/ }).click()]);
  await expect(day).toContainText("Hoje");
  await expect(page.getByRole("checkbox", { name: /^Atum em lata, escorrido/ })).toHaveAttribute("aria-checked", "true");
  // A day after today can't be opened: ?dia= ahead falls back to today.
  const tomorrow = sql(`SELECT to_char((now() AT TIME ZONE ${SP})::date + 1, 'YYYY-MM-DD')`);
  await page.goto(`/app/dieta?dia=${tomorrow}`);
  await expect(day).toContainText("Hoje");

  // The swaps and rules, folded at the bottom.
  const swaps = page.locator('[data-diet-guide="swaps"]');
  await expect(swaps).not.toHaveAttribute("open");
  await swaps.locator("summary").click();
  await expect(swaps).toContainText("100 g de arroz cozido = 1 pão francês");
  await noHorizontalScroll(page);

  // Perfil's card counts what was marked today.
  await page.goto("/app/profile");
  await expect(page.locator("[data-diet-card]")).toHaveText(`Dieta de hoje: 1 de 5 itens · 140 kcal de 1.800`);
});

test("Dieta offline: a mark shows at once, goes when the signal is back — or on the next visit after the tab closed", async ({
  page,
  context,
}) => {
  const user = await userWithPlan(page, "diet-offline");
  await page.goto("/app/dieta");
  await expect(page.getByRole("checkbox", { name: /^Iogurte natural/ })).toBeVisible();

  await context.setOffline(true);
  const iogurte = page.getByRole("checkbox", { name: /^Iogurte natural/ });
  await iogurte.click();
  await expect(iogurte).toHaveAttribute("aria-checked", "true");
  await expect(kcalMeter(page)).toHaveAttribute("aria-valuetext", `70 de 1.800${NBSP}kcal`);
  await expect(page.locator("[data-diet-totals]")).toContainText("Sem conexão. 1 marcação fica neste aparelho e vai quando o sinal voltar.");
  await expect(item(page, "lanche-iogurte")).toContainText("não enviado");
  expect(dietRows(user.id)).toBe("0");

  await context.setOffline(false);
  await expect.poll(() => dietRows(user.id), { timeout: 20_000 }).toBe("1");
  await expect(page.locator("[data-diet-item][data-pending]")).toHaveCount(0);
  await expect(page.locator("[data-diet-totals]")).not.toContainText("Sem conexão");

  // Offline again, and the tab closed before the signal came back: the mark waits on this device.
  await context.setOffline(true);
  await page.getByRole("checkbox", { name: /^Ovos mexidos/ }).click();
  await expect(item(page, "cafe-ovos")).toHaveAttribute("data-pending", "true");
  const stored = await page.evaluate((id) => localStorage.getItem(`fg:diet-marks:${id}`), user.id);
  expect(JSON.parse(stored ?? "null")).toMatchObject({ v: 1, marks: [{ itemId: "cafe-ovos", eaten: true, choiceId: null }] });
  await page.close();
  await context.setOffline(false);
  expect(dietRows(user.id)).toBe("1");

  const next = await context.newPage();
  await next.goto("/app/dieta");
  await expect.poll(() => dietRows(user.id), { timeout: 20_000 }).toBe("2");
  await expect(next.getByRole("checkbox", { name: /^Ovos mexidos/ })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => next.evaluate((id) => localStorage.getItem(`fg:diet-marks:${id}`), user.id)).toBeNull();
  await next.reload();
  await expect(next.getByRole("checkbox", { name: /^Ovos mexidos/ })).toHaveAttribute("aria-checked", "true");
  await expect(kcalMeter(next)).toHaveAttribute("aria-valuetext", `220 de 1.800${NBSP}kcal`);
});

test("Dieta: the day's weight and waist through Corpo's action, and the 7-day average against the week before", async ({ page }) => {
  const user = await userWithPlan(page, "diet-body");
  // Two more weigh-ins this week, three the week before.
  const rows = [
    [1, 81.8],
    [2, 82],
    [7, 82.6],
    [8, 82.4],
    [9, 82.8],
  ].map(
    ([ago, kg]) =>
      `('bm' || md5(random()::text), ${sqlText(user.id)}, 'BODYWEIGHT', ${kg}, 'kg', now() - interval '${ago} days', ${spDay(ago)})`,
  );
  sql(`INSERT INTO "BodyMetric" (id, "userId", kind, value, unit, "measuredAt", day) VALUES ${rows.join(", ")}`);

  await page.goto("/app/dieta");
  const body = page.locator("[data-diet-body]");
  // Two weigh-ins this week so far: no average yet.
  await expect(body.locator("[data-diet-week]")).toHaveText("A média de 7 dias aparece com 3 pesagens na semana (2 de 3 até aqui).");

  const weight = page.locator("[data-diet-weight]");
  await expect(weight.locator("[data-diet-current]")).toHaveText("Ainda não registrado");
  await weight.getByLabel(/^Peso/).fill("81,4");
  await weight.getByRole("button", { name: "Salvar" }).click();
  await expect(weight.locator("[data-diet-current]")).toHaveText(`Hoje: 81,4${NBSP}kg`);
  // (81,4 + 81,8 + 82) / 3 = 81,7 against (82,6 + 82,4 + 82,8) / 3 = 82,6.
  await expect(body.locator("[data-diet-week]")).toHaveText(`Média de 7 dias: 81,7${NBSP}kg · −0,9${NBSP}kg em relação aos 7 dias anteriores`);

  const waist = page.locator("[data-diet-waist]");
  await waist.getByLabel(/^Cintura/).fill("84");
  await waist.getByRole("button", { name: "Salvar" }).click();
  await expect(waist.locator("[data-diet-current]")).toHaveText(`Hoje: 84${NBSP}cm`);

  // Corpo's rows: one per kind and São Paulo day, today's.
  expect(
    sql(`SELECT kind, value FROM "BodyMetric" WHERE "userId" = ${sqlText(user.id)} AND day = ${spDay(0)} ORDER BY kind`),
  ).toBe("BODYWEIGHT|81.4\nWAIST|84");
  // The same day again: the latest wins.
  await weight.getByLabel(/^Peso/).fill("81,2");
  await weight.getByRole("button", { name: "Salvar" }).click();
  await expect(weight.locator("[data-diet-current]")).toHaveText(`Hoje: 81,2${NBSP}kg`);
  expect(sql(`SELECT count(*) FROM "BodyMetric" WHERE "userId" = ${sqlText(user.id)} AND kind = 'BODYWEIGHT' AND day = ${spDay(0)}`)).toBe("1");

  // Everything else lives on Progresso › Corpo.
  await expect(body.getByRole("link", { name: /Progresso › Corpo/ })).toHaveAttribute("href", "/app/progress/body");
  await page.reload();
  await expect(weight.locator("[data-diet-current]")).toHaveText(`Hoje: 81,2${NBSP}kg`);
  await expect(waist.locator("[data-diet-current]")).toHaveText(`Hoje: 84${NBSP}cm`);
});
