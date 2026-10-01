"use client";

import { useEffect, useRef } from "react";
import { markNotificationsSeen } from "@/lib/actions/social";
import { announceUnread } from "@/components/nav/unread-provider";

/**
 * Marks the notifications on screen as seen — once, after the page mounted in
 * the browser (a prefetch or a background render never counts as seen). Only
 * rows up to `upTo`, the newest one rendered: anything that arrived since
 * stays unread. The rows keep their "new" marker for this visit (each line
 * remembers it, through any server re-render); the nav's pip updates at once.
 */
export function MarkSeen({ upTo }: { upTo: string }) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (sent.current === upTo) return;
    sent.current = upTo;
    markNotificationsSeen(upTo)
      .then((result) => {
        if (result.ok) announceUnread(result.unread);
      })
      .catch(() => {
        // Offline: the rows stay unread and the next visit marks them.
      });
  }, [upTo]);
  return null;
}
