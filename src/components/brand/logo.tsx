import { cn } from "@/lib/utils/cn";

/** Square "FG" monogram — used as the compact mark (nav, favicon-adjacent contexts). */
export function Logomark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="FGPOWER"
    >
      <rect width="32" height="32" rx="8" className="fill-[#0A0A0B]" />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fontFamily="var(--font-sans), Arial, sans-serif"
        fontWeight={800}
        fontSize={15}
        letterSpacing="-0.5"
        className="fill-[#CDFF4D]"
      >
        FG
      </text>
    </svg>
  );
}

/** Full "FGPOWER" wordmark lockup: logomark + typographic name. */
export function Wordmark({ className, iconSize = 28 }: { className?: string; iconSize?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <Logomark size={iconSize} />
      <span className="text-[17px] font-extrabold tracking-tight text-foreground">
        FG<span className="text-accent">POWER</span>
      </span>
    </span>
  );
}
