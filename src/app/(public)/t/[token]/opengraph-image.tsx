import { getSharedWorkout } from "@/lib/data/share";
import { brandTile } from "@/lib/og/fonts";
import { brandCardPng, pngResponse, renderPng } from "@/lib/og/render";
import { cachedImage, rememberImage } from "@/lib/og/render-guard";
import { WorkoutOgCard, workoutImageData } from "@/lib/og/workout-images";

/** The link preview of a shared workout — the brand card once the link is off (never a broken image). */
export const alt = "Treino registrado na FGPOWER";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Per token and never cached: a revoked link must stop showing its workout.
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await getSharedWorkout(token).catch((err) => {
    console.error("shared workout preview failed", err);
    return null;
  });
  // Dead, unknown or hidden: the brand card, rendered once per process (anyone can ask for it in a loop).
  if (!shared) return pngResponse(await brandCardPng(), HEADERS);

  // A live link is checked on every fetch (above); its picture is kept per version, as the story's is.
  const key = `og:${token}:${shared.activity.updatedAt.getTime()}`;
  let png = cachedImage(key);
  if (!png) {
    const card = <WorkoutOgCard data={workoutImageData(shared)} tile={await brandTile()} />;
    png = await renderPng(card, size).catch((err) => {
      console.error("shared workout preview failed", err);
      return null;
    });
    if (png) rememberImage(key, png);
  }
  return pngResponse(png ?? (await brandCardPng()), HEADERS);
}
