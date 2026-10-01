import { getSharedWorkout } from "@/lib/data/share";
import { brandTile } from "@/lib/og/fonts";
import { pngResponse, renderPng } from "@/lib/og/render";
import { allowRender, cachedImage, clientIp, rememberImage } from "@/lib/og/render-guard";
import { StoryImage, workoutImageData } from "@/lib/og/workout-images";

/**
 * The story image of a shared workout (1080×1920 PNG), for "Compartilhar
 * imagem". Only through a live link; each render is cached per token and
 * version, and new renders are rate-limited per client (render-guard.ts).
 */
export const dynamic = "force-dynamic";

const SIZE = { width: 1080, height: 1920 };
const NOINDEX = { "X-Robots-Tag": "noindex", "Cache-Control": "private, no-store" };

/** "2026-09-28" on the São Paulo calendar, for the file name. */
function spDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await getSharedWorkout(token);
  if (!shared) return new Response("Link desativado.", { status: 404, headers: NOINDEX });

  const key = `${token}:${shared.activity.updatedAt.getTime()}`;
  let png = cachedImage(key);
  if (!png) {
    if (!allowRender(clientIp(request.headers))) {
      return new Response("Muitas imagens em pouco tempo. Tente de novo em um minuto.", {
        status: 429,
        headers: { ...NOINDEX, "Retry-After": "60" },
      });
    }
    const story = <StoryImage data={workoutImageData(shared)} tile={await brandTile()} />;
    png = await renderPng(story, SIZE).catch((err) => {
      console.error("story image failed", err);
      return null;
    });
    if (!png) return new Response("Não foi possível gerar a imagem.", { status: 500, headers: NOINDEX });
    rememberImage(key, png);
  }
  return pngResponse(png, {
    ...NOINDEX,
    "Content-Disposition": `inline; filename=fgpower-treino-${spDate(shared.finishedAt)}.png`,
  });
}
