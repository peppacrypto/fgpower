import { describe, expect, it } from "vitest";
import { VOLUME_GUIDE, volumeStatus, volumeSummary, weeklyVolume } from "./weekly-volume";

const ex = (sets: number, primary: string[], secondary: string[] = []) => ({
  sets,
  primaryMuscleIds: primary,
  secondaryMuscleIds: secondary,
});
const row = (v: ReturnType<typeof weeklyVolume>, key: string) => v.rows.find((r) => r.key === key)!;

describe("weeklyVolume", () => {
  it("counts direct sets in full and assisting sets at half", () => {
    const v = weeklyVolume([{ exercises: [ex(4, ["chest"], ["triceps", "anterior-deltoid"])] }], 1);
    expect(row(v, "peito")).toMatchObject({ sets: 4, direct: 4, status: "low" });
    expect(row(v, "triceps")).toMatchObject({ sets: 2, direct: 0 });
    expect(row(v, "ombros")).toMatchObject({ sets: 2, direct: 0 });
    expect(row(v, "costas")).toMatchObject({ sets: 0, status: "none" });
  });

  it("counts a muscle trained directly and assisting in one exercise once, directly", () => {
    // Lateral and anterior deltoid are both "Ombros".
    const v = weeklyVolume([{ exercises: [ex(3, ["lateral-deltoid"], ["anterior-deltoid"])] }], 1);
    expect(row(v, "ombros")).toMatchObject({ sets: 3, direct: 3 });
  });

  it("scales by how often each day comes around in the week", () => {
    // A 1-day full body at 3×/week: 4 sets a session is 12 a week.
    expect(row(weeklyVolume([{ exercises: [ex(4, ["quadriceps"])] }], 3), "quadriceps")).toMatchObject({
      sets: 12,
      status: "ok",
    });
    // A/B at 3×: each day 1,5× a week.
    const ab = weeklyVolume([{ exercises: [ex(4, ["chest"])] }, { exercises: [ex(4, ["lats"])] }], 3);
    expect(row(ab, "peito").sets).toBe(6);
    expect(ab.perDay).toBe(1.5);
  });

  it("skips exercises whose muscles aren't known yet, and says how many", () => {
    const v = weeklyVolume([{ exercises: [ex(3, ["chest"]), { sets: 3, primaryMuscleIds: null, secondaryMuscleIds: null }] }], 1);
    expect(v.unknown).toBe(1);
    expect(row(v, "peito").sets).toBe(3);
  });

  it("rounds to half a set", () => {
    const v = weeklyVolume([{ exercises: [ex(3, ["lats"], ["biceps"])] }, { exercises: [] }, { exercises: [] }], 4);
    // 1.5 biceps sets × 4/3 = 2 → 2
    expect(row(v, "biceps").sets).toBe(2);
    expect(row(v, "costas").sets).toBe(4);
  });
});

describe("volumeStatus / volumeSummary", () => {
  it("reads the guide band", () => {
    expect(volumeStatus(0)).toBe("none");
    expect(volumeStatus(VOLUME_GUIDE.min - 0.5)).toBe("low");
    expect(volumeStatus(VOLUME_GUIDE.min)).toBe("ok");
    expect(volumeStatus(VOLUME_GUIDE.max)).toBe("ok");
    expect(volumeStatus(VOLUME_GUIDE.max + 1)).toBe("high");
  });

  it("summarizes in one line", () => {
    expect(volumeSummary(weeklyVolume([], 3).rows)).toBe("sem exercícios");
    const v = weeklyVolume([{ exercises: [ex(12, ["chest"]), ex(4, ["lats"]), ex(25, ["quadriceps"])] }], 1);
    expect(volumeSummary(v.rows)).toBe("1 abaixo · 1 acima");
    expect(volumeSummary(weeklyVolume([{ exercises: [ex(12, ["chest"])] }], 1).rows)).toBe("na faixa");
  });
});
