import Image from "next/image";
import { GLoad } from "@/components/ui/glyph";
import { YouTubeEmbed } from "@/components/exercises/youtube-embed";
import { cn } from "@/lib/utils/cn";

/** What each technique frame is: its visible tag, and how its alt text says it. */
const FRAME: Record<string, { tag: string; alt: string }> = {
  IMAGE_START: { tag: "Início", alt: "posição inicial" },
  IMAGE_END: { tag: "Fim", alt: "posição final" },
};

type Frame = { id: string; url: string; kind: string; altPt: string | null; width?: number | null; height?: number | null };

/**
 * An exercise's technique media: a YouTube tutorial (when the exercise has one
 * — currently yoga poses and mobility) as a click-to-load embed, and/or its
 * technique photos, each tagged with the phase it shows (Início / Fim) — two
 * near-identical photos read as one otherwise — and described that way to
 * screen readers instead of repeating the name. With neither, a placeholder.
 *
 * The photos keep their own shape, so the body and the equipment stay in the
 * picture: a landscape photo (most of them, 3:2) sits in a 4:3 frame — a few
 * percent off the sides, never a lifter's head or feet — and a portrait one
 * in a 3:4 frame. Landscape pairs sit side by side from sm up, one under the
 * other in the page's narrow column on wide screens (`stackWide`), and on a
 * phone in a row that swipes, each almost the screen's width.
 */
export function TechniqueFrames({
  name,
  media,
  videoUrl,
  videoCredit,
  stackWide = false,
}: {
  name: string;
  media: Frame[];
  videoUrl?: string | null;
  videoCredit?: string | null;
  /** The frames sit in a narrow column from lg up: stack landscape photos there. */
  stackWide?: boolean;
}) {
  if (media.length === 0 && !videoUrl) {
    return (
      <div className="card flex aspect-[4/3] w-full items-center justify-center text-muted">
        <GLoad className="size-10" />
      </div>
    );
  }
  if (videoUrl) {
    return (
      <div className="flex flex-col justify-start gap-3">
        <YouTubeEmbed url={videoUrl} title={name} credit={videoCredit} />
        {media.length > 0 ? <TechniqueImages name={name} media={media} stackWide={false} /> : null}
      </div>
    );
  }
  return <TechniqueImages name={name} media={media} stackWide={stackWide} />;
}

function TechniqueImages({ name, media, stackWide }: { name: string; media: Frame[]; stackWide: boolean }) {
  const portrait = media.every((m) => m.width && m.height && m.height > m.width);
  const pair = media.length > 1;
  // A phone swipes a landscape pair; everything else is a plain grid.
  const swipe = pair && !portrait;
  return (
    <div
      // Scrollable on a phone: reachable and named for the keyboard (WCAG 2.1.1).
      {...(swipe ? { role: "group", "aria-label": "Fotos da técnica", tabIndex: 0 } : {})}
      className={cn(
        "rounded-[var(--radius-lg)]",
        swipe
          ? "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:content-start sm:gap-3 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          : cn("grid content-start gap-2 sm:gap-3", pair ? "grid-cols-2" : "grid-cols-1"),
        swipe && stackWide && "lg:grid-cols-1",
      )}
    >
      {media.map((m, i) => {
        const frame = FRAME[m.kind];
        return (
          <figure
            key={m.id}
            className={cn(
              "relative overflow-hidden rounded-[var(--radius-lg)] bg-surface-2",
              portrait ? "aspect-[3/4]" : "aspect-[4/3]",
              swipe && "w-[84%] shrink-0 snap-start sm:w-auto",
            )}
          >
            <Image
              src={m.url}
              alt={m.altPt ?? `${name} — ${frame ? frame.alt : `imagem ${i + 1} de ${media.length}`}`}
              fill
              className="object-cover"
              sizes={swipe ? "(max-width: 639px) 84vw, (max-width: 1023px) 50vw, 440px" : "(max-width: 1023px) 50vw, 440px"}
              loading="eager"
              fetchPriority={i === 0 ? "high" : undefined}
            />
            {frame ? (
              <figcaption
                aria-hidden
                className="absolute left-2 top-2 rounded-[var(--radius-sm)] bg-surface/90 px-2 py-0.5 text-xs font-medium text-foreground shadow-[var(--shadow-sm)]"
              >
                {frame.tag}
              </figcaption>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
}
