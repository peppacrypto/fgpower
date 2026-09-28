import { describe, expect, it } from "vitest";
import { hasLibraryFilters, libraryHref, parseLibraryParams } from "./library-params";

describe("parseLibraryParams", () => {
  it("keeps valid filters and drops hand-edited enum values instead of failing the query", () => {
    const s = parseLibraryParams({ q: "supino", muscleGroup: "CHEST", difficulty: "ADVANCED", lista: "favoritos", page: "3" });
    expect(s).toMatchObject({ q: "supino", muscleGroup: "CHEST", difficulty: "ADVANCED", lista: "favoritos", page: 3 });
    const bad = parseLibraryParams({ muscleGroup: "FOO", difficulty: "HARD", lista: "x", page: "-2" });
    expect(bad).toMatchObject({ muscleGroup: "", difficulty: "", lista: "", page: 1 });
    expect(parseLibraryParams({ q: ["a", "b"], page: "abc" })).toMatchObject({ q: "", page: 1 });
    expect(parseLibraryParams({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
});

describe("libraryHref", () => {
  it("writes only what is set, and a page only past the first", () => {
    const s = parseLibraryParams({ q: " remada ", equipmentId: "cable" });
    expect(libraryHref("/app/exercises", s)).toBe("/app/exercises?q=remada&equipmentId=cable");
    expect(libraryHref("/app/exercises", s, 2)).toBe("/app/exercises?q=remada&equipmentId=cable&page=2");
    expect(libraryHref("/exercises", parseLibraryParams({}), 1)).toBe("/exercises");
  });
});

describe("hasLibraryFilters", () => {
  it("counts the text and every facet, but not blank text", () => {
    expect(hasLibraryFilters(parseLibraryParams({}))).toBe(false);
    expect(hasLibraryFilters(parseLibraryParams({ q: "  " }))).toBe(false);
    expect(hasLibraryFilters(parseLibraryParams({ lista: "programa" }))).toBe(true);
  });
});
