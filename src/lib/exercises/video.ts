/**
 * The 11-character YouTube video id from a watch / youtu.be / embed / shorts /
 * nocookie URL, or a bare id. Returns null for anything else — the only video
 * source the app embeds is YouTube (exercise tutorials, currently yoga poses).
 */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const s = url.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const patterns = [/[?&]v=([\w-]{11})/, /youtu\.be\/([\w-]{11})/, /\/embed\/([\w-]{11})/, /\/shorts\/([\w-]{11})/];
  for (const re of patterns) {
    const m = re.exec(s);
    if (m) return m[1];
  }
  return null;
}

/** The privacy-friendly (youtube-nocookie) embed URL for a video id, autoplay on. */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
}

/** A still thumbnail URL for a video id (served by YouTube's image CDN). */
export function youtubeThumbUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
