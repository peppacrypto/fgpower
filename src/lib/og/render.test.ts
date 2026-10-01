import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { brandCardPng } from "./render";

/**
 * The brand card answers every dead, unknown or failed preview (/t, /u) —
 * which anyone can request in a loop — so it is rendered once per process
 * and the same bytes are served after that.
 */
describe("brand card preview", () => {
  it("is a 1200×630 PNG, rendered once and then reused", async () => {
    const first = await brandCardPng();
    const meta = await sharp(first).metadata();
    expect(meta).toMatchObject({ format: "png", width: 1200, height: 630 });
    // The very same buffer: no second render.
    expect(await brandCardPng()).toBe(first);
  });
});
