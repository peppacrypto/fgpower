"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/*
 * The two client pieces of the route skeletons (skeleton.tsx stays a server
 * module; the drawings themselves never ship as JS).
 */

/** How long a skeleton stays up before it is announced: quicker loads stay quiet. */
const ANNOUNCE_AFTER_MS = 250;

/**
 * The "Carregando …" line of a SkeletonScreen. A live region that already
 * holds its text when it is inserted is usually not read out, so the text
 * arrives a moment after the region mounts (and never, if the page beats it).
 */
export function SkeletonAnnouncement({ label }: { label: string }) {
  const [text, setText] = React.useState("");
  React.useEffect(() => {
    const id = window.setTimeout(() => setText(`Carregando ${label}…`), ANNOUNCE_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [label]);
  return <span className="sr-only">{text}</span>;
}

/**
 * A loading.tsx is the fallback for its page AND for every page below it:
 * until a nested page's own boundary has arrived (always on a cold tap; in
 * production whenever its prefetch hasn't landed yet), Next shows the
 * parent's file. So a folder with nested pages draws through this switch. The
 * URL is already the one being opened while the fallback shows, so it picks
 * that page's skeleton, and falls back to the folder's own.
 *
 * `routes` are full paths with one `*` per dynamic segment
 * ("/app/programs/templates/*"); the first match wins, so list literals
 * ("/app/programs/new") before the wildcards that would also match them.
 */
export function NestedSkeleton({
  own,
  routes,
}: {
  own: React.ReactNode;
  routes: [pattern: string, skeleton: React.ReactNode][];
}) {
  const pathname = usePathname();
  const match = routes.findIndex(([pattern]) => matches(pathname, pattern));
  const nested = match !== -1;
  // Standing in for a nested page: show its top, not the list's old scroll
  // position (Next scrolls only once the page's own boundary mounts).
  React.useLayoutEffect(() => {
    if (nested) window.scrollTo(0, 0);
  }, [nested]);
  return <>{nested ? routes[match][1] : own}</>;
}

function matches(pathname: string, pattern: string) {
  const path = pathname.split("/").filter(Boolean);
  const parts = pattern.split("/").filter(Boolean);
  return path.length === parts.length && parts.every((p, i) => p === "*" || p === path[i]);
}
