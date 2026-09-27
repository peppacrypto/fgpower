import { describe, expect, it } from "vitest";
import { BEGINNER_PATH, beginnerStep, nextPrinciple, readingOrder } from "./principle-order";

const principles = [
  { slug: "rir", sortOrder: 10 },
  { slug: "training-to-failure", sortOrder: 20 },
  { slug: "progressive-overload", sortOrder: 30 },
  { slug: "double-progression", sortOrder: 40 },
  { slug: "warm-up", sortOrder: 100 },
  { slug: "deloads", sortOrder: 110 },
  { slug: "beginner-adaptation", sortOrder: 140 },
];

describe("principle reading order", () => {
  it("puts the beginner path first, then the rest by sortOrder", () => {
    expect(readingOrder(principles).map((p) => p.slug)).toEqual([...BEGINNER_PATH, "training-to-failure", "deloads"]);
  });

  it("walks to the next principle and stops at the end", () => {
    expect(nextPrinciple(principles, "beginner-adaptation")?.slug).toBe("rir");
    expect(nextPrinciple(principles, "warm-up")?.slug).toBe("training-to-failure");
    expect(nextPrinciple(principles, "deloads")).toBeNull();
    expect(nextPrinciple(principles, "unknown")).toBeNull();
  });

  it("numbers the beginner path", () => {
    expect(beginnerStep("rir")).toBe(2);
    expect(beginnerStep("deloads")).toBeNull();
  });
});
