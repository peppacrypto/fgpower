import type { CSSProperties } from "react";
import { OG } from "./theme";

/**
 * Building blocks of the share images (next/og → Satori): inline styles
 * only, and every element with more than one child is display:flex — Satori
 * throws otherwise.
 */

/** Mono micro-caps: the dossier's field labels, in pixels. */
export function mono(size: number, color: string = OG.MUTED, extra: CSSProperties = {}): CSSProperties {
  return {
    fontFamily: "Mono",
    fontWeight: 700,
    fontSize: size,
    letterSpacing: size * 0.16,
    textTransform: "uppercase",
    color,
    ...extra,
  };
}

/**
 * The four L-shaped registration marks of the dossier frame, as an array to
 * spread into the frame's own children: Satori lays a component's fragment
 * out as a box of its own, which would move the absolute marks with it.
 */
export function corners({ inset, length, width, color = OG.REG }: { inset: number; length: number; width: number; color?: string }) {
  const rule = `${width}px solid ${color}`;
  const base: CSSProperties = { position: "absolute", width: length, height: length, display: "flex" };
  return [
    <div key="tl" style={{ ...base, top: inset, left: inset, borderTop: rule, borderLeft: rule }} />,
    <div key="tr" style={{ ...base, top: inset, right: inset, borderTop: rule, borderRight: rule }} />,
    <div key="bl" style={{ ...base, bottom: inset, left: inset, borderBottom: rule, borderLeft: rule }} />,
    <div key="br" style={{ ...base, bottom: inset, right: inset, borderBottom: rule, borderRight: rule }} />,
  ];
}

/** The FG tile and "FGPOWER" with POWER in accent. */
export function OgWordmark({ size, tile }: { size: number; tile: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.4 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> */}
      <img src={tile} width={size * 1.6} height={size * 1.6} style={{ borderRadius: size * 0.35 }} alt="" />
      <div style={{ display: "flex", fontFamily: "Inter", fontWeight: 800, fontSize: size, color: OG.FG, letterSpacing: -0.5 }}>
        FG<span style={{ color: OG.ACCENT }}>POWER</span>
      </div>
    </div>
  );
}

/** The accent "PR" / "2 PRs" tag. */
export function PrTag({ text, size }: { text: string; size: number }) {
  return (
    <div style={{ ...mono(size, OG.ACCENT_INK), background: OG.ACCENT, padding: `${size * 0.25}px ${size * 0.55}px`, letterSpacing: size * 0.12 }}>
      {text}
    </div>
  );
}

/** A person's initials in a square, where no avatar can be drawn. */
export function InitialsSquare({ name, size }: { name: string; size: number }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        background: OG.ACCENT_SOFT,
        color: OG.ACCENT,
        fontFamily: "Inter",
        fontWeight: 800,
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  );
}
