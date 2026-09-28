import { describe, expect, it } from "vitest";
import { DEFAULT_WEEKDAYS, layOutWeek, trainingWeekdays } from "./schedule";

const SEG = 1,
  TER = 2,
  QUA = 3,
  QUI = 4,
  SEX = 5,
  SAB = 6,
  DOM = 0;

describe("trainingWeekdays", () => {
  it("uses the conventional spread when the user picked no days", () => {
    for (let n = 1; n <= 7; n++) expect(trainingWeekdays(n, [])).toEqual(DEFAULT_WEEKDAYS[n]);
    expect(trainingWeekdays(3, [])).toEqual([SEG, QUA, SEX]);
  });

  it("keeps exactly the days picked when they match, Monday first", () => {
    expect(trainingWeekdays(3, [DOM, QUA, SEX])).toEqual([QUA, SEX, DOM]);
    expect(trainingWeekdays(2, [TER, SAB])).toEqual([TER, SAB]);
  });

  it("trims to a well-spaced subset of the days picked", () => {
    // Six days picked, three needed: every other day, weekdays first.
    expect(trainingWeekdays(3, [SEG, TER, QUA, QUI, SEX, SAB])).toEqual([SEG, QUA, SEX]);
    // Picked Mon–Wed + Sat, two needed: as far apart as the picks allow.
    expect(trainingWeekdays(2, [SEG, TER, QUA, SAB])).toEqual([TER, SAB]);
  });

  it("adds well-spaced days to the ones picked, never dropping a pick", () => {
    const five = trainingWeekdays(5, [SEG, QUA, SEX]);
    expect(five).toHaveLength(5);
    for (const d of [SEG, QUA, SEX]) expect(five).toContain(d);
    // Never five days in a row when a spread exists.
    expect(five).not.toEqual([SEG, TER, QUA, QUI, SEX]);
    expect(trainingWeekdays(4, [SEG, QUI])).toEqual([SEG, TER, QUI, SEX]);
  });

  it("clamps the count to a week and ignores bad weekdays", () => {
    expect(trainingWeekdays(9, [])).toEqual(DEFAULT_WEEKDAYS[7]);
    expect(trainingWeekdays(0, [])).toEqual([SEG]);
    expect(trainingWeekdays(2, [7, -1, 2.5, TER, QUI])).toEqual([TER, QUI]);
  });
});

describe("layOutWeek", () => {
  const days = (...names: string[]) => names.map((name) => ({ name }));

  it("keeps a weekday-named plan on its own weekdays", () => {
    const gd = days("Segunda — Superior", "Terça — Inferior", "Quinta — Puxar", "Sexta — Pernas", "Sábado — Braços");
    expect(layOutWeek(gd, 5, [SEG, QUA, SEX])).toEqual({
      weekdays: [SEG, TER, QUI, SEX, SAB],
      schedule: [SEG, TER, QUI, SEX, SAB],
    });
  });

  it("lays each day of a once-a-week plan onto the user's days, in order", () => {
    expect(layOutWeek(days("Sessão A", "Sessão B", "Sessão C"), 3, [TER, QUI, SAB]).weekdays).toEqual([TER, QUI, SAB]);
    expect(layOutWeek(days("Sessão A", "Sessão B", "Sessão C"), 3, []).weekdays).toEqual([SEG, QUA, SEX]);
    // Two of the days named, one not: laid onto the user's days instead.
    expect(layOutWeek(days("Segunda — A", "Quarta — B", "Full body"), 3, [TER, QUI, SAB]).weekdays).toEqual([
      TER,
      QUI,
      SAB,
    ]);
  });

  it("gives a plan that repeats its days no fixed weekday, but still a schedule", () => {
    expect(layOutWeek(days("Treino A", "Treino B"), 3, [SEG, QUA, SEX])).toEqual({
      weekdays: [null, null],
      schedule: [SEG, QUA, SEX],
    });
    expect(layOutWeek(days("Full body"), 3, []).schedule).toEqual([SEG, QUA, SEX]);
  });

  it("leaves plans longer than a week alone", () => {
    const eight = days(...Array.from({ length: 8 }, (_, i) => `Dia ${i + 1}`));
    expect(layOutWeek(eight, 7, []).weekdays.every((w) => w === null)).toBe(true);
    expect(layOutWeek([], 3, []).weekdays).toEqual([]);
  });
});
