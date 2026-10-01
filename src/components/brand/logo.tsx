import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/** The metallic FG monogram tile — the compact mark (nav, favicon-adjacent contexts). */
export function Logomark({
  size = 32,
  className,
  alt = "FGPOWER",
}: {
  size?: number;
  className?: string;
  /** "" when the name is printed right beside it (Wordmark), so it isn't read twice. */
  alt?: string;
}) {
  return (
    <Image
      src="/brand/fgpower-tile.png"
      alt={alt}
      width={size}
      height={size}
      className={cn("rounded-[22%]", className)}
      // Not lazy: it sits in a page's first screen (a header, the login card). No high priority
      // either: it's never the page's largest paint. React's server render still preloads it (it
      // does for every non-lazy <img>), at normal priority. (`priority` is deprecated in Next 16.)
      loading="eager"
    />
  );
}

/** Full "FGPOWER" wordmark lockup: metallic monogram + typographic name. */
export function Wordmark({
  className,
  iconSize = 30,
  onDark = false,
}: {
  className?: string;
  iconSize?: number;
  onDark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <Logomark size={iconSize} alt="" />
      <span
        className={cn(
          "text-[17px] font-extrabold tracking-tight",
          onDark ? "text-white" : "text-foreground",
        )}
      >
        FG<span className="text-accent-strong">POWER</span>
      </span>
    </span>
  );
}
