/** macOS-style browser chrome wrapper for showcasing real product UI — the classic traffic-light-dot pattern. */
export function BrowserFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface shadow-md">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-danger/70" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-success/70" />
        </div>
        <div className="mx-auto flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[11px] text-muted">
          <span className="size-2 rounded-full bg-success" />
          {title}
        </div>
      </div>
      <div className="bg-background">{children}</div>
    </div>
  );
}
