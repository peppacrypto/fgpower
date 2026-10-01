// Builds public/icons/badge-96.png — the Android status-bar badge of reminder
// notifications (public/sw.js): the "FG" letters of the brand mark as a white
// glyph on transparency (Android draws only the alpha channel, in its own
// colour). Run: node scripts/make-badge-icon.mjs
import sharp from "sharp";

const SRC = new URL("../public/brand/fgpower-mark.png", import.meta.url).pathname;
const OUT = new URL("../public/icons/badge-96.png", import.meta.url).pathname;
const SIZE = 96;
const GLYPH = 76; // the letters' box inside the badge

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const out = Buffer.alloc(info.width * info.height * 4);
for (let i = 0; i < info.width * info.height; i++) {
  const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // The letters are the light pixels on the opaque dark blotch; the rest goes.
  // A hard threshold: a badge is a solid silhouette, not the mark's metal texture.
  const alpha = a > 200 && luma > 55 ? 255 : 0;
  out.set([255, 255, 255, alpha], i * 4);
}
const glyph = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
  .median(5) // closes the scratches' pinholes
  .trim({ threshold: 1 })
  .resize(GLYPH, GLYPH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: glyph, gravity: "center" }])
  .png({ compressionLevel: 9 })
  .toFile(OUT);
console.log("wrote", OUT);
