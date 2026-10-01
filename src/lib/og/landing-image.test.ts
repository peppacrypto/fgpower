import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

/**
 * The site's default preview (src/app/opengraph-image.jpg, built by
 * scripts/build-og-landing.mjs) stays a 1200×630 JPEG small enough for
 * WhatsApp, so a regenerated asset can't silently grow.
 */
describe("landing preview image", () => {
  const file = join(process.cwd(), "src/app/opengraph-image.jpg");

  it("is a 1200×630 JPEG under 300 KB", async () => {
    expect(statSync(file).size).toBeLessThan(300_000);
    const meta = await sharp(file).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it("has its alt text", () => {
    expect(readFileSync(join(process.cwd(), "src/app/opengraph-image.alt.txt"), "utf8")).toMatch(/^FGPOWER — /);
  });
});
