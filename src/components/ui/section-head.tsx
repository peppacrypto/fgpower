import { cn } from "@/lib/utils/cn";

/**
 * Editorial section header: a wide-tracked field label, a hairline rule that
 * runs to the edge, and an optional mono count on the right. The recurring
 * structural motif of the app — deliberately not a plain `<h2>`.
 */
export function SectionHead({
  label,
  count,
  className,
  action,
}: {
  label: string;
  count?: string | number;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{label}</span>
      <span className="h-px flex-1 bg-border" />
      {count !== undefined ? (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">{count}</span>
      ) : null}
      {action}
    </div>
  );
}
