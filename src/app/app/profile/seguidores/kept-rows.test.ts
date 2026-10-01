import { describe, expect, it } from "vitest";
import { keepRows } from "./kept-rows";

const row = (id: string, relation = "NONE") => ({ id, relation });
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("keepRows (a list's rows for this visit)", () => {
  it("keeps a row the server no longer lists, in its place", () => {
    const shown = [row("a"), row("b"), row("c")];
    expect(ids(keepRows([row("a"), row("c")], shown))).toEqual(["a", "b", "c"]);
    expect(ids(keepRows([row("b"), row("c")], shown))).toEqual(["a", "b", "c"]);
    expect(ids(keepRows([row("a"), row("b")], shown))).toEqual(["a", "b", "c"]);
  });

  it("keeps every row when the server lists none (the last follower removed)", () => {
    expect(ids(keepRows([], [row("a"), row("b")]))).toEqual(["a", "b"]);
  });

  it("keeps a row as first shown, whatever the server says of it now", () => {
    const merged = keepRows([row("a", "FOLLOWING")], [row("a", "NONE")]);
    expect(merged).toEqual([row("a", "NONE")]);
  });

  it("takes new rows in the server's order (a new follower on top, 'Carregar mais' below)", () => {
    const shown = [row("a"), row("b")];
    expect(ids(keepRows([row("n"), row("a"), row("b"), row("z")], shown))).toEqual(["n", "a", "b", "z"]);
  });

  it("is the server's list when nothing was shown yet, and stable when nothing changed", () => {
    const latest = [row("a"), row("b")];
    expect(keepRows(latest, [])).toEqual(latest);
    expect(keepRows(latest, latest)).toEqual(latest);
  });
});
