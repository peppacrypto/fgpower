import { describe, expect, it } from "vitest";
import { validateEditRow } from "@/lib/training/edit-set-validation";

describe("validateEditRow (A-083)", () => {
  it("flags an unparseable non-empty RIR as 'rir', not the value fields", () => {
    expect(validateEditRow({ weight: "40", reps: "10", rir: "2-3" })).toBe("rir");
  });
  it("accepts an empty RIR", () => {
    expect(validateEditRow({ weight: "40", reps: "10", rir: "" })).toBeNull();
    expect(validateEditRow({ weight: "40", reps: "10", rir: "  " })).toBeNull();
  });
  it("flags missing/invalid kg or reps as 'value' before looking at RIR", () => {
    expect(validateEditRow({ weight: "", reps: "10", rir: "2-3" })).toBe("value");
    expect(validateEditRow({ weight: "40", reps: "0", rir: "x" })).toBe("value");
    expect(validateEditRow({ weight: "40", reps: "", rir: "" })).toBe("value");
  });
  it("accepts a fully valid row", () => {
    expect(validateEditRow({ weight: "40", reps: "10", rir: "2" })).toBeNull();
  });
});
