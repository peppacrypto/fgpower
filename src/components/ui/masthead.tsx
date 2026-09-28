import { cn } from "@/lib/utils/cn";

/**
 * A screen's masthead, the Dossiê way (as on Hoje and Programas): a
 * wide-tracked mono kicker over a display-weight title, then an optional
 * lead line, with an optional action on the right.
 */
export function Masthead({
  kicker,
  title,
  lead,
  action,
  className,
}: {
  kicker: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{kicker}</span>
        <h1 className="text-display mt-1 text-3xl font-extrabold [overflow-wrap:anywhere] sm:text-4xl">{title}</h1>
        {lead ? <p className="mt-1.5 text-sm text-muted">{lead}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
