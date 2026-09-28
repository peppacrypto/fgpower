import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { SkeletonAnnouncement } from "./skeleton-client";

/*
 * Route skeletons (the loading.tsx files under src/app/app) in the dossier
 * style: each one draws its page's silhouette — same container, same section
 * heads, reg-frame placeholders — so a tap lands on something that already
 * looks like the destination while the server renders it. Bones are
 * --surface-2 bars with a slow sheen (`.sk` in globals.css), still under
 * prefers-reduced-motion. Static labels the page always shows (its title,
 * section heads) are written out; anything that depends on data is a bone.
 *
 * Streaming has a cost: a page under a loading.tsx that ends in notFound()
 * answers 200 (the branded not-found still renders, marked noindex), and a
 * redirect() there happens in the browser. That is why there is no
 * app/app/loading.tsx: the unmatched-URL catch-all and the bare /app redirect
 * keep their real 404/307, and each screen gets its own file instead.
 *
 * A folder's loading.tsx also stands in for the pages nested below it until
 * theirs arrives, so those folders draw through NestedSkeleton
 * (skeleton-client.tsx), which picks the drawing for the URL being opened.
 */

/** One placeholder bar or block. Size it with utilities (h-4 w-24, aspect-square…). */
export function Bone({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("sk rounded-[2px]", className)} {...props} />;
}

/**
 * A route's loading screen: a status region that says "Carregando …" once it
 * has been up for a moment (SkeletonAnnouncement), marked with
 * `data-skeleton` (tests and the tap-feedback probe look for it). The drawing
 * itself is hidden from assistive tech — it holds no content yet.
 */
export function SkeletonScreen({
  label,
  className,
  children,
}: {
  /** What is loading, lower case ("seus programas"). */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" data-skeleton={label} className={className}>
      <SkeletonAnnouncement label={label} />
      <div aria-hidden className="pointer-events-none select-none">
        {children}
      </div>
    </div>
  );
}

/** A page title that never changes (the h1 text), drawn as the page draws it. */
export function SkeletonTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("text-2xl font-bold tracking-tight", className)}>{children}</div>;
}

/** A Masthead (ui/masthead.tsx) while its page loads: the kicker and title as the page draws them. */
export function SkeletonMasthead({ kicker, title, lead = true }: { kicker: string; title: string; lead?: boolean }) {
  return (
    <div>
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{kicker}</span>
      <div className="text-display mt-1 text-3xl font-extrabold sm:text-4xl">{title}</div>
      {lead ? <Bone className="mt-2.5 h-3.5 w-4/5 max-w-md" /> : null}
    </div>
  );
}

/** Text lines: full width, then shorter, like a paragraph's ragged edge. */
export function BoneLines({ lines = 2, className, lineClassName }: { lines?: number; className?: string; lineClassName?: string }) {
  const widths = ["w-full", "w-11/12", "w-4/5", "w-2/3", "w-3/5"];
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-3/5" : widths[i % widths.length], lineClassName)} />
      ))}
    </div>
  );
}

/** A reg-frame list row: a label bone and a short value bone. */
export function BoneRow({ className }: { className?: string }) {
  return (
    <div className={cn("reg-frame flex items-center justify-between gap-4 px-5 py-4", className)}>
      <Bone className="h-4 w-2/5" />
      <Bone className="h-4 w-14" />
    </div>
  );
}

/**
 * A screen without a silhouette of its own (settings, feed, science…): a
 * title, a lead line, a panel and a few rows, in the page's container.
 */
export function PageSkeleton({ label, width = "max-w-3xl" }: { label: string; width?: string }) {
  return (
    <SkeletonScreen label={label} className={cn("mx-auto px-4 py-6 sm:px-6 sm:py-8", width)}>
      <Bone className="h-8 w-44" />
      <Bone className="mt-3 h-3.5 w-3/4" />
      <div className="mt-8 flex flex-col gap-3">
        <div className="reg-frame p-5">
          <Bone className="h-4 w-1/3" />
          <BoneLines lines={2} className="mt-3" />
        </div>
        <BoneRow />
        <BoneRow />
        <BoneRow />
      </div>
    </SkeletonScreen>
  );
}
