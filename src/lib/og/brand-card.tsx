import { corners, mono, OgWordmark } from "./parts";
import { OG } from "./theme";

/**
 * The fallback preview (1200×630): a revoked link, a missing profile or a
 * failed render still shows the brand — never a broken image.
 */
export function BrandOgCard({ tile, kicker }: { tile: string; kicker?: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: OG.BG,
        position: "relative",
        padding: 72,
        fontFamily: "Inter",
        color: OG.FG,
      }}
    >
      {corners({ inset: 24, length: 40, width: 3 })}
      <OgWordmark size={34} tile={tile} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {kicker ? <div style={mono(20, OG.ACCENT)}>{kicker}</div> : null}
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, letterSpacing: -2, lineHeight: 1, marginTop: kicker ? 20 : 0 }}>
          TREINE COM UM<span style={{ color: OG.ACCENT, marginLeft: 20 }}>MOTIVO.</span>
        </div>
        <div style={{ ...mono(22, OG.FG), marginTop: 28 }}>Grátis · sem cartão · musculação com evidência</div>
      </div>
    </div>
  );
}
