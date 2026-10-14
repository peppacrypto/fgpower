import { cn } from "@/lib/utils/cn";

/**
 * A screen's masthead (as on Hoje and Programas): a small muted kicker over
 * the page title, then an optional lead line, with an optional action on the
 * right.
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
        <span className="eyebrow">{kicker}</span>
        <h1 className="text-display mt-0.5 text-[1.75rem] font-semibold leading-tight [overflow-wrap:anywhere] sm:text-[2rem]">{title}</h1>
        {lead ? <p className="mt-1.5 text-[15px] text-muted">{lead}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
