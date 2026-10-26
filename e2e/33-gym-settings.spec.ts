import { test, expect, devices, type Locator, type Page } from "@playwright/test";
import { sql, sqlText, userIdOf } from "./fixtures";
import { newUserOnGd1 } from "./workout-helpers";

/**
 * Settings → Minha academia: the loads move the way the user's gym does —
 * the dumbbell rack's spacing, one plate of a machine's and of a cable's
 * stack, the lightest plate, the kettlebell gap — instead of 2,5 kg on
 * everything, and the gear the gym doesn't have stays out of the swaps. The
 * section sits right after Rotina; every choice autosaves and survives a
 * reload; a plan exercise on a machine the gym lacks is flagged, with the
 * way to adjust the plan. Each test uses a fresh account on GD 1.
 */

// Drop defaultBrowserType (WebKit): only Chromium is installed for the suite.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use({ ...iPhone, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 120_000 });

const gymSection = (page: Page) => page.locator("section#academia");
/** A gear group of Aparelhos ("legs", "stations"…): a fold that opens on its summary row. */
const gearGroup = (page: Page, id: string) => gymSection(page).locator(`details[data-gear-group="${id}"]`);

/** Opens a gear group unless it already is (a group with something missing opens by itself). */
async function openGroup(group: Locator) {
  if (!(await group.evaluate((d) => (d as HTMLDetailsElement).open))) await group.locator("summary").click();
  await expect(group.getByRole("checkbox").first()).toBeVisible();
}

/**
 * Ticks (`has`) or unticks one gear box and waits for the list's count to say
 * `expected`. Retried: a tap made while the page is still hydrating flips the
 * native box but never reaches the list, so each try first puts the box back.
 */
async function setGear(page: Page, box: Locator, has: boolean, expected: string) {
  await expect(async () => {
    await box.setChecked(!has);
    await box.setChecked(has);
    await expect(gymSection(page).locator("[data-gear-missing-count]")).toHaveText(expected, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

const profileRow = (userId: string, columns: string) => sql(`SELECT ${columns} FROM "Profile" WHERE "userId" = ${sqlText(userId)}`);

test("Minha academia sits right after Rotina, and the gym's weights and gear are kept through a reload", async ({ page }) => {
  await newUserOnGd1(page, "gym-settings");
  const userId = await userIdOf(page);
  await page.goto("/app/settings");

  const gym = gymSection(page);
  await expect(gym.getByRole("heading", { level: 2, name: "Minha academia" })).toBeVisible();
  await expect(gym).toContainText("As sugestões de carga e as trocas de exercício seguem a sua academia.");
  const order = await page.locator("section[id]").evaluateAll((sections) => sections.map((s) => s.id));
  expect(order.indexOf("academia")).toBe(order.indexOf("rotina") + 1);

  // Pesos — the most common Brazilian gym until the user says otherwise, each choice with what it means.
  const dumbbells = gym.getByRole("radiogroup", { name: /^Halteres/ });
  await expect(dumbbells.getByRole("radio", { name: "1 em 1 até 10 kg, depois 2 em 2" })).toHaveAttribute("aria-checked", "true");
  await expect(gym.locator("#gym-dumbbells-desc")).toContainText(/8 → 9\skg; 12 → 14\skg/);
  const cables = gym.getByRole("radiogroup", { name: /^Polias/ });
  await expect(cables.getByRole("radio", { name: "5 quilos", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(gym.locator("#gym-cable-desc")).toContainText(/20 → 25\skg/);
  await expect(gym.getByRole("radiogroup", { name: /^Máquinas com pino/ }).getByRole("radio", { name: "5 quilos", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // The lightest plate: a bar takes a pair, a T-bar one — said pt-BR (singular below 2).
  const plates = gym.getByRole("radiogroup", { name: /^Menor anilha/ });
  await expect(plates.getByRole("radio", { name: "2,5 quilos", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(plates.getByRole("radio", { name: "1,25 quilo", exact: true })).toBeVisible();
  await expect(gym.locator("#gym-plate-desc")).toContainText("A barra e o leg press usam um par; cavalinho e cinto, uma.");
  await expect(gym.getByRole("radiogroup", { name: /^Kettlebell/ }).getByRole("radio", { name: "4 em 4", exact: true })).toHaveAttribute("aria-checked", "true");

  // A rack 2 kg apart all the way, 2,5 kg plates on the cables: the examples follow at once.
  // Retried: a tap before the page hydrates does nothing.
  await expect(async () => {
    await dumbbells.getByRole("radio", { name: "2 em 2", exact: true }).click();
    await expect(dumbbells.getByRole("radio", { name: "2 em 2", exact: true })).toHaveAttribute("aria-checked", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(gym.locator("#gym-dumbbells-desc")).toContainText(/12 → 14\skg/);
  await expect(gym.locator("#gym-dumbbells-desc")).not.toContainText("8 → 9");
  await cables.getByRole("radio", { name: "2,5 quilos", exact: true }).click();
  await expect(gym.locator("#gym-cable-desc")).toContainText(/20 → 22,5\skg/);
  await expect.poll(() => profileRow(userId, `"dumbbellScheme" || ',' || "cableStepKg"`), { timeout: 15_000 }).toBe("2,2.5");

  // Aparelhos — everything ticked (the gym has it) until the user unticks it.
  const count = gym.locator("[data-gear-missing-count]");
  await expect(count).toHaveText("Tem todos");
  const stations = gearGroup(page, "stations");
  await openGroup(stations);
  await setGear(page, stations.getByRole("checkbox", { name: "Graviton", exact: true }), false, "Falta 1");
  await expect(stations.locator("summary")).toContainText("falta 1");
  const legs = gearGroup(page, "legs");
  await openGroup(legs);
  await setGear(page, legs.getByRole("checkbox", { name: "Hack", exact: true }), false, "Faltam 2");
  await expect.poll(() => profileRow(userId, `array_to_string("missingGear", ',')`), { timeout: 15_000 }).toBe("assisted-pullup,hack-squat");
  // A phone's width with the groups open: nothing spills sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.reload();
  await expect(gym.getByRole("radiogroup", { name: /^Halteres/ }).getByRole("radio", { name: "2 em 2", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(gym.getByRole("radiogroup", { name: /^Polias/ }).getByRole("radio", { name: "2,5 quilos", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(gym.locator("[data-gear-missing-count]")).toHaveText("Faltam 2");
  // The groups that lack something come back open, showing what was unticked.
  await expect(gearGroup(page, "legs")).toHaveAttribute("open", "");
  await expect(gearGroup(page, "legs").getByRole("checkbox", { name: "Hack", exact: true })).not.toBeChecked();
  await expect(gearGroup(page, "legs").getByRole("checkbox", { name: "Leg press", exact: true })).toBeChecked();
  await expect(gearGroup(page, "stations").getByRole("checkbox", { name: "Graviton", exact: true })).not.toBeChecked();
  await expect(gearGroup(page, "cardio")).not.toHaveAttribute("open", "");
  // The rest of the gym is untouched.
  expect(profileRow(userId, `"stackStepKg" || ',' || "smallestPlateKg" || ',' || "kettlebellStepKg"`)).toBe("5,2.5,4");

  // A 320px phone: the chips wrap inside their cells and the rows inside the card — nothing spills sideways.
  await page.setViewportSize({ width: 320, height: 640 });
  await expect.poll(() => gym.evaluate((section) => section.scrollWidth - section.clientWidth)).toBeLessThanOrEqual(0);
});

test("a plan exercise on a machine the gym lacks is flagged with the way to adjust the plan, and clears when the machine is back", async ({
  page,
}) => {
  await newUserOnGd1(page, "gym-plan-notice");
  const userId = await userIdOf(page);
  const programId = sql(
    `SELECT "programId" FROM "ProgramEnrollment" WHERE "userId" = ${sqlText(userId)} AND status = 'ACTIVE' AND track = 'primary'`,
  );
  expect(programId).not.toBe("");
  await page.goto("/app/settings");
  const gym = gymSection(page);
  const notice = gym.locator("[data-gym-plan-notice]");
  await expect(gym.getByRole("heading", { level: 2, name: "Minha academia" })).toBeVisible();
  await expect(notice).toHaveCount(0);

  // GD 1's Tuesday opens on the hack squat: without a Hack, the plan can't be done as written.
  const legs = gearGroup(page, "legs");
  await openGroup(legs);
  await setGear(page, legs.getByRole("checkbox", { name: "Hack", exact: true }), false, "Falta 1");
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect(notice).toContainText("Seu plano usa 1 exercício com aparelhos que a sua academia não tem: Agachamento Hack.");
  const adjust = notice.getByRole("link", { name: "Ajustar à minha academia" });
  await expect(adjust).toHaveAttribute("href", `/app/programs/${programId}/academia`);

  // Still there after a reload: it's the saved gym, not the screen's.
  await page.reload();
  await expect(gym.locator("[data-gym-plan-notice]")).toContainText("Agachamento Hack");

  // The Hack back: the notice follows the latest save.
  await openGroup(gearGroup(page, "legs"));
  await setGear(page, gearGroup(page, "legs").getByRole("checkbox", { name: "Hack", exact: true }), true, "Tem todos");
  await expect(gym.locator("[data-gym-plan-notice]")).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(() => profileRow(userId, `array_to_string("missingGear", ',')`), { timeout: 15_000 }).toBe("");

  // A gym with no leg machines at all: one tap unticks the group, another ticks it back.
  const legGroup = gearGroup(page, "legs");
  const machines = await legGroup.getByRole("checkbox").count();
  await legGroup.getByRole("button", { name: "Desmarcar todos", exact: true }).click();
  await expect(gym.locator("[data-gear-missing-count]")).toHaveText(`Faltam ${machines}`);
  await expect(legGroup.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await expect(gym.locator("[data-gym-plan-notice]")).toBeVisible({ timeout: 15_000 });
  await legGroup.getByRole("button", { name: "Marcar todos", exact: true }).click();
  await expect(gym.locator("[data-gear-missing-count]")).toHaveText("Tem todos");
  await expect(gym.locator("[data-gym-plan-notice]")).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(() => profileRow(userId, `array_to_string("missingGear", ',')`), { timeout: 15_000 }).toBe("");
});
