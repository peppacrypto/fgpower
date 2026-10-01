import { getPublicProfile } from "@/lib/data/social";
import { fetchAvatarDataUri } from "@/lib/og/avatar";
import { brandTile } from "@/lib/og/fonts";
import { ProfileOgCard } from "@/lib/og/profile-card";
import { brandCardPng, pngResponse, renderPng } from "@/lib/og/render";

/**
 * A public profile's link preview: what a signed-out visitor of /u sees at
 * the top (the program only when its owner shows it). A missing or banned
 * account gets the brand card.
 */
export const alt = "Perfil na FGPOWER";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Per profile and uncached: a changed name, photo or privacy shows on the next fetch.
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "public, max-age=300" };

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  // Already decoded, as the page's own param is (/u/100%25 is "100%": decoding it again would throw).
  const { username } = await params;
  const profile = await getPublicProfile(username, null).catch((err) => {
    console.error("profile preview failed", err);
    return null;
  });
  // Missing or banned: the brand card, rendered once per process (anyone can ask for it in a loop).
  if (!profile?.username) return pngResponse(await brandCardPng(), HEADERS);
  const card = (
    <ProfileOgCard
      tile={await brandTile()}
      data={{
        name: profile.name,
        username: profile.username,
        bio: profile.bio,
        followers: profile.followerCount,
        following: profile.followingCount,
        program: profile.activeProgramName,
        isPrivate: !profile.isPublicAccount,
        avatar: await fetchAvatarDataUri(profile.image),
      }}
    />
  );
  const png = await renderPng(card, size).catch((err) => {
    console.error("profile preview failed", err);
    return null;
  });
  return pngResponse(png ?? (await brandCardPng()), HEADERS);
}
