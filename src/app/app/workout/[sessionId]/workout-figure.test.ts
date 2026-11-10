import { describe, expect, it } from "vitest";
import { FIGURE_HEIGHT, boneFigure, encodeFigureMemory, figureSizeFor } from "./workout-figure";

describe("workout figure", () => {
  it("is large for a move with no equipment, compact otherwise", () => {
    expect(figureSizeFor("bodyweight")).toBe("large");
    expect(figureSizeFor("none")).toBe("large");
    expect(figureSizeFor("barbell")).toBe("compact");
    expect(figureSizeFor(null)).toBe("compact");
    expect(FIGURE_HEIGHT.compact).not.toBe(FIGURE_HEIGHT.large);
  });

  it("the skeleton keeps the room this device remembers for that workout", () => {
    expect(boneFigure(encodeFigureMemory("cm1abc", "large"), "cm1abc")).toBe("large");
    expect(boneFigure(encodeFigureMemory("cm1abc", null), "cm1abc")).toBeNull();
    // The server can't tell the workout: it trusts the cookie.
    expect(boneFigure(encodeFigureMemory("cm1abc", null), null)).toBeNull();
  });

  it("another workout, nothing stored or garbage: the usual compact figure", () => {
    expect(boneFigure(encodeFigureMemory("cm1abc", null), "cm2xyz")).toBe("compact");
    expect(boneFigure(null, "cm1abc")).toBe("compact");
    expect(boneFigure("cm1abc.Q", null)).toBe("compact");
    expect(boneFigure("<script>.L", null)).toBe("compact");
  });
});
