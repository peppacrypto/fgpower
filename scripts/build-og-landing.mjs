/**
 * Builds the site's default link preview, src/app/opengraph-image.jpg
 * (1200×630): the full fg-banner-letlive art (never cropped), an accent rule,
 * then "TREINE COM UM MOTIVO." with the free line and the wordmark. JPEG,
 * because WhatsApp drops previews much over ~300 KB (the PNG is ~1.2 MB).
 *
 * Run once after changing the art or the copy, and commit the output:
 *   node scripts/build-og-landing.mjs
 * Uses next/og (Satori) with the share fonts in assets/og and sharp (dev
 * dependency) for the WebP banner and the JPEG encode. No network.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));
const React = require("react");
const { ImageResponse } = require("next/og");
const sharp = require("sharp");

const h = React.createElement;
const font = (file) => readFileSync(join(root, "assets/og", file));
const fonts = [
  { name: "Inter", data: font("Inter-Regular.ttf"), weight: 400, style: "normal" },
  { name: "Inter", data: font("Inter-ExtraBold.ttf"), weight: 800, style: "normal" },
  { name: "Mono", data: font("JetBrainsMono-Bold.ttf"), weight: 700, style: "normal" },
];

const WIDTH = 1200;
const HEIGHT = 630;
const BANNER_HEIGHT = 401;
const BG = "#0a0a0b";
const FG = "#f2f3f5";
const ACCENT = "#c3ff4d";

const tile = `data:image/png;base64,${readFileSync(join(root, "public/brand/fgpower-tile.png")).toString("base64")}`;
const bannerJpeg = await sharp(join(root, "public/brand/fg-banner-letlive.webp"))
  .resize(WIDTH, BANNER_HEIGHT, { fit: "fill" })
  .jpeg({ quality: 90 })
  .toBuffer();
const banner = `data:image/jpeg;base64,${bannerJpeg.toString("base64")}`;

const mono = (size, color) => ({
  fontFamily: "Mono",
  fontWeight: 700,
  fontSize: size,
  letterSpacing: size * 0.16,
  textTransform: "uppercase",
  color,
});

const wordmark = (size) =>
  h(
    "div",
    { style: { display: "flex", alignItems: "center", gap: size * 0.4 } },
    h("img", { src: tile, width: size * 1.6, height: size * 1.6, style: { borderRadius: size * 0.35 } }),
    h(
      "div",
      { style: { display: "flex", fontFamily: "Inter", fontWeight: 800, fontSize: size, color: FG, letterSpacing: -0.5 } },
      "FG",
      h("span", { style: { color: ACCENT } }, "POWER"),
    ),
  );

const card = h(
  "div",
  { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, fontFamily: "Inter", color: FG } },
  h("img", { src: banner, width: WIDTH, height: BANNER_HEIGHT }),
  h(
    "div",
    {
      style: {
        display: "flex",
        flex: 1,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 64px",
        borderTop: `3px solid ${ACCENT}`,
      },
    },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column" } },
      h(
        "div",
        { style: { display: "flex", fontSize: 60, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1 } },
        "TREINE COM UM",
        h("span", { style: { color: ACCENT, marginLeft: 16 } }, "MOTIVO."),
      ),
      h("div", { style: { ...mono(20, FG), marginTop: 18 } }, "Grátis · sem cartão · musculação com evidência"),
    ),
    wordmark(34),
  ),
);

const png = Buffer.from(await new ImageResponse(card, { width: WIDTH, height: HEIGHT, fonts }).arrayBuffer());
const jpeg = await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
const out = join(root, "src/app/opengraph-image.jpg");
writeFileSync(out, jpeg);
console.log(`${out}: ${jpeg.length} bytes`);
