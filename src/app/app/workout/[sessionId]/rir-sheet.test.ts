import { describe, expect, it } from "vitest";
import { isRirTarget, rirSpareWords } from "./rir-sheet";

describe("rirSpareWords", () => {
  it("says how the set ends, to follow 'faria ~12×'", () => {
    expect(rirSpareWords(2)).toBe("com ~2 reps sobrando");
    expect(rirSpareWords(1)).toBe("com ~1 rep sobrando");
    expect(rirSpareWords(2.5)).toBe("com 2–3 reps sobrando");
    expect(rirSpareWords(0)).toBe("até a falha");
  });
  it("leaves out 'reps' when the sentence already says it", () => {
    expect(rirSpareWords(2, true)).toBe("com ~2 sobrando");
    expect(rirSpareWords(1, true)).toBe("com ~1 sobrando");
    expect(rirSpareWords(2.5, true)).toBe("com 2–3 sobrando");
    expect(rirSpareWords(0, true)).toBe("até a falha");
  });
});

describe("isRirTarget", () => {
  const marked = (target: number | null) => [0, 1, 2, 3, 4].filter((l) => isRirTarget(l, target));
  it("marks the level(s) around the target", () => {
    expect(marked(2)).toEqual([2]);
    expect(marked(2.5)).toEqual([2, 3]);
    expect(marked(0)).toEqual([0]);
    expect(marked(null)).toEqual([]);
  });
  it("marks '4 ou mais' for RIR 4 and above (deloads prescribe 5)", () => {
    expect(marked(4)).toEqual([4]);
    expect(marked(5)).toEqual([4]);
    expect(marked(3.5)).toEqual([3, 4]);
    expect(marked(3)).toEqual([3]);
  });
});
