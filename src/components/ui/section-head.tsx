import { cn } from "@/lib/utils/cn";

/**
 * A section's header: the section title, then an optional count and action
 * on the right. The label is a real heading (an `<h2>` unless `as` says
 * otherwise), so heading navigation finds every section; the count stays
 * outside it.
 */
export function SectionHead({
  label,
  count,
  className,
  action,
  as: Heading = "h2",
  id,
}: {
  label: string;
  count?: string | number;
  className?: string;
  action?: React.ReactNode;
  /** The label's element: h2 by default, h3 for a section inside another one. */
  as?: "h2" | "h3" | "h4";
  /** For aria-labelledby on the section it heads. */
  id?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-3", className)}>
      {/* min-w-0 + flex-1: on a narrow row a long label wraps instead of
          pushing the count or action off the screen. */}
      <Heading id={id} className="min-w-0 flex-1 text-[17px] font-semibold leading-snug text-foreground">
        {label}
      </Heading>
      {count !== undefined ? (
        <span className="shrink-0 whitespace-nowrap text-[13px] tabular-nums text-muted">{count}</span>
      ) : null}
      {action}
    </div>
  );
}
