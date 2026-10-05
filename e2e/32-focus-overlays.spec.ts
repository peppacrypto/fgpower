/**
 * Batch 7 — focus management & overlays on the core workout/builder flow
 * (A-029 scroll clearance, A-030 focus restore, A-031 rest-bar ring,
 * A-079 RIR focus trap, A-080 two-tap announcements), on a phone.
 */
import { execSync } from "node:child_process";
import { test, expect, devices, type Page } from "@playwright/test";
import { QUINTA, newUserOnGd1, recordSet, startDayFromToday } from "./workout-helpers";

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium", timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 120_000 });

const hasDb = (() => {
  try {
    return (
      execSync(`docker exec -i fgpower-postgres sh -c 'psql -U "$POSTGRES_USER" -d fgpower -At -c "SELECT 1"'`, {
        encoding: "utf8",
      }).trim() === "1"
    );
  } catch {
    return false;
  }
})();

/** The element the browser reports as focused, as an accessible label or tag. */
async function activeLabel(page: Page) {
  return page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a || a === document.body) return "<body>";
    return a.getAttribute("aria-label") ?? a.textContent?.trim() ?? a.tagName.toLowerCase();
  });
}

test.beforeEach(() => test.skip(!hasDb, "needs the local dev database"));

test("A-030: closing Finalizar restores focus to the 'Finalizar' trigger, not <body>", async ({ page }) => {
  await newUserOnGd1(page, "b7-finish-focus");
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10");

  const trigger = page.getByRole("button", { name: "Finalizar", exact: true });
  await trigger.focus();
  await trigger.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  // Focus moved INTO the dialog on open.
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Restored to the opener — the very next Tab must NOT run off the end of the page.
  await expect.poll(() => activeLabel(page)).toBe("Finalizar");
});

test("A-079: the 'O que é RIR?' sheet traps focus (Tab stays inside, Esc closes and restores)", async ({ page }) => {
  await newUserOnGd1(page, "b7-rir-trap");
  await startDayFromToday(page, QUINTA);

  const trigger = page.getByRole("button", { name: "O que é RIR?" }).first();
  await trigger.focus();
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog", { name: /RIR/ });
  await expect(dialog).toBeVisible();

  // Tab many times: focus never leaves the dialog (it used to walk into the workout behind).
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => activeLabel(page)).toBe("O que é RIR?");
});

test("A-031: the rest bar's focus ring colour differs from the bar background", async ({ page }) => {
  await newUserOnGd1(page, "b7-ring");
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10"); // starts the rest bar

  const plus = page.getByRole("button", { name: "Mais 15 segundos" });
  await expect(plus).toBeVisible();
  await plus.focus();
  const { outline, bar } = await plus.evaluate((el) => {
    const bar = el.closest("[data-rest-state]") as HTMLElement;
    return { outline: getComputedStyle(el).outlineColor, bar: getComputedStyle(bar).backgroundColor };
  });
  expect(outline).not.toBe(bar);
});

test("A-029: a focused control is never hidden under the rest bar", async ({ page }) => {
  await newUserOnGd1(page, "b7-scroll");
  await startDayFromToday(page, QUINTA);
  await recordSet(page, 1, "40", "10"); // rest bar up, covers the bottom of the screen

  // Focus the next set's kg box and assert its centre is the topmost element there
  // (not occluded by the fixed rest bar).
  const kg = page.getByRole("textbox", { name: "Série 2 — kg", exact: true });
  await kg.focus();
  await page.waitForTimeout(400); // allow the focus scroll to settle
  const onTop = await kg.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el.contains(hit) || el === hit;
  });
  expect(onTop).toBe(true);
});

test("A-080: arming 'Pular exercício' announces, and disarming announces too", async ({ page }) => {
  await newUserOnGd1(page, "b7-skip-announce");
  await startDayFromToday(page, QUINTA);

  const announcer = page.locator("[data-workout-announcer]");
  await page.getByRole("button", { name: "Pular exercício" }).click();
  await expect(page.getByRole("button", { name: "Confirmar pular?" })).toBeVisible();
  await expect(announcer).toContainText("Toque em pular de novo para confirmar");
  // After the 4 s window the button reverts and that is spoken too.
  await expect(page.getByRole("button", { name: "Pular exercício" })).toBeVisible({ timeout: 8_000 });
  await expect(announcer).toContainText("Pular cancelado");
});
