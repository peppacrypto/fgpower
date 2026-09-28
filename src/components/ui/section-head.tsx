import { cn } from "@/lib/utils/cn";

/**
 * Editorial section header: a wide-tracked field label, a hairline rule that
 * runs to the edge, and an optional mono count on the right. The recurring
 * structural motif of the app. The label is a real heading (an `<h2>` unless
 * `as` says otherwise) styled as a field label, so heading navigation finds
 * every section; the rule and the count stay outside it.
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
    <div className={cn("flex items-center gap-4", className)}>
      {/* min-w-0: on a narrow row a long label wraps (the rule gives way first)
          instead of pushing the count or action off the screen. */}
      <Heading id={id} className="min-w-0 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
        {label}
      </Heading>
      <span aria-hidden className="h-px flex-1 bg-border" />
      {count !== undefined ? (
        <span className="shrink-0 whitespace-nowrap font-mono text-[11px] tabular-nums text-muted">{count}</span>
      ) : null}
      {action}
    </div>
  );
}
