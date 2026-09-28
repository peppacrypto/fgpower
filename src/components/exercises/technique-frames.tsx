import Image from "next/image";
import { GLoad } from "@/components/ui/glyph";

/** What each technique frame is: its visible tag, and how its alt text says it. */
const FRAME: Record<string, { tag: string; alt: string }> = {
  IMAGE_START: { tag: "Início", alt: "posição inicial" },
  IMAGE_END: { tag: "Fim", alt: "posição final" },
};

/**
 * An exercise's technique photos, side by side, each tagged with the phase it
 * shows (INÍCIO / FIM) — two near-identical photos read as one otherwise —
 * and described that way to screen readers instead of repeating the name.
 */
export function TechniqueFrames({
  name,
  media,
}: {
  name: string;
  media: { id: string; url: string; kind: string; altPt: string | null }[];
}) {
  if (media.length === 0) {
    return (
      <div className="reg-frame flex aspect-[3/4] w-full items-center justify-center text-muted">
        <GLoad className="size-10" />
      </div>
    );
  }
  return (
    <div className="reg-frame flex gap-2">
      {media.map((m, i) => {
        const frame = FRAME[m.kind];
        return (
          <figure key={m.id} className="relative aspect-[3/4] flex-1 overflow-hidden">
            <Image
              src={m.url}
              alt={m.altPt ?? `${name} — ${frame ? frame.alt : `imagem ${i + 1} de ${media.length}`}`}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 50vw, 440px"
              loading="eager"
              fetchPriority={i === 0 ? "high" : undefined}
            />
            {frame ? (
              <figcaption
                aria-hidden
                className="absolute left-0 top-0 bg-background/90 px-1.5 py-1 font-mono text-[10px] font-bold uppercase leading-none tracking-[0.16em] text-foreground"
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
