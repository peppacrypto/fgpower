import { describe, expect, it } from "vitest";
import { suggestProgression, type PerformedSet, type PrescribedSet } from "./progression";

const prescribed: PrescribedSet = { repMin: 8, repMax: 12, rirTarget: 2 };

function sets(...specs: Array<[number, number, number]>): PerformedSet[] {
  return specs.map(([weightKg, reps, rir]) => ({ weightKg, reps, rir }));
}

describe("suggestProgression — DOUBLE", () => {
  it("suggests a load increase when every set reaches the top of the rep range at target RIR", () => {
    const last = sets([60, 12, 2], [60, 12, 2], [60, 12, 2.5]);
    const result = suggestProgression("DOUBLE", prescribed, last, 2.5);
    expect(result.progressionAvailable).toBe(true);
    expect(result.suggestedLoadKg).toBe(62.5);
    expect(result.reasonKey).toBe("at-rep-range-ceiling-with-target-rir");
  });

  it("does not suggest progression when still within the rep range", () => {
    const last = sets([60, 9, 2], [60, 8, 2], [60, 8, 2]);
    const result = suggestProgression("DOUBLE", prescribed, last, 2.5);
    expect(result.progressionAvailable).toBe(false);
    expect(result.reasonKey).toBe("within-rep-range-add-reps");
  });

  it("flags incomplete sets when a working set falls below the rep minimum", () => {
    const last = sets([60, 6, 1], [60, 8, 2]);
    const result = suggestProgression("DOUBLE", prescribed, last, 2.5);
    expect(result.progressionAvailable).toBe(false);
    expect(result.reasonKey).toBe("incomplete-sets");
  });

  it("does not suggest progression when reps are at ceiling but RIR is far below target (near failure)", () => {
    const last = sets([60, 12, 0], [60, 12, 0]);
    const result = suggestProgression("DOUBLE", prescribed, last, 2.5);
    expect(result.progressionAvailable).toBe(false);
  });
});

describe("suggestProgression — LINEAR_LOAD", () => {
  it("suggests adding load when the prescription was met", () => {
    const last = sets([100, 5, 2], [100, 5, 2], [100, 5, 2]);
    const p: PrescribedSet = { repMin: 5, repMax: 5, rirTarget: 2 };
    const result = suggestProgression("LINEAR_LOAD", p, last, 2.5);
    expect(result.progressionAvailable).toBe(true);
    expect(result.suggestedLoadKg).toBe(102.5);
  });

  it("does not add load when a set missed the prescribed reps", () => {
    const last = sets([100, 3, 0], [100, 5, 2]);
    const p: PrescribedSet = { repMin: 5, repMax: 5, rirTarget: 2 };
    const result = suggestProgression("LINEAR_LOAD", p, last, 2.5);
    expect(result.progressionAvailable).toBe(false);
    expect(result.reasonKey).toBe("linear-missed-prescription");
  });
});

describe("suggestProgression — RIR_BASED", () => {
  it("suggests more load when actual RIR is well above target (too easy)", () => {
    const last = sets([50, 10, 4], [50, 10, 4]);
    const p: PrescribedSet = { repMin: 8, repMax: 12, rirTarget: 2 };
    const result = suggestProgression("RIR_BASED", p, last, 2.5);
    expect(result.progressionAvailable).toBe(true);
  });

  it("keeps load when actual RIR is well below target (too hard)", () => {
    const last = sets([50, 10, 0], [50, 10, 0]);
    const p: PrescribedSet = { repMin: 8, repMax: 12, rirTarget: 2 };
    const result = suggestProgression("RIR_BASED", p, last, 2.5);
    expect(result.progressionAvailable).toBe(false);
    expect(result.reasonKey).toBe("rir-lower-than-target-keep-load");
  });
});

describe("suggestProgression — MANUAL", () => {
  it("never suggests a load", () => {
    const last = sets([50, 10, 2]);
    const result = suggestProgression("MANUAL", prescribed, last, 2.5);
    expect(result.progressionAvailable).toBe(false);
    expect(result.reasonKey).toBe("manual-strategy");
  });
});

describe("suggestProgression — missing history", () => {
  it("handles an empty session gracefully", () => {
    const result = suggestProgression("DOUBLE", prescribed, [], 2.5);
    expect(result.progressionAvailable).toBe(false);
    expect(result.reasonKey).toBe("no-history");
  });
});
