/**
 * The grab handle on top of a workout bottom sheet (finish, RIR, technique,
 * swap, delete): it says "this rises from the bottom and goes back down" on a
 * phone. Decorative — Escape, a tap outside or the sheet's own buttons close
 * it. From `sm` up the sheet is a centered dialog, so the handle goes away.
 */
export function SheetGrip({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`mx-auto mb-3 block h-1 w-10 shrink-0 rounded-full bg-[var(--border-strong)] sm:hidden${className ? ` ${className}` : ""}`}
    />
  );
}
