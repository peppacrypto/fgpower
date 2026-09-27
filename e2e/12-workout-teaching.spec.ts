import "dotenv/config";
import { test, expect, devices, type Locator, type Page, type Route } from "@playwright/test";
import pg from "pg";
import {
  QUINTA,
  expectSetSaved,
  finishAndSave,
  newUserOnGd1,
  newUserOnTemplate,
  openFinishSheet,
  openWarmups,
  setText,
  startDayFromToday,
  todayDayRow,
  waitForWorkoutScreen,
} from "./workout-helpers";

/*
 * A workout that teaches (Batch 2, cluster A): the first time on an exercise
 * says how to pick a load and only asks for it; from the second time the grey
 * numbers are the progression's verdict (not a copy of last week) with its
 * reason; "Último treino" says when and how hard; RIR is explained where it
 * is read; what the user wrote about injuries is echoed on their first
 * workouts; the machine note sits under the prescription; and finishing opens
 * the summary in one round trip.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
test.use({ ...iPhone, timezoneId: "America/Sao_Paulo", locale: "pt-BR" });
test.describe.configure({ timeout: 150_000 });

// Direct DB access only to seed what the UI can't (limitations text, earlier
// workouts) and to check what was saved — never production.
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(async () => {
  await db.end();
});

async function userIdOf(sessionId: string) {
  const { rows } = await db.query<{ userId: string }>(`select "userId" from "WorkoutSession" where id = $1`, [sessionId]);
  return rows[0].userId;
}

/** GD 1 Quinta's first exercise: 3 × 8–12, RIR 2,5, two warm-ups, double progression. */
const FIRST_EXERCISE = "Puxada Alta Unilateral no Pulley";

/** Escada Corporal (bodyweight only): Flexão de Braço first (3 × 8–15, RIR 2), Prancha sixth (3 × 20–45 s). */
const CALISTHENICS_A = "Sessão A — Fundamentos";

/** Escalada (climbers-pull): Pinça de Anilha, a loaded hold (3 × 20–30 s, RIR 1), is its fifth exercise. */
const CLIMBERS_A = "Sessão A — Puxada Pesada";

/** Steps through the workout with "Próximo exercício" until `name` is on screen. */
async function goToExercise(page: Page, name: string) {
  const heading = page.getByRole("heading", { level: 1 });
  for (let i = 0; i < 12 && (await heading.innerText()) !== name; i++) {
    await page.getByRole("button", { name: "Próximo exercício" }).first().click();
    await page.waitForTimeout(150);
  }
  await expect(heading).toHaveText(name);
}

/** A slow phone connection: the loading skeleton arrives well before the page. */
async function slowNetwork(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: 20 * 1024,
    uploadThroughput: 20 * 1024,
  });
  return () =>
    cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
}

/** Where an element's top sits in the page (not the viewport). */
async function pageTop(locator: Locator) {
  return locator.evaluate((el) => Math.round(el.getBoundingClientRect().top + scrollY));
}

test("first time on an exercise: how to pick the load, reps from the program, ✓ only asks for kg", async ({ page }) => {
  await newUserOnGd1(page, "teach-first");
  const sessionId = await startDayFromToday(page, QUINTA);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(FIRST_EXERCISE);

  const callout = page.locator("[data-first-time]");
  await expect(callout).toContainText("Primeiro treino");
  await expect(callout).toContainText("~12×");
  await expect(callout).toContainText("2–3 reps sobrando");
  // "(RIR 2,5)." is one piece: ")." never starts a line of its own on a narrow phone.
  await expect(callout.locator("span.whitespace-nowrap", { hasText: "(RIR 2,5)." })).toHaveCount(1);
  await expect(callout).toContainText("Na próxima vez, sugerimos a carga.");
  // No history: no "grey numbers from last time" hint pointing at nothing.
  await expect(page.getByText(/Números em cinza/)).toHaveCount(0);

  // The reps come from the prescription (top of 8–12); the load is the user's call.
  for (let n = 1; n <= 3; n++) {
    await expect(page.getByLabel(`Série ${n} — repetições`, { exact: true })).toHaveAttribute("placeholder", "12");
    await expect(page.getByLabel(`Série ${n} — kg`, { exact: true })).toHaveAttribute("placeholder", "");
  }

  // ✓ with nothing typed asks for the load only, and puts the cursor there.
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  await expect(page.getByText("Digite a carga (kg) que você usou.")).toBeVisible();
  const kg1 = page.getByLabel("Série 1 — kg", { exact: true });
  await expect(kg1).toBeFocused();
  await kg1.fill("35");
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  await expectSetSaved(page, "Série 1");
  await expect(page.getByLabel("Série 1 — repetições", { exact: true })).toHaveValue("12");
  const { rows } = await db.query<{ weightKg: number; reps: number }>(
    `select l."weightKg", l.reps from "SetLog" l join "WorkoutExerciseLog" e on e.id = l."exerciseLogId"
      where l."sessionId" = $1 and l."isCompleted" and e."sortOrder" = 0`,
    [sessionId],
  );
  expect(rows).toEqual([{ weightKg: 35, reps: 12 }]);
  // A first time's ✓ (reps from the program) doesn't count as having learned
  // the grey numbers: their explanation must still show when the progression's appear.
  expect(await page.evaluate(() => localStorage.getItem("fg:workout-pref:suggestions-used"))).toBeNull();

  // Warm-ups are optional and folded; opened, they ramp up to the load just typed.
  const warmups = page.getByRole("region", { name: "Aquecimento" });
  await expect(warmups).toContainText("opcional");
  await openWarmups(page);
  await expect(page.getByLabel("Aquecimento 1 — kg", { exact: true })).toHaveAttribute("placeholder", "17,5");
  await expect(page.getByLabel("Aquecimento 1 — repetições", { exact: true })).toHaveAttribute("placeholder", "8");
  await expect(page.getByLabel("Aquecimento 2 — kg", { exact: true })).toHaveAttribute("placeholder", "25");
  await expect(page.getByLabel("Aquecimento 2 — repetições", { exact: true })).toHaveAttribute("placeholder", "4");
  // The choice sticks on this device — already in the server's HTML, so the
  // rows don't jump open after the page loads.
  const html = await (await page.request.get(page.url())).text();
  expect(html).toContain('aria-label="Aquecimento 1 — kg"');
  await page.reload();
  await waitForWorkoutScreen(page);
  await expect(page.getByLabel("Aquecimento 1 — kg", { exact: true })).toBeVisible();
});

test("RIR is explained where it is read: the prescription and the RIR column open the 0–4 scale", async ({ page }) => {
  await newUserOnGd1(page, "teach-rir");
  await startDayFromToday(page, QUINTA);

  await page.getByRole("button", { name: "RIR 2,5", exact: true }).first().click();
  const sheet = page.getByRole("dialog", { name: "Quantas reps ainda sobrariam?" });
  await expect(sheet).toBeVisible();
  for (let r = 0; r <= 4; r++) await expect(sheet.getByText(`RIR ${r}`, { exact: true })).toBeVisible();
  // RIR 2,5: both 2 and 3 are the target.
  await expect(sheet.locator("li").filter({ hasText: "alvo" })).toHaveCount(2);
  await expect(sheet).toContainText("Alvo deste exercício: RIR 2,5");
  await expect(sheet.getByRole("link", { name: /Entenda o RIR/ })).toHaveAttribute("href", "/app/science/rir");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  await page.getByRole("button", { name: "O que é RIR?" }).first().click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(sheet).toHaveCount(0);
});

test("the second time: 'Último treino' with date and RIR, and the progression's load as the grey numbers", async ({
  page,
}) => {
  await newUserOnGd1(page, "teach-progress");
  await startDayFromToday(page, QUINTA);
  // 3 × 40 kg × 12 at RIR 2: the top of 8–12 at the target effort.
  for (let n = 1; n <= 3; n++) {
    await page.getByLabel(`Série ${n} — kg`, { exact: true }).fill("40");
    await page.getByLabel(`Série ${n} — repetições`, { exact: true }).fill("12");
    await page.getByLabel(`Série ${n} — RIR`, { exact: true }).fill("2");
    await page.getByRole("button", { name: `Concluir série ${n}`, exact: true }).click();
    await expectSetSaved(page, `Série ${n}`);
  }
  await finishAndSave(page);

  await page.goto("/app/today");
  const row = todayDayRow(page, QUINTA);
  await row.getByRole("button", { name: "Refazer" }).click();
  await Promise.all([
    page.waitForURL(/\/app\/workout\//, { timeout: 30_000 }),
    row.getByRole("button", { name: "Sim, treinar de novo" }).click(),
  ]);
  await waitForWorkoutScreen(page);

  const lastTime = page.locator("[data-last-time]");
  await expect(lastTime).toContainText(/Último treino · \d{2}\/\d{2} · hoje/i);
  await expect(lastTime).toContainText("× 12 · 12 · 12");
  await expect(lastTime).toContainText("RIR 2 · 2 · 2");
  const slug = await page.getByRole("link", { name: "Ver técnica" }).getAttribute("href");
  await expect(lastTime.getByRole("link").first()).toHaveAttribute("href", `${slug}/history`);

  // The engine's verdict, not a copy of last week.
  const advice = lastTime.locator("[data-advice]");
  await expect(advice).toHaveAttribute("data-advice", "increase");
  await expect(advice).toContainText("Suba para 42,5");
  await expect(advice).toContainText("12 reps em todas as séries");
  await expect(advice.getByRole("link", { name: "por quê?" })).toHaveAttribute("href", "/app/science/double-progression");
  for (let n = 1; n <= 3; n++) {
    await expect(page.getByLabel(`Série ${n} — kg`, { exact: true })).toHaveAttribute("placeholder", "42,5");
    await expect(page.getByLabel(`Série ${n} — repetições`, { exact: true })).toHaveAttribute("placeholder", "8");
  }
  // Warm-ups ramp to the suggested load (~50% × 8, ~70% × 4, on 2,5 kg steps).
  await expect(page.getByRole("region", { name: "Aquecimento" })).toContainText(/~22,5\s?kg × 8 · ~30\s?kg × 4/);

  // The grey numbers are explained until they have been used a few times…
  await expect(page.getByText(/Números em cinza/)).toBeVisible();
  for (let n = 1; n <= 3; n++) {
    await page.getByRole("button", { name: `Concluir série ${n}`, exact: true }).click();
    await expectSetSaved(page, `Série ${n}`);
  }
  await expect(page.getByLabel("Série 1 — kg", { exact: true })).toHaveValue("42,5");
  await expect(page.getByLabel("Série 1 — repetições", { exact: true })).toHaveValue("8");
  // …then fold into an (i) — on the next screen, never under the finger.
  await expect(page.getByText(/Números em cinza/)).toBeVisible();
  await page.reload();
  await waitForWorkoutScreen(page);
  // (The reload lands on the next exercise still to do: back to this one.)
  await page.getByRole("button", { name: "Exercício anterior" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(FIRST_EXERCISE);
  await expect(page.getByText(/Números em cinza/)).toHaveCount(0);
  await page.getByRole("button", { name: "Como funcionam os números em cinza" }).click();
  await expect(page.getByText(/Números em cinza/)).toBeVisible();
});

test("what the user wrote about injuries is echoed on their first workouts, and can be closed", async ({ page }) => {
  await newUserOnGd1(page, "teach-limits");
  const sessionId = await startDayFromToday(page, QUINTA);
  const userId = await userIdOf(sessionId);
  await db.query(`update "Profile" set limitations = $2 where "userId" = $1`, [
    userId,
    "Evitar agachamento profundo por causa do joelho",
  ]);
  await page.reload();
  await waitForWorkoutScreen(page);
  const echo = page.getByText("Você informou");
  await expect(echo).toBeVisible();
  await expect(page.getByText("“Evitar agachamento profundo por causa do joelho”")).toBeVisible();
  await expect(page.getByText(/use Pular exercício ou fale com um profissional/)).toBeVisible();
  // It doesn't push the first set below the fold.
  const viewport = page.viewportSize()!;
  const kg1 = await page.getByLabel("Série 1 — kg", { exact: true }).boundingBox();
  expect(kg1!.y + kg1!.height).toBeLessThanOrEqual(viewport.height);

  // On the other exercises: a one-line reminder that opens in full.
  await page.getByRole("button", { name: "Próximo exercício" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(FIRST_EXERCISE);
  await expect(page.getByText(/use Pular exercício/)).toHaveCount(0);
  await page.locator("[data-limitations]").getByRole("button", { name: /Você informou/ }).click();
  await expect(page.getByText(/use Pular exercício ou fale com um profissional/)).toBeVisible();
  await page.getByRole("button", { name: "Exercício anterior" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(FIRST_EXERCISE);

  await page.getByRole("button", { name: "Fechar o que você informou" }).click();
  await expect(echo).toHaveCount(0);
  await page.reload();
  await waitForWorkoutScreen(page);
  await expect(echo).toHaveCount(0);

  // After three finished workouts it is no longer repeated.
  await db.query(`update "WorkoutSession" set status = 'DISCARDED' where id = $1`, [sessionId]);
  for (let i = 0; i < 3; i++) {
    await db.query(
      `insert into "WorkoutSession" (id, "userId", name, status, "startedAt", "finishedAt", "updatedAt")
       values ($1, $2, 'Antigo', 'COMPLETED', now() - interval '3 days', now() - interval '3 days', now())`,
      [`teach-limits-${Date.now()}-${i}`, userId],
    );
  }
  const next = await startDayFromToday(page, QUINTA);
  expect(next).not.toBe(sessionId);
  await expect(page.getByText("Você informou")).toHaveCount(0);
});

test("the workout skeleton keeps room for the 'Você informou' note, so the sets don't jump when the workout is continued or reloaded", async ({
  page,
}) => {
  await newUserOnGd1(page, "teach-limits-skeleton");
  const sessionId = await startDayFromToday(page, QUINTA);
  await db.query(`update "Profile" set limitations = $2 where "userId" = $1`, [
    await userIdOf(sessionId),
    "Evitar agachamento profundo por causa do joelho",
  ]);
  await page.reload();
  await waitForWorkoutScreen(page);
  const echo = page.locator("[data-limitations]");
  await expect(echo).toBeVisible();
  // The note with its margin: two to four lines on a phone, well past the skeleton's tolerance.
  const echoPx = await echo.evaluate((el) => el.getBoundingClientRect().height + parseFloat(getComputedStyle(el).marginBottom));
  expect(echoPx).toBeGreaterThan(40);
  const realTop = await pageTop(page.getByLabel("Série 1 — kg", { exact: true }));

  // Back on Today, "Continuar" opens it again (a client-side navigation) on a slow connection.
  await page.goto("/app/today");
  await page.waitForLoadState("networkidle");
  const fast = await slowNetwork(page);
  await page.locator(`a[href="/app/workout/${sessionId}"]`).first().click();
  const skeleton = page.locator('[data-skeleton="o treino"]');
  await expect(skeleton).toBeVisible({ timeout: 20_000 });
  // The same room as the note, so the kg column lands where the real one is
  // (the tolerance of the plain skeleton, e2e/16: the note alone exceeds it).
  const room = skeleton.locator("[data-limitations-bone]");
  await expect(room).toBeVisible();
  const roomPx = await room.evaluate((el) => el.getBoundingClientRect().height + parseFloat(getComputedStyle(el).marginBottom));
  expect(Math.abs(roomPx - echoPx)).toBeLessThanOrEqual(2);
  const boneTop = await pageTop(skeleton.locator("[data-bone-row] .sk").first());
  expect(Math.abs(boneTop - realTop)).toBeLessThanOrEqual(40);
  await fast();
  await expect(page.getByLabel("Série 1 — kg", { exact: true })).toBeVisible({ timeout: 30_000 });

  // A reload (a restored or discarded tab) streams the server's skeleton, drawn
  // before any script runs: it keeps the room too, from this device's cookie.
  const slowAgain = await slowNetwork(page);
  const reload = page.reload({ waitUntil: "commit" }).catch(() => {});
  await expect(skeleton.locator("[data-limitations-bone]")).toBeVisible({ timeout: 20_000 });
  // (Polled: until the stylesheet arrives, the bones stand anywhere.)
  await expect
    .poll(
      async () => Math.abs((await pageTop(skeleton.locator("[data-bone-row] .sk").first()).catch(() => Infinity)) - realTop),
      { timeout: 20_000 },
    )
    .toBeLessThanOrEqual(40);
  await reload;
  await slowAgain();
  await expect(page.getByLabel("Série 1 — kg", { exact: true })).toBeVisible({ timeout: 30_000 });

  // Closed for this workout: the skeleton no longer keeps room for it.
  await page.getByRole("button", { name: "Fechar o que você informou" }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("fg:workout-pref:limitations-echo-px")))
    .toBeNull();
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "fg-wl")).toBe(false);
});

test("bodyweight exercises: ✓ needs only the reps, a plank counts seconds, and no set reads '0 kg ×'", async ({ page }) => {
  await newUserOnTemplate(page, "teach-bodyweight", "calisthenics");
  const sessionId = await startDayFromToday(page, CALISTHENICS_A);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Flexão de Braço");

  // No load to pick: the first time asks for reps, and kg only for extra load.
  const callout = page.locator("[data-first-time]");
  await expect(callout).toContainText("Faça ~15 reps com ~2 sobrando (RIR 2)");
  await expect(callout).toContainText("kg só se usar carga extra");
  await expect(callout).not.toContainText("Escolha uma carga");
  await expect(page.getByLabel("Série 1 — kg", { exact: true })).toHaveAttribute("placeholder", "0");
  await expect(page.getByLabel("Série 1 — repetições", { exact: true })).toHaveAttribute("placeholder", "15");

  // ✓ with nothing typed logs the grey reps with no extra load — no "Digite a carga".
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  await expectSetSaved(page, "Série 1");
  await expect(page.getByText("Digite a carga (kg) que você usou.")).toHaveCount(0);
  // Reps typed and kg left empty: a whole set, never flagged as missing its load.
  await page.getByLabel("Série 2 — repetições", { exact: true }).fill("10");
  await expect(page.getByLabel("Série 2 — kg", { exact: true })).not.toHaveClass(/border-warning/);
  await page.getByRole("button", { name: "Concluir série 2", exact: true }).click();
  await expectSetSaved(page, "Série 2");

  // The plank: its numbers are seconds.
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Próximo exercício" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prancha");
  await expect(page.getByText(/^3 séries\s×\s20–45\ss$/)).toBeVisible();
  await expect(page.locator("[data-first-time]")).toContainText("Segure ~45 s sem perder a posição");
  await expect(page.getByLabel("Série 1 — segundos", { exact: true })).toHaveAttribute("placeholder", "45");
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  await expectSetSaved(page, "Série 1");
  await page.getByLabel("Série 2 — segundos", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Concluir série 2", exact: true }).click();
  await expectSetSaved(page, "Série 2");

  const { rows } = await db.query<{ sortOrder: number; weightKg: number; reps: number }>(
    `select e."sortOrder", l."weightKg", l.reps from "SetLog" l join "WorkoutExerciseLog" e on e.id = l."exerciseLogId"
      where l."sessionId" = $1 and l."isCompleted" order by e."sortOrder", l."setNumber"`,
    [sessionId],
  );
  expect(rows).toEqual([
    { sortOrder: 0, weightKg: 0, reps: 15 },
    { sortOrder: 0, weightKg: 0, reps: 10 },
    { sortOrder: 5, weightKg: 0, reps: 45 },
    { sortOrder: 5, weightKg: 0, reps: 40 },
  ]);

  // The summary drops the "0 kg": reps for push-ups, seconds for the plank.
  await finishAndSave(page);
  // No load anywhere: next time measures against today's reps and times, it doesn't suggest loads.
  await expect(page.getByText(/^Primeira sessão registrada\. Na próxima, suas reps e tempos de hoje viram a\sreferência\.$/)).toBeVisible();
  await expect(page.getByText(/sugerimos suas cargas/)).toHaveCount(0);
  const pushups = page.locator(".reg-frame").filter({ hasText: "Flexão de Braço" });
  await expect(pushups.getByText(/^×\s15$/)).toBeVisible();
  await expect(pushups.getByText(/^×\s10$/)).toBeVisible();
  await expect(pushups).not.toContainText("kg");
  const plank = page.locator(".reg-frame").filter({ hasText: "Prancha" });
  await expect(plank.getByText(/^45\ss$/)).toBeVisible();
  await expect(plank).not.toContainText("kg");

  // The exercise's history counts time, not a flat 0 kg.
  await page.goto("/app/exercises/plank/history");
  await expect(page.getByText("Maior tempo", { exact: true })).toBeVisible();
  await expect(page.getByText("Maior tempo por sessão")).toBeVisible();
  await expect(page.getByText("Melhor carga por sessão")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("kg");
});

test("a loaded hold (Pinça de Anilha) speaks seconds everywhere: callout, advice, summary, records and history", async ({ page }) => {
  await newUserOnTemplate(page, "teach-pinch", "climbers-pull");
  const first = await startDayFromToday(page, CLIMBERS_A);
  await goToExercise(page, "Pinça de Anilha");
  await expect(page.getByText(/^3 séries\s×\s20–30\ss$/)).toBeVisible();
  const callout = page.locator("[data-first-time]");
  await expect(callout).toContainText("Escolha uma carga que você seguraria ~30\u00a0s sem chegar ao limite.");
  await expect(callout).not.toContainText("×");
  for (const [n, secs] of [[1, "28"], [2, "25"], [3, "22"]] as const) {
    await page.getByLabel(`Série ${n} — kg`, { exact: true }).fill("10");
    await page.getByLabel(`Série ${n} — segundos`, { exact: true }).fill(secs);
    await page.getByLabel(`Série ${n} — RIR`, { exact: true }).fill("1");
    await page.getByRole("button", { name: `Concluir série ${n}`, exact: true }).click();
    await expectSetSaved(page, `Série ${n}`);
  }
  await finishAndSave(page);
  const card = page.locator(".reg-frame").filter({ hasText: "Pinça de Anilha" });
  await expect(card.getByText(/^10\skg × 28\ss$/)).toBeVisible();
  await expect(card).toContainText("Mantenha 10 kg · segure 23\u00a0s");
  await expect(card).toContainText("Suba a carga quando segurar 30\u00a0s em todas");
  await expect(card).not.toContainText("reps");

  // A week later: the same advice on the workout screen, then a time record.
  await db.query(
    `update "WorkoutSession" set "startedAt" = "startedAt" - interval '7 days', "finishedAt" = "finishedAt" - interval '7 days' where id = $1`,
    [first],
  );
  await page.goto("/app/today");
  const row = todayDayRow(page, CLIMBERS_A);
  const start = row.getByRole("button", { name: "Iniciar" });
  if (await start.count()) await start.click();
  else {
    await row.getByRole("button", { name: "Refazer" }).click();
    await row.getByRole("button", { name: "Sim, treinar de novo" }).click();
  }
  await waitForWorkoutScreen(page);
  await goToExercise(page, "Pinça de Anilha");
  const last = page.locator("[data-last-time]");
  await expect(last).toContainText(/10\skg × 28 · 25 · 22\ss/);
  await expect(last).toContainText("Mantenha 10 kg · segure 23\u00a0s");
  for (const n of [1, 2, 3]) {
    await page.getByLabel(`Série ${n} — kg`, { exact: true }).fill("10");
    await page.getByLabel(`Série ${n} — segundos`, { exact: true }).fill("30");
    await page.getByRole("button", { name: `Concluir série ${n}`, exact: true }).click();
    await expectSetSaved(page, `Série ${n}`);
  }
  await finishAndSave(page);
  await expect(page.locator("a").filter({ hasText: "PR" }).filter({ hasText: "Pinça de Anilha" })).toContainText("30\u00a0s com 10 kg");
  await expect(page.locator(".reg-frame").filter({ hasText: "Pinça de Anilha" })).toContainText(/10\skg × 28, 25, 22\ss/);

  await page.goto("/app/exercises/plate-pinch/history");
  await expect(page.getByText("Último recorde de tempo")).toBeVisible();
  await expect(page.getByText("Tempo com a maior carga")).toBeVisible();
  await expect(page.getByText("Melhor 1RM est.")).toHaveCount(0);
  await expect(page.getByText("1RM estimado")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("reps");
});

test("finishing opens the summary in one round trip; until the server confirms it, this device keeps everything", async ({
  page,
  context,
}) => {
  await newUserOnGd1(page, "teach-finish");
  const sessionId = await startDayFromToday(page, QUINTA);
  const mirror = () => page.evaluate((id) => localStorage.getItem(`fg:workout-drafts:${id}`) ?? "", sessionId);
  await page.getByLabel("Série 1 — kg", { exact: true }).fill("40");
  await page.getByLabel("Série 1 — repetições", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  await expectSetSaved(page, "Série 1");

  // Without connection: typed rows stay, on screen and in the local copy.
  await context.setOffline(true);
  await page.getByLabel("Série 2 — kg", { exact: true }).fill("42,5");
  await page.getByLabel("Série 2 — repetições", { exact: true }).fill("9");
  const dialog = await openFinishSheet(page);
  await dialog.getByRole("button", { name: "Finalizar e salvar" }).click();
  await expect(dialog.getByText(/Não foi possível finalizar/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Série 2 — kg", { exact: true })).toHaveValue("42,5");
  expect(await mirror()).toContain('"42,5"');

  // Back online, but a gym connection: set 2 can't get through and the finish
  // hangs. While it does, nothing leaves this device — the app may be closed
  // or reclaimed before the server ever sees the finish.
  const abortSets = (route: Route) => route.abort();
  await page.route("**/api/workout/sets", abortSets);
  const held: Route[] = [];
  const holdFinish = (route: Route) => {
    if (route.request().method() === "POST") held.push(route);
    else void route.continue();
  };
  const screenUrl = (url: URL) => url.pathname === `/app/workout/${sessionId}`;
  await page.route(screenUrl, holdFinish);
  await context.setOffline(false);
  await dialog.getByRole("button", { name: "Finalizar e salvar" }).click();
  await expect.poll(() => held.length, { timeout: 15_000 }).toBe(1);
  await expect(dialog.getByRole("button", { name: "Salvando…" })).toBeVisible();
  expect(await mirror()).toContain('"42,5"');
  expect(await mirror()).toContain('"dirty":true');
  // The request dies: the finish didn't happen, and everything is still here.
  await held[0].abort("connectionreset");
  await expect(dialog.getByText(/Não foi possível finalizar/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Série 2 — kg", { exact: true })).toHaveValue("42,5");
  expect(await mirror()).toContain('"42,5"');
  await page.unroute(screenUrl, holdFinish);
  await page.unroute("**/api/workout/sets", abortSets);

  // Back online: the summary comes in the finish action's own response — a
  // separate fetch of it is never answered here, and no page load happens.
  await page.route(/\/summary\?_rsc=/, () => {});
  const documents: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "document") documents.push(r.url());
  });
  await Promise.all([
    page.waitForURL(/\/app\/workout\/[^/]+\/summary/, { timeout: 30_000 }),
    dialog.getByRole("button", { name: "Finalizar e salvar" }).click(),
  ]);
  await expect(page.getByText("Treino concluído")).toBeVisible();
  expect(documents).toEqual([]);
  await page.unroute(/\/summary\?_rsc=/);
  await expect(page.getByText(/2 séries de trabalho/)).toBeVisible();
  await expect(page.getByText(setText("42,5", 9))).toBeVisible();
  // Nothing of the finished workout is left on the device.
  const left = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("fg:workout-drafts:") || k.startsWith("fg:rest:")),
  );
  expect(left).toEqual([]);
});

