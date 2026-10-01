import { stripEmoji, truncate } from "@/lib/social/public-workout";
import { plural } from "@/lib/utils/format";
import { corners, InitialsSquare, mono, OgWordmark } from "./parts";
import { OG, OG_DOMAIN } from "./theme";

/**
 * A public profile's link preview (/u/<handle>, 1200×630): photo, name,
 * handle, bio, counts — the current program only when the owner shows it —
 * and whether the account is private. Nothing a signed-out visitor of /u
 * wouldn't see.
 */
export interface ProfileImageData {
  name: string;
  username: string;
  bio: string | null;
  followers: number;
  following: number;
  program: string | null;
  isPrivate: boolean;
  /** A data URI (fetched through fetchAvatarDataUri), or null for initials. */
  avatar: string | null;
}

export function ProfileOgCard({ data, tile }: { data: ProfileImageData; tile: string }) {
  const name = truncate(stripEmoji(data.name), 40) || `@${data.username}`;
  const bio = data.bio ? truncate(stripEmoji(data.bio).replace(/\s+/g, " "), 120) : null;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: OG.BG,
        position: "relative",
        padding: 64,
        fontFamily: "Inter",
        color: OG.FG,
      }}
    >
      {corners({ inset: 24, length: 40, width: 3 })}
      <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
        {data.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>
          <img src={data.avatar} width={160} height={160} style={{ borderRadius: 80 }} alt="" />
        ) : (
          <InitialsSquare name={name} size={160} />
        )}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: name.length > 24 ? 52 : 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>{name}</div>
          <div style={{ ...mono(24), marginTop: 12, textTransform: "none", letterSpacing: 1 }}>{`@${data.username}`}</div>
          {bio ? <div style={{ fontSize: 28, lineHeight: 1.35, color: OG.MUTED, marginTop: 20 }}>{bio}</div> : null}
          <div style={{ ...mono(20, OG.FG), marginTop: 24 }}>
            {`${plural(data.followers, "seguidor", "seguidores")} · ${data.following} seguindo`}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            {data.program ? (
              <div style={{ ...mono(18, OG.ACCENT), background: OG.ACCENT_SOFT, padding: "6px 12px" }}>
                {`Treinando: ${truncate(stripEmoji(data.program), 30)}`}
              </div>
            ) : null}
            {data.isPrivate ? (
              <div style={{ ...mono(18), border: `2px solid ${OG.RULE}`, padding: "4px 12px" }}>Conta privada</div>
            ) : null}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flex: 1 }} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `3px solid ${OG.FG}`,
          paddingTop: 20,
        }}
      >
        <OgWordmark size={28} tile={tile} />
        <div style={{ ...mono(18), textTransform: "none", letterSpacing: 1 }}>{`${OG_DOMAIN}/u/${data.username}`}</div>
      </div>
    </div>
  );
}
