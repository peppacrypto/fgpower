import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The share images' fonts (Inter 400/600/800, JetBrains Mono 700) and the
 * brand tile, read once per process from the repo (assets/og, OFL) — Satori
 * reads TTF, not the app's woff2, and next/og only bundles one Geist weight.
 * Nothing is fetched at render time.
 */

export interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600 | 700 | 800;
  style: "normal";
}

let fonts: Promise<OgFont[]> | null = null;
let tile: Promise<string> | null = null;

async function font(file: string, name: string, weight: OgFont["weight"]): Promise<OgFont> {
  const buf = await readFile(join(process.cwd(), "assets/og", file));
  return { name, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight, style: "normal" };
}

export function ogFonts(): Promise<OgFont[]> {
  fonts ??= Promise.all([
    font("Inter-Regular.ttf", "Inter", 400),
    font("Inter-SemiBold.ttf", "Inter", 600),
    font("Inter-ExtraBold.ttf", "Inter", 800),
    font("JetBrainsMono-Bold.ttf", "Mono", 700),
  ]).catch((err) => {
    fonts = null;
    throw err;
  });
  return fonts;
}

/** public/brand/fgpower-tile.png as a data URI (Satori can't read the WebP brand art). */
export function brandTile(): Promise<string> {
  tile ??= readFile(join(process.cwd(), "public/brand/fgpower-tile.png"))
    .then((buf) => `data:image/png;base64,${buf.toString("base64")}`)
    .catch((err) => {
      tile = null;
      throw err;
    });
  return tile;
}
