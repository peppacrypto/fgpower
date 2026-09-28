import { describe, expect, it } from "vitest";
import { VOLUME_MUSCLES, parsePickerQuery, pickerSearchUrl } from "./exercise-facets";

describe("picker search URLs", () => {
  it("round-trips a query and leaves defaults out", () => {
    const q = { q: " supino ", muscle: "peito", equipment: "meu", tab: "favoritos" as const, page: 2 };
    const url = pickerSearchUrl(q);
    expect(url).toBe("/api/exercises/search?q=supino&muscle=peito&equipment=meu&tab=favoritos&page=2");
    expect(parsePickerQuery(new URL(url, "http://x").searchParams)).toEqual({ ...q, q: "supino" });
    expect(pickerSearchUrl({ q: "", muscle: null, equipment: null, tab: "todos", page: 1 })).toBe("/api/exercises/search");
  });

  it("drops what it doesn't know", () => {
    expect(parsePickerQuery(new URLSearchParams("muscle=x&equipment=y&tab=z&page=-3"))).toEqual({
      q: "",
      muscle: null,
      equipment: null,
      tab: "todos",
      page: 1,
    });
  });

  it("maps every anatomical muscle to at most one volume muscle", () => {
    const ids = VOLUME_MUSCLES.flatMap((m) => [...m.muscleIds]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
