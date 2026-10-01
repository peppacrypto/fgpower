import "server-only";
import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import { BrandOgCard } from "./brand-card";
import { brandTile, ogFonts } from "./fonts";

/**
 * Renders a share image to PNG bytes with the share fonts. Rendered in full
 * before answering (ImageResponse streams otherwise, and a render error
 * would surface as a broken 200), so callers can cache it or fall back.
 */
export async function renderPng(element: ReactElement, size: { width: number; height: number }): Promise<Buffer> {
  const res = new ImageResponse(element, { ...size, fonts: await ogFonts() });
  return Buffer.from(await res.arrayBuffer());
}

let brand: Promise<Buffer> | null = null;

/**
 * The brand card (1200×630) as PNG bytes, rendered once per process. It never
 * changes, and it answers every dead, unknown or failed preview — which
 * anyone can ask for in a loop, so after the first time it costs nothing.
 */
export function brandCardPng(): Promise<Buffer> {
  brand ??= brandTile()
    .then((tile) => renderPng(<BrandOgCard tile={tile} />, { width: 1200, height: 630 }))
    .catch((err) => {
      brand = null;
      throw err;
    });
  return brand;
}

/** A PNG response; a preview is public for as long as its link is. */
export function pngResponse(png: Buffer, headers: Record<string, string> = {}): Response {
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: { "Content-Type": "image/png", "Content-Length": String(png.byteLength), ...headers },
  });
}
