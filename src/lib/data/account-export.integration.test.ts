import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  exportFilename,
  loadAccountExport,
  toExportJson,
  toTreinosCsv,
  TREINOS_CSV_HEADER,
  type AccountExportData,
} from "./account-export";

/**
 * "Exportar meus dados" (W-151) against the real local Postgres: a GD fork,
 * a finished workout with a warm-up, an extra set, a timed hold, a swapped
 * exercise and a superset, a discarded workout, and someone else's workout.
 * The spreadsheet has one row per completed set of finished workouts, in
 * words a person reads; the JSON has names instead of ids; the discarded
 * workout and the other account never appear. The route answers 401 without
 * a session, names the files by the day and never lets a cache keep them.
 */

const RUN_ID = `export-${Date.now()}`;
const USER_ID = `${RUN_ID}-u`;
const OTHER_ID = `${RUN_ID}-o`;

let session: { user: { id: string } } | null = null;
vi.mock("@/lib/auth/require-user", () => ({ getCurrentSession: async () => session }));

const route = await import("@/app/api/account/export/route");

const emailOf = (n: number) => `export.${n}.${RUN_ID.slice(7)}@fgpower.test`;
const names: Record<string, string> = {};
let workoutId = "";
let discardedId = "";
let otherWorkoutId = "";

/** Four published exercises that aren't holds, by slug, and the plank (a hold). */
async function exercises() {
  const loaded = await prisma.exercise.findMany({
    where: { isPublished: true, equipment: { category: "FREE_WEIGHT" }, slug: { notIn: ["plank", "side-bridge", "plate-pinch"] } },
    select: { id: true, slug: true, namePt: true },
    orderBy: { slug: "asc" },
    take: 4,
  });
  const plank = await prisma.exercise.findUniqueOrThrow({ where: { slug: "plank" }, select: { id: true, slug: true, namePt: true } });
  for (const e of [...loaded, plank]) names[e.id] = e.namePt;
  return { a: loaded[0], b: loaded[1], swappedIn: loaded[2], swappedOut: loaded[3], plank };
}

beforeAll(async () => {
  // Names and addresses that don't contain the ids, so the "no raw ids" check means it.
  for (const [id, n] of [
    [USER_ID, 1],
    [OTHER_ID, 2],
  ] as const) {
    await prisma.user.create({
      data: { id, name: `Pessoa ${n}`, email: emailOf(n), emailVerified: true, username: `export_${n}_${Date.now()}` },
    });
    await prisma.profile.create({ data: { userId: id, displayName: `Pessoa ${n}`, onboardingCompletedAt: new Date() } });
  }
  const ex = await exercises();
  const gd1 = await prisma.workoutTemplate.findUniqueOrThrow({ where: { slug: "gd-1" }, select: { id: true } });

  // A GD 1 fork: its day pairs A and B (a superset), then the plank.
  const program = await prisma.userProgram.create({
    data: {
      userId: USER_ID,
      name: "GD 1",
      status: "ACTIVE",
      sourceTemplateId: gd1.id,
      daysPerWeek: 5,
      days: {
        create: {
          dayIndex: 0,
          name: "Segunda — Superior",
          exercises: {
            create: [
              { exerciseId: ex.a.id, sortOrder: 0, sets: 3, groupKey: "A", restSeconds: 20 },
              { exerciseId: ex.b.id, sortOrder: 1, sets: 3, groupKey: "A", restSeconds: 120 },
              { exerciseId: ex.plank.id, sortOrder: 2, sets: 3, repMin: 20, repMax: 45 },
              { exerciseId: ex.swappedOut.id, sortOrder: 3, sets: 3 },
            ],
          },
        },
      },
    },
    include: { days: true },
  });

  const finishedAt = new Date("2026-09-10T21:30:00Z"); // 18:30 in São Paulo
  const workout = await prisma.workoutSession.create({
    data: {
      userId: USER_ID,
      programId: program.id,
      programDayId: program.days[0].id,
      name: "Segunda — Superior",
      status: "COMPLETED",
      startedAt: new Date("2026-09-10T20:30:00Z"),
      finishedAt,
      durationSeconds: 3600,
      programWeek: 2,
      caption: "=HYPERLINK(\"http://x\")",
    },
  });
  workoutId = workout.id;
  const log = (exerciseId: string, sortOrder: number, extra: object = {}) =>
    prisma.workoutExerciseLog.create({
      data: { sessionId: workout.id, userId: USER_ID, exerciseId, sortOrder, prescribedSets: 3, repMin: 8, repMax: 12, restSeconds: 90, ...extra },
    });
  const set = (exerciseLogId: string, exerciseId: string, setNumber: number, data: object) =>
    prisma.setLog.create({ data: { userId: USER_ID, sessionId: workout.id, exerciseLogId, exerciseId, setNumber, ...data } });

  // A1: a warm-up done, a working set with an unrounded load, and a working set never touched.
  const a = await log(ex.a.id, 0, { groupKey: "A" });
  await set(a.id, ex.a.id, 1, { setType: "WARMUP", weightKg: 20, reps: 10, isCompleted: true, completedAt: finishedAt });
  await set(a.id, ex.a.id, 2, { weightKg: 44.62524042425695, reps: 10, rir: 2.5, isCompleted: true, completedAt: finishedAt, notes: "-3 kg na próxima" });
  await set(a.id, ex.a.id, 3, {});
  // A2: a working set and an extra one.
  const b = await log(ex.b.id, 1, { groupKey: "A" });
  await set(b.id, ex.b.id, 1, { weightKg: 30, reps: 12, isCompleted: true, completedAt: finishedAt });
  await set(b.id, ex.b.id, 2, { weightKg: 30, reps: 8, isExtra: true, isCompleted: true, completedAt: finishedAt });
  // The plank: its reps are seconds.
  const plank = await log(ex.plank.id, 2, { repMin: 20, repMax: 45 });
  await set(plank.id, ex.plank.id, 1, { weightKg: 0, reps: 45, isCompleted: true, completedAt: finishedAt });
  // Swapped in place: done instead of the program's exercise.
  const swapped = await log(ex.swappedIn.id, 3, { substitutedFromExerciseId: ex.swappedOut.id });
  await set(swapped.id, ex.swappedIn.id, 1, { weightKg: 50, reps: 8, isCompleted: true, completedAt: finishedAt });

  // Thrown away: never exported, not even its completed set.
  const discarded = await prisma.workoutSession.create({
    data: { userId: USER_ID, name: "Descartado de teste", status: "DISCARDED", startedAt: new Date("2026-09-11T20:00:00Z") },
  });
  discardedId = discarded.id;
  const dLog = await prisma.workoutExerciseLog.create({
    data: { sessionId: discarded.id, userId: USER_ID, exerciseId: ex.a.id, sortOrder: 0, prescribedSets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
  });
  await prisma.setLog.create({
    data: { userId: USER_ID, sessionId: discarded.id, exerciseLogId: dLog.id, exerciseId: ex.a.id, setNumber: 1, weightKg: 99, reps: 9, isCompleted: true },
  });

  // Someone else's workout.
  const other = await prisma.workoutSession.create({
    data: { userId: OTHER_ID, name: "Treino de outra pessoa", status: "COMPLETED", startedAt: finishedAt, finishedAt },
  });
  otherWorkoutId = other.id;
  const oLog = await prisma.workoutExerciseLog.create({
    data: { sessionId: other.id, userId: OTHER_ID, exerciseId: ex.a.id, sortOrder: 0, prescribedSets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
  });
  await prisma.setLog.create({
    data: { userId: OTHER_ID, sessionId: other.id, exerciseLogId: oLog.id, exerciseId: ex.a.id, setNumber: 1, weightKg: 77.5, reps: 7, isCompleted: true },
  });
  // An FG this account gave to that workout, which its owner has made private since.
  const otherPost = await prisma.activity.create({
    data: { userId: OTHER_ID, type: "WORKOUT", sessionId: other.id, visibility: "PRIVATE", summary: {} },
  });
  await prisma.activityFG.create({ data: { activityId: otherPost.id, userId: USER_ID } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_ID] } } });
  await prisma.$disconnect();
});

const rowsOf = (csv: string) => csv.slice(1).split("\r\n").filter(Boolean).map((line) => line.split(";"));
const col = (name: (typeof TREINOS_CSV_HEADER)[number]) => TREINOS_CSV_HEADER.indexOf(name);

describe("toTreinosCsv", () => {
  it("has one row per completed set of the finished workout, in words and with a decimal comma", async () => {
    const csv = toTreinosCsv(await loadAccountExport(USER_ID));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [header, ...rows] = rowsOf(csv);
    expect(header).toEqual([...TREINOS_CSV_HEADER]);
    // Warm-up + working (A1), working + extra (A2), the plank, the swap: the untouched set isn't one.
    expect(rows).toHaveLength(6);
    for (const r of rows) {
      expect(r[col("Data")]).toBe("2026-09-10");
      expect(r[col("Início")]).toBe("17:30");
      expect(r[col("Treino")]).toBe("Segunda — Superior");
      expect(r[col("Programa")]).toBe("GD 1");
      expect(r[col("Semana")]).toBe("2");
    }
    const [warmup, working, a2, a2extra, plank, swapped] = rows;
    expect(warmup[col("Tipo")]).toBe("Aquecimento");
    expect(working[col("Tipo")]).toBe("Válida");
    expect(working[col("Carga (kg)")]).toBe("44,63");
    expect(working[col("RIR")]).toBe("2,5");
    // A note starting like a formula stays text.
    expect(working[col("Nota da série")]).toBe("'-3 kg na próxima");
    // The superset's letters (W-104), the order of the exercises.
    expect([warmup, working, a2, a2extra, plank, swapped].map((r) => r[col("Grupo")])).toEqual(["A1", "A1", "A2", "A2", "", ""]);
    expect([warmup, a2, plank, swapped].map((r) => r[col("Ordem")])).toEqual(["1", "2", "3", "4"]);
    expect(a2extra[col("Extra")]).toBe("sim");
    expect(a2[col("Extra")]).toBe("não");
    // Each set is numbered as the workout screen and the summary name it, within its kind: the
    // working set after A1's warm-up is "Série 1" (its row number is 2); A2's extra is "Série extra 1".
    expect(rows.map((r) => r[col("Série")])).toEqual(["1", "1", "1", "1", "1", "1"]);
    // A hold's value is seconds, not reps.
    expect(plank[col("Reps")]).toBe("");
    expect(plank[col("Segundos")]).toBe("45");
    expect(plank[col("Carga (kg)")]).toBe("0");
    expect(working[col("Segundos")]).toBe("");
    // The swap names what it replaced.
    expect(swapped[col("No lugar de")]).not.toBe("");
    expect(Object.values(names)).toContain(swapped[col("No lugar de")]);
    expect(Object.values(names)).toContain(swapped[col("Exercício")]);
  });

  it("numbers sets the way the screen does: warm-ups, working sets and extras each from 1, a set not done keeping its place", () => {
    const at = new Date("2026-09-10T21:30:00Z");
    const set = (setNumber: number, setType: "WARMUP" | "WORKING" | "DROP", isExtra: boolean, isCompleted = true) => ({
      setNumber,
      setType,
      isExtra,
      weightKg: 40,
      reps: 10,
      rir: null,
      isCompleted,
      completedAt: isCompleted ? at : null,
      notes: null,
    });
    const workout = {
      name: "Treino",
      status: "COMPLETED",
      startedAt: at,
      finishedAt: at,
      programWeek: null,
      program: null,
      exerciseLogs: [
        {
          groupKey: null,
          notes: null,
          exercise: { namePt: "Supino", slug: "supino" },
          substitutedFrom: null,
          // Rows 1–2 warm-ups, 3–5 the working sets (4 not done), 6 an extra drop set.
          sets: [
            set(1, "WARMUP", false),
            set(2, "WARMUP", false),
            set(3, "WORKING", false),
            set(4, "WORKING", false, false),
            set(5, "WORKING", false),
            set(6, "DROP", true),
          ],
        },
      ],
    } as unknown as AccountExportData["workouts"][number];
    const [, ...rows] = rowsOf(toTreinosCsv({ workouts: [workout] }));
    expect(rows.map((r) => [r[col("Série")], r[col("Tipo")], r[col("Extra")]])).toEqual([
      ["1", "Aquecimento", "não"],
      ["2", "Aquecimento", "não"],
      ["1", "Válida", "não"],
      ["3", "Válida", "não"],
      ["1", "Drop set", "sim"],
    ]);
  });

  it("leaves out the discarded workout and anyone else's", async () => {
    const csv = toTreinosCsv(await loadAccountExport(USER_ID));
    expect(csv).not.toContain("Descartado de teste");
    expect(csv).not.toContain("99");
    expect(csv).not.toContain("Treino de outra pessoa");
    expect(csv).not.toContain("77,5");
  });
});

describe("toExportJson", () => {
  it("is v2, readable (names, not ids) and only this account's", async () => {
    const data = toExportJson(await loadAccountExport(USER_ID), new Date("2026-09-12T12:00:00Z"));
    const text = JSON.stringify(data);
    expect(data).toMatchObject({ format: "fgpower-export", version: 2, exportedAt: "2026-09-12T12:00:00.000Z" });
    expect(data.account).toMatchObject({ email: emailOf(1), name: "Pessoa 1" });

    // No raw ids anywhere: not as keys, not as values.
    expect(text).not.toMatch(/"(id|userId|exerciseId|sessionId|programId|exerciseLogId)":/);
    for (const id of [USER_ID, workoutId, discardedId, otherWorkoutId, ...Object.keys(names)]) expect(text).not.toContain(id);
    // Nothing of the other account, nor the discarded workout.
    expect(text).not.toContain(OTHER_ID);
    expect(text).not.toContain(emailOf(2));
    expect(text).not.toContain("Pessoa 2");
    expect(text).not.toContain("Treino de outra pessoa");
    expect(data.workouts.map((w) => w.name)).toEqual(["Segunda — Superior"]);
    // The FG given stays in this account's log, but the workout its owner made private isn't named.
    expect(data.social.fgsGiven).toHaveLength(1);
    expect(data.social.fgsGiven[0]).toMatchObject({ workout: null });

    expect(data.programs).toHaveLength(1);
    expect(data.programs[0]).toMatchObject({ name: "GD 1", basedOn: "GD 1", status: "Ativo" });
    expect(data.programs[0].days[0].exercises.map((e) => e.group)).toEqual(["A1", "A2", null, null]);

    const [workout] = data.workouts;
    expect(workout).toMatchObject({ status: "Concluído", program: "GD 1", programWeek: 2, caption: "=HYPERLINK(\"http://x\")" });
    const [a1, a2, plank, swapped] = workout.exercises;
    expect([a1.group, a2.group, plank.group, swapped.group]).toEqual(["A1", "A2", null, null]);
    // Only sets someone did or typed: the untouched one is left out; loads keep two decimals.
    expect(a1.sets.map((s) => [s.type, s.weightKg, s.reps, s.completed])).toEqual([
      ["Aquecimento", 20, 10, true],
      ["Válida", 44.63, 10, true],
    ]);
    expect(a2.sets.map((s) => s.extra)).toEqual([false, true]);
    // Numbered within their kind, as the app names them ("Aquecimento 1", "Série 1", "Série extra 1").
    expect(a1.sets.map((s) => s.number)).toEqual([1, 1]);
    expect(a2.sets.map((s) => s.number)).toEqual([1, 1]);
    expect(plank).toMatchObject({ timed: true });
    expect(plank.sets[0]).toMatchObject({ reps: null, seconds: 45 });
    expect(swapped.substitutedFrom).not.toBeNull();
    expect(Object.values(names)).toContain(swapped.substitutedFrom);
  });

  it("names the files by the São Paulo day", () => {
    // 01:30 UTC on the 13th is still the 12th in São Paulo.
    const now = new Date("2026-09-13T01:30:00Z");
    expect(exportFilename("csv", now)).toBe("fgpower-treinos-2026-09-12.csv");
    expect(exportFilename("json", now)).toBe("fgpower-dados-2026-09-12.json");
  });
});

describe("GET /api/account/export", () => {
  const get = (format?: string) => route.GET(new Request(`http://localhost/api/account/export${format ? `?format=${format}` : ""}`));

  it("answers 401 without a session, never someone's data, and never cached", async () => {
    session = null;
    const res = await get("csv");
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.json()).toEqual({ error: "Sua sessão expirou — entre de novo." });
  });

  it("sends the spreadsheet or the JSON as a download named by the day; JSON by default", async () => {
    session = { user: { id: USER_ID } };
    const csv = await get("csv");
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(csv.headers.get("content-disposition")).toMatch(/^attachment; filename="fgpower-treinos-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(csv.headers.get("cache-control")).toBe("private, no-store");
    expect(csv.headers.get("x-content-type-options")).toBe("nosniff");
    expect(rowsOf(await csv.text())).toHaveLength(7);

    const json = await get();
    expect(json.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(json.headers.get("content-disposition")).toMatch(/filename="fgpower-dados-\d{4}-\d{2}-\d{2}\.json"$/);
    expect((await json.json()).version).toBe(2);
  });

  it("holds back a burst of exports: the seventh in ten minutes waits, and says how long", async () => {
    session = { user: { id: OTHER_ID } };
    for (let i = 0; i < 6; i++) expect((await get("csv")).status).toBe(200);
    const limited = await get("json");
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await limited.text()).toMatch(/^Muitas exportações seguidas\. Tente de novo em \d+ min\.$/);
  });
});
