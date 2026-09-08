import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/** The metallic FG monogram tile — the compact mark (nav, favicon-adjacent contexts). */
export function Logomark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/fgpower-tile.png"
      alt="FGPOWER"
      width={size}
      height={size}
      className={cn("rounded-[22%]", className)}
      priority
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
      <Logomark size={iconSize} />
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
