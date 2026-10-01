/**
 * Regenerates the install screenshots, public/icons/screenshots/{today,
 * workout,summary}.png: 780×1688 (a 390×844 phone at 2×, light theme), as
 * src/app/manifest.ts declares them. The landing's "O app" figures show them
 * too. Run it against a dev server whose database is the local one in .env:
 *
 *   node scripts/make-pwa-screenshots.mjs [--base-url=http://localhost:3000] [--out=public/icons/screenshots]
 *
 * Run it Tuesday to Friday, São Paulo time (Tuesday reads best). The demo's
 * week then has its days before today done, all but the plan's Tuesday (a
 * superset day), which is up next. On a Monday nothing of the week is done
 * yet, and Saturday and Sunday are rest days. Run it between 00:40 and 23:45
 * too: the demo's workout starts 38 minutes back and must start and end on
 * the same day (it refuses otherwise).
 *
 * Each run makes a new demo account, "Marina Duarte", and three followers: no
 * real people and no personal data. All four are tagged by their e-mail,
 * pwa-demo-…@fgpower.dev, and each run first deletes the ones an earlier run
 * left (their workouts, posts and follows go with them). The script:
 * 1. signs in through the dev-only /api/test/login, walks the onboarding
 *    wizard and activates GD 1 from its page, as a new user would;
 * 2. writes the two weeks before this one, and this week's earlier days,
 *    straight to the database, as finished workouts leave them: this week is
 *    week 3 of the block, with loads going up. Three people follow her;
 * 3. Today, the next workout one tap away → today.png;
 * 4. starts it from Today's "Iniciar treino" (from its row on the program's
 *    page when Today suggests another day). The first three exercises go
 *    in through the workout screen's own set endpoint, then a round of the
 *    superset is done on screen: ✓, the switch, ✓, and the round's rest
 *    counting → workout.png;
 * 5. finishes it in the app and answers the check-in → summary.png, with the
 *    check-in, "Quem vê" and the records.
 * The dev tools badge is hidden. The PNGs are palette-quantized with sharp
 * (dev dependency), about 50 KB each, and written together once all three
 * are shot: a run that fails halfway leaves the old ones in place.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";
import dotenv from "dotenv";
import pg from "pg";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE_URL = arg("base-url", process.env.BASE_URL ?? "http://localhost:3000");
const OUT = resolve(root, arg("out", "public/icons/screenshots"));
const LOCAL = ["localhost", "127.0.0.1", "[::1]"];

dotenv.config({ path: join(root, ".env"), quiet: true });
const dbUrl = new URL(process.env.DATABASE_URL ?? "postgres://missing");
if (!LOCAL.includes(dbUrl.hostname) || !LOCAL.includes(new URL(BASE_URL).hostname)) {
  console.error(`Local only: the database (${dbUrl.hostname}) and --base-url (${BASE_URL}) must be on this machine.`);
  process.exit(1);
}
dbUrl.searchParams.delete("schema");

/** The demo's loads per exercise (by slug): kg in weeks 1, 2 and 3, and the reps of each set. */
const HISTORY = {
  // Segunda — Superior (pesado)
  "barbell-bench-press-medium-grip": { kg: [40, 42.5, 42.5], reps: [[8, 8, 7, 7], [8, 7, 7, 6], [8, 8, 7, 7]] },
  "lying-t-bar-row": { kg: [30, 32.5, 32.5], reps: [[8, 8, 7], [8, 7, 7], [8, 8, 8]] },
  "wide-grip-lat-pulldown": { kg: [35, 37.5, 37.5], reps: [[12, 10], [11, 10], [12, 11]] },
  "seated-dumbbell-press": { kg: [12, 12, 14], reps: [[10, 9, 8], [10, 10, 9], [8, 8, 7]] },
  "side-lateral-raise": { kg: [6, 6, 6], reps: [[16, 15, 14], [18, 16, 15], [20, 18, 16]] },
  "cable-rope-overhead-triceps-extension": { kg: [15, 17.5, 17.5], reps: [[14, 12], [12, 11], [14, 12]] },
  // Terça — Inferior (quadríceps, pesado); week 3 is done in the app (TODAY)
  "hack-squat": { kg: [60, 65], reps: [[8, 8, 7, 7], [8, 7, 7, 6]] },
  "leg-extensions": { kg: [45, 50], reps: [[14, 12], [13, 12]] },
  "seated-leg-curl": { kg: [35, 37.5], reps: [[12, 11, 10], [12, 10, 10]] },
  "face-pull": { kg: [15, 17.5], reps: [[18, 16], [17, 15]] },
  "standing-calf-raises": { kg: [40, 45], reps: [[15, 14, 13, 12], [14, 13, 12, 12]] },
  "hanging-leg-raise": { kg: [0, 0], reps: [[10, 9, 8], [12, 10, 9]] },
  // Quarta — Empurrar (moderado)
  "incline-dumbbell-press": { kg: [14, 16, 16], reps: [[12, 11, 10], [10, 10, 9], [11, 10, 10]] },
  butterfly: { kg: [30, 32.5, 32.5], reps: [[16, 15, 14], [16, 15, 14], [18, 16, 15]] },
  "cable-seated-lateral-raise": { kg: [5, 5, 5], reps: [[20, 18, 16], [22, 20, 18], [24, 22, 20]] },
  "standing-low-pulley-one-arm-triceps-extension": { kg: [7.5, 7.5, 10], reps: [[14, 12], [15, 13], [12, 11]] },
  "triceps-pushdown-rope-attachment": { kg: [20, 22.5, 22.5], reps: [[16, 14], [15, 14], [17, 15]] },
  // Quinta — Puxar (moderado)
  "one-arm-lat-pulldown": { kg: [20, 22.5, 22.5], reps: [[12, 11, 10], [11, 10, 10], [12, 11, 11]] },
  "seated-cable-rows": { kg: [40, 42.5, 42.5], reps: [[12, 11], [12, 10], [12, 12]] },
  "reverse-machine-flyes": { kg: [20, 22.5, 22.5], reps: [[18, 16], [17, 16], [19, 17]] },
  "incline-dumbbell-curl": { kg: [8, 8, 10], reps: [[12, 10], [12, 11], [9, 8]] },
  "machine-preacher-curls": { kg: [20, 22.5, 22.5], reps: [[15, 13], [14, 13], [16, 14]] },
  "cable-crunch": { kg: [25, 27.5, 27.5], reps: [[18, 16, 15], [18, 16, 15], [20, 18, 16]] },
  // Sexta — Pernas (posterior de coxa e glúteos)
  "romanian-deadlift": { kg: [50, 55, 55], reps: [[8, 8, 7], [8, 7, 7], [8, 8, 8]] },
  "barbell-hip-thrust": { kg: [70, 80, 80], reps: [[12, 11, 10], [11, 10, 10], [12, 11, 11]] },
  "leg-press": { kg: [120, 130, 130], reps: [[15, 13], [14, 13], [15, 14]] },
  "lying-leg-curls": { kg: [30, 32.5, 32.5], reps: [[14, 12], [13, 12], [15, 13]] },
  "calf-press-on-the-leg-press-machine": { kg: [60, 70, 70], reps: [[18, 16, 15, 14], [16, 15, 15, 14], [18, 17, 16, 15]] },
};
/** Sexta's leg extensions and lateral raises are lighter than the same lifts on other days. */
const FRIDAY = {
  "leg-extensions": { kg: [40, 42.5, 42.5], reps: [[18, 16], [17, 15], [19, 17]] },
  "side-lateral-raise": { kg: [5, 5, 5], reps: [[22, 20], [24, 22], [25, 23]] },
};
/** This week's Tuesday, done in the app: heavier than last week's (records on the summary). */
const TODAY = {
  "hack-squat": { kg: 70, reps: [7, 6, 6, 6] },
  "leg-extensions": { kg: 50, reps: [15, 13] },
  "seated-leg-curl": { kg: 40, reps: [11, 10, 9] },
  "face-pull": { kg: 17.5, reps: [18, 16] },
  "standing-calf-raises": { kg: 45, reps: [15, 14, 13, 13] },
  "hanging-leg-raise": { kg: 0, reps: [12, 11, 10] },
};
/** The plan's Tuesday: the superset day the screenshots train. */
const TARGET_DAY = 1;
const DEMO_NAME = "Marina Duarte";
/** The tag on every account the script makes (a LIKE pattern): the demo and her followers. */
const DEMO_EMAILS = "pwa-demo-%@fgpower.dev";
/** The check-in's weight (it goes to Corpo too); a note would push the records under the nav. */
const DEMO_WEIGHT = "64,5";
const FOLLOWERS = ["Bia Teixeira", "Caio Nunes", "Lara Pires"];
const ZONE = "America/Sao_Paulo";

const cuid = () => `c${randomBytes(15).toString("hex").slice(0, 24)}`;
/** A timestamp column's value: the app stores UTC in `timestamp without time zone`. */
const ts = (date) => date.toISOString().replace("Z", "");

/** The wall clock in São Paulo at `date`. */
function wall(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute, weekday };
}

/** The instant of a São Paulo wall-clock time (`day` may run past the month's end). */
function spTime(year, month, day, hour, minute) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const w = wall(new Date(guess));
  const offset = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) - guess;
  return new Date(guess - offset);
}

const now = new Date();
const today = wall(now);
/** Days since Monday (Monday 0 … Sunday 6). */
const todayOffset = (today.weekday + 6) % 7;
/** A São Paulo wall-clock time, `days` from this week's Monday. */
const onWeekDay = (days, hour, minute) => spTime(today.year, today.month, today.day - todayOffset + days, hour, minute);

if (todayOffset === 0 || todayOffset >= 5) {
  console.warn("Warning: best run Tuesday to Friday (São Paulo). Today shows day 1 on a Monday, and a rest day on weekends.");
}
// Near midnight the workout would start in the future (a 0:00 clock, no duration on the summary) or end tomorrow.
const minutesIntoDay = today.hour * 60 + today.minute;
if (minutesIntoDay < 40 || minutesIntoDay >= 23 * 60 + 45) {
  console.error("Run it between 00:40 and 23:45 (São Paulo): the demo's workout starts 38 minutes back and must end the same day.");
  process.exit(1);
}

const db = new pg.Client({ connectionString: dbUrl.toString() });
await db.connect();
const one = async (query, params) => (await db.query(query, params)).rows[0];
const all = async (query, params) => (await db.query(query, params)).rows;
// Earlier runs' demo accounts: everything of theirs cascades from "user".
const { rowCount: cleared } = await db.query(`DELETE FROM "user" WHERE email LIKE $1`, [DEMO_EMAILS]);
if (cleared) console.log(`Removed ${cleared} demo accounts left by earlier runs.`);

/** today/workout/summary.png as they are shot; written to OUT together at the end. */
const shots = new Map();
const browser = await chromium.launch();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...iPhone } = devices["iPhone 13"];
const context = await browser.newContext({
  ...iPhone,
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: "light",
  locale: "pt-BR",
  timezoneId: ZONE,
  baseURL: BASE_URL,
});
// The screenshots are of the installed app: no "add to home screen" card.
await context.addInitScript(() => {
  try {
    localStorage.setItem("fg:install-card", "installed");
  } catch {
    // storage blocked: the card may show
  }
});
const page = await context.newPage();
page.setDefaultTimeout(30_000);

try {
  // 1. A new user: sign in, onboarding, GD 1.
  const run = Date.now().toString(36);
  const email = `pwa-demo-${run}@fgpower.dev`;
  const login = await page.request.post("/api/test/login", { data: { email, name: DEMO_NAME } });
  if (!login.ok()) throw new Error(`/api/test/login answered ${login.status()}: is this a dev server?`);
  await page.goto("/onboarding");
  await page.getByLabel("Nome de exibição").fill(DEMO_NAME);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radio", { name: /^Hipertrofia/ }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radio", { name: /^Intermediário/ }).check();
  await page.getByLabel("Dias por semana").selectOption("5");
  await page.getByRole("button", { name: "Continuar" }).click();
  await Promise.all([page.waitForURL(/\/app\/today/), page.getByRole("button", { name: "Ver meu plano" }).click()]);
  await page.goto("/app/programs/templates/gd-1");
  await Promise.all([page.waitForURL(/\/app\/today/), page.getByRole("button", { name: "Ativar programa" }).first().click()]);

  // 2. The weeks before, as finished workouts.
  const { id: userId } = await one(`SELECT id FROM "user" WHERE email = $1`, [email]);
  const enrollment = await one(`SELECT id, "programId" FROM "ProgramEnrollment" WHERE "userId" = $1 AND status = 'ACTIVE'`, [userId]);
  const days = await all(`SELECT id, "dayIndex", name, weekday FROM "UserProgramDay" WHERE "programId" = $1 ORDER BY "dayIndex"`, [
    enrollment.programId,
  ]);
  const exercises = await all(
    `SELECT e.*, x.slug FROM "UserProgramExercise" e JOIN "Exercise" x ON x.id = e."exerciseId"
     WHERE e."dayId" = ANY($1) ORDER BY e."sortOrder"`,
    [days.map((d) => d.id)],
  );
  const target = days.find((d) => d.dayIndex === TARGET_DAY);
  const unknown = exercises.filter((e) => e.dayId === target?.id && !TODAY[e.slug]).map((e) => e.slug);
  if (!target || unknown.length > 0 || !TODAY["face-pull"] || !TODAY["standing-calf-raises"]) {
    throw new Error(`GD 1's ${target?.name ?? "Tuesday"} changed (${unknown.join(", ")}): update TODAY and the superset steps.`);
  }
  const dayOffset = (d) => ((d.weekday ?? d.dayIndex + 1) + 6) % 7;
  const history = [];
  for (const week of [1, 2]) for (const day of days) history.push({ week, day, date: -7 * (3 - week) + dayOffset(day) });
  for (const day of days) if (day !== target && dayOffset(day) < todayOffset) history.push({ week: 3, day, date: dayOffset(day) });

  const activated = onWeekDay(-14, 7, 55);
  await db.query("BEGIN");
  for (const [n, { week, day, date }] of history.entries()) {
    const startedAt = onWeekDay(date, 18, 20 + ((n * 7) % 25));
    const sessionId = cuid();
    const sets = [];
    let clock = startedAt.getTime() + 6 * 60_000;
    const logs = exercises.filter((e) => e.dayId === day.id);
    const logRows = logs.map((ex) => {
      const plan = (day.dayIndex === 4 && FRIDAY[ex.slug]) || HISTORY[ex.slug] || { kg: [20, 20, 22.5], reps: [[ex.repMax - 2]] };
      const kg = plan.kg[Math.min(week, plan.kg.length) - 1];
      const reps = plan.reps[Math.min(week, plan.reps.length) - 1];
      const logId = cuid();
      for (let i = 0; i < ex.warmupSets; i++) sets.push({ logId, ex, n: i + 1, type: "WARMUP", kg: null, reps: null, at: null });
      for (let i = 0; i < ex.sets; i++) {
        clock += (i === 0 ? 90 : ex.restSeconds + 45) * 1000;
        sets.push({ logId, ex, n: ex.warmupSets + i + 1, type: "WORKING", kg, reps: reps[i] ?? reps[reps.length - 1], at: new Date(clock) });
      }
      return { logId, ex };
    });
    const finishedAt = new Date(clock + 3 * 60_000);
    const working = sets.filter((s) => s.type === "WORKING");
    await db.query(
      `INSERT INTO "WorkoutSession" (id, "userId", "enrollmentId", "programId", "programDayId", name, status, "startedAt", "finishedAt",
         "durationSeconds", "programWeek", "programDayIndex", "totalVolumeKg", "totalWorkingSets", "totalReps", visibility, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'COMPLETED', $7, $8, $9, $10, $11, $12, $13, $14, 'FOLLOWERS', $7, $8)`,
      [
        sessionId,
        userId,
        enrollment.id,
        enrollment.programId,
        day.id,
        day.name,
        ts(startedAt),
        ts(finishedAt),
        Math.round((finishedAt - startedAt) / 1000),
        week,
        day.dayIndex,
        Math.round(working.reduce((sum, s) => sum + s.kg * s.reps, 0) * 10) / 10,
        working.length,
        working.reduce((sum, s) => sum + s.reps, 0),
      ],
    );
    for (const { logId, ex } of logRows) {
      await db.query(
        `INSERT INTO "WorkoutExerciseLog" (id, "sessionId", "userId", "exerciseId", "programExerciseId", "sortOrder", "groupKey", "prescribedSets",
           "repMin", "repMax", "rirTarget", "rpeTarget", "restSeconds", "warmupSets", tempo, notes, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          logId,
          sessionId,
          userId,
          ex.exerciseId,
          ex.id,
          ex.sortOrder,
          ex.groupKey,
          ex.sets,
          ex.repMin,
          ex.repMax,
          ex.rirTarget,
          ex.rpeTarget,
          ex.restSeconds,
          ex.warmupSets,
          ex.tempo,
          ex.notes,
          ts(startedAt),
        ],
      );
    }
    for (const s of sets) {
      await db.query(
        `INSERT INTO "SetLog" (id, "userId", "sessionId", "exerciseLogId", "exerciseId", "setNumber", "setType", "weightKg", reps,
           "isCompleted", "completedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          cuid(),
          userId,
          sessionId,
          s.logId,
          s.ex.exerciseId,
          s.n,
          s.type,
          s.kg,
          s.reps,
          s.at !== null,
          s.at ? ts(s.at) : null,
          ts(startedAt),
          ts(s.at ?? startedAt),
        ],
      );
    }
  }
  // Activated on Monday two weeks ago, three weeks in; Tuesday is next.
  await db.query(
    `UPDATE "ProgramEnrollment" SET "startedAt" = $2, "createdAt" = $2, "currentWeek" = $3, "nextDayIndex" = $4, "completedSessions" = $5 WHERE id = $1`,
    [enrollment.id, ts(activated), history.some((h) => h.week === 3) ? 3 : 2, TARGET_DAY, history.length],
  );
  await db.query(`UPDATE "UserProgram" SET "createdAt" = $2 WHERE id = $1`, [enrollment.programId, ts(activated)]);
  await db.query(`UPDATE "user" SET "createdAt" = $2 WHERE id = $1`, [userId, ts(activated)]);
  await db.query(`UPDATE "Profile" SET "createdAt" = $2, "onboardingCompletedAt" = $2 WHERE "userId" = $1`, [userId, ts(activated)]);
  // A few followers: "Quem vê · Seguidores" reaches someone.
  for (const name of FOLLOWERS) {
    const id = cuid();
    const handle = `${name.split(" ")[0].toLowerCase()}_${id.slice(-6)}`;
    await db.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", username) VALUES ($1, $2, $3, true, $4, $4, $5)`,
      [id, name, `pwa-demo-${run}-${handle}@fgpower.dev`, ts(activated), handle],
    );
    await db.query(
      `INSERT INTO "Profile" (id, "userId", "displayName", "onboardingCompletedAt", "isPublicAccount", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, true, $4, $4)`,
      [cuid(), id, name, ts(activated)],
    );
    await db.query(`INSERT INTO "Follow" ("followerId", "followingId", "createdAt") VALUES ($1, $2, $3)`, [id, userId, ts(activated)]);
  }
  await db.query("COMMIT");

  // 3. Today. Monday and Tuesday open with last week's review: closed (its own ×), Today reads the same any day.
  await page.goto("/app/today");
  const review = page.locator("[data-week-review]");
  // A tap before hydration does nothing: tap until it goes.
  for (let i = 0; (await review.count()) > 0 && i < 20; i++) {
    await review.getByRole("button", { name: "Fechar resumo da semana anterior" }).click();
    await review.waitFor({ state: "detached", timeout: 500 }).catch(() => undefined);
  }
  await page.reload();
  await page.locator("[data-hero]").first().waitFor();
  await shoot(page, "today.png");

  // 4. The workout: started 38 minutes ago (today: see the time check above), three exercises in, then the superset on screen.
  const hero = page.locator('[data-hero="next"]');
  if (await hero.getByRole("heading", { name: target.name, exact: true }).count()) {
    await Promise.all([page.waitForURL(/\/app\/workout\/[^/]+$/), hero.getByRole("button", { name: "Iniciar treino" }).click()]);
  } else {
    // Not Today's next workout (a Monday or a weekend: see the usage note): start it from its row on the program's page.
    await page.goto(`/app/programs/${enrollment.programId}`);
    const row = page.locator(".reg-frame").filter({ has: page.getByRole("heading", { name: target.name, exact: true }) }).first();
    await Promise.all([page.waitForURL(/\/app\/workout\/[^/]+$/), row.getByRole("button", { name: "Iniciar", exact: true }).click()]);
  }
  const sessionId = new URL(page.url()).pathname.split("/").pop();
  const startedAt = new Date(now.getTime() - 38 * 60_000);
  await db.query(`UPDATE "WorkoutSession" SET "startedAt" = $2, "createdAt" = $2 WHERE id = $1`, [sessionId, ts(startedAt)]);
  const rows = await all(
    `SELECT s.id, x.slug, l."sortOrder", s."setNumber" FROM "SetLog" s JOIN "WorkoutExerciseLog" l ON l.id = s."exerciseLogId"
     JOIN "Exercise" x ON x.id = s."exerciseId" WHERE s."sessionId" = $1 AND s."setType" = 'WORKING' ORDER BY l."sortOrder", s."setNumber"`,
    [sessionId],
  );
  const bySlug = (slug) => rows.filter((r) => r.slug === slug);
  /** ✓'d sets of TODAY's loads, their taps spread from `from` to `to` (ms; none: stamped by the server). */
  const ops = (slugs, from = null, to = null) => {
    const list = slugs.flatMap((slug) => {
      const { kg, reps } = TODAY[slug];
      return bySlug(slug).map((r, i) => ({ r, kg, reps: reps[i] ?? reps[reps.length - 1] }));
    });
    return list.map(({ r, kg, reps }, i) => ({
      setLogId: r.id,
      weightKg: kg,
      reps,
      rir: null,
      done: true,
      completedAtMs: from === null ? null : Math.round(from + ((to - from) * (i + 1)) / list.length),
    }));
  };
  const sync = async (list) => {
    const failed = await page.evaluate(async (body) => {
      const res = await fetch("/api/workout/sets", { method: "POST", headers: { "content-type": "application/json" }, body });
      const out = await res.json();
      return res.ok ? out.results.filter((r) => !r.ok).length : -1;
    }, JSON.stringify({ ops: list }));
    if (failed !== 0) throw new Error(`the set endpoint refused ${failed < 0 ? "the batch" : `${failed} sets`}`);
  };
  await sync(ops(["hack-squat", "leg-extensions", "seated-leg-curl"], startedAt.getTime() + 4 * 60_000, Date.now() - 3 * 60_000));
  await page.goto(`/app/workout/${sessionId}`);
  const heading = page.getByRole("heading", { level: 1 });
  await heading.filter({ hasText: "Puxada para o Rosto" }).waitFor();
  await logOnScreen(page, TODAY["face-pull"].kg, TODAY["face-pull"].reps[0]);
  // The switch (0:20) moves the screen to A2 on its own.
  await heading.filter({ hasText: "Panturrilha" }).waitFor();
  await logOnScreen(page, TODAY["standing-calf-raises"].kg, TODAY["standing-calf-raises"].reps[0]);
  // The round's rest: back on A1, the clock counting.
  await heading.filter({ hasText: "Puxada para o Rosto" }).waitFor();
  await page.locator('[data-rest-state="running"]').waitFor();
  await page.waitForTimeout(1_500);
  await shoot(page, "workout.png");

  // 5. The rest of it, finished in the app; then the check-in.
  const done = [bySlug("face-pull")[0].id, bySlug("standing-calf-raises")[0].id];
  await sync(ops(["face-pull", "standing-calf-raises", "hanging-leg-raise"]).filter((o) => !done.includes(o.setLogId)));
  await page.goto(`/app/workout/${sessionId}`);
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await Promise.all([page.waitForURL(/\/summary/), sheet.getByRole("button", { name: "Finalizar e salvar" }).click()]);
  const checkIn = page.locator('[data-check-in="open"]');
  await checkIn.getByRole("group", { name: "Esforço do treino" }).getByRole("radio", { name: "8", exact: true }).check();
  await checkIn.getByRole("group", { name: "Dor muscular ao chegar" }).getByRole("radio", { name: "2", exact: true }).check();
  await checkIn.getByLabel("Peso hoje").fill(DEMO_WEIGHT);
  await checkIn.getByLabel("Peso hoje").press("Enter");
  await page.waitForLoadState("networkidle");
  await checkIn.getByRole("button", { name: "Pronto" }).click();
  // As it opens later: the answers folded into one line.
  await page.reload();
  await page.locator('[data-check-in="answered"]').waitFor();
  await shoot(page, "summary.png");
  // All three at once, only now: a run that fails halfway leaves OUT as it was, never a mixed set.
  mkdirSync(OUT, { recursive: true });
  for (const [file, png] of shots) {
    writeFileSync(join(OUT, file), png);
    console.log("wrote", join(OUT, file));
  }
  console.log(`Demo account: ${email} (${userId}).`);
} finally {
  await browser.close();
  await db.end();
}

/** Types a set into the exercise on screen and taps its ✓, then waits for the server to have it. */
async function logOnScreen(page, kg, reps) {
  await page.getByLabel("Série 1 — kg", { exact: true }).fill(String(kg).replace(".", ","));
  await page.getByLabel("Série 1 — repetições", { exact: true }).fill(String(reps));
  await page.getByRole("button", { name: "Concluir série 1", exact: true }).click();
  const done = page.getByRole("button", { name: "Série 1 feita — toque para desfazer", exact: true });
  await done.waitFor();
  await page.waitForFunction((el) => !el.hasAttribute("data-sync"), await done.elementHandle());
}

/** The page as a phone shows it, top of the screen, as a palette PNG kept for OUT. */
async function shoot(page, file) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.locator("[data-skeleton]").first().waitFor({ state: "detached" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(async () => {
    await document.fonts.ready;
    const inView = [...document.images].filter((img) => img.getBoundingClientRect().top < innerHeight);
    await Promise.all(inView.map((img) => img.decode().catch(() => undefined)));
  });
  const png = await page.screenshot({ animations: "disabled", caret: "hide" });
  shots.set(file, await sharp(png).png({ palette: true, colors: 256, dither: 0.5, compressionLevel: 9, effort: 10 }).toBuffer());
}
