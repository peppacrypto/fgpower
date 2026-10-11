"use client";

import { useState } from "react";
import { youtubeEmbedUrl, youtubeId, youtubeThumbUrl } from "@/lib/exercises/video";

/**
 * A click-to-load YouTube tutorial. Nothing from YouTube loads until the user
 * taps play: first paint is just the thumbnail (a plain <img> from YouTube's
 * image CDN, so no next.config change) over a play button; the tap swaps in the
 * youtube-nocookie iframe. This keeps the exercise page light and sets no
 * third-party cookies on view (privacy). Renders nothing for a non-YouTube URL.
 */
export function YouTubeEmbed({ url, title, credit }: { url: string; title: string; credit?: string | null }) {
  const id = youtubeId(url);
  const [playing, setPlaying] = useState(false);
  if (!id) return null;
  return (
    <figure className="reg-frame overflow-hidden">
      <div className="relative aspect-video w-full bg-black">
        {playing ? (
          <iframe
            src={youtubeEmbedUrl(id)}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 h-full w-full cursor-pointer"
            aria-label={`Reproduzir vídeo: ${title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- YouTube CDN thumbnail, kept off next/image to avoid remotePatterns config */}
            <img
              src={youtubeThumbUrl(id)}
              alt=""
              className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
              loading="lazy"
            />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-background/85 text-foreground shadow-md transition group-hover:scale-105">
                <svg viewBox="0 0 24 24" className="size-6 translate-x-[1px] fill-current" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="flex items-center justify-between gap-2 px-1 pt-1.5 text-[11px] text-muted">
        <span>{credit ? `Tutorial: ${credit}` : "Tutorial em vídeo"}</span>
        <span className="font-mono uppercase tracking-[0.12em]">YouTube</span>
      </figcaption>
    </figure>
  );
}
