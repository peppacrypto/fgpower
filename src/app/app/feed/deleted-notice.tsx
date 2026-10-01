"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Publicação excluída" on the feed, after "Excluir publicação" sent the user
 * here with ?excluida=1 (W-143). The param leaves the address bar at once, so
 * a reload or the next visit doesn't say it again. The notice is client state
 * from the first render: a server re-render of the feed without the param (an
 * FG on a card, better-auth's session refresh) keeps it until the user leaves
 * (recovery R5). Rendered on every feed render, so that re-render finds it.
 * The confirm that led here is gone, and focus with it: the notice takes it,
 * so a screen reader says it (a live region that arrives already filled may
 * stay silent) and the next Tab goes on into the feed.
 */
export function DeletedNotice({ show }: { show: boolean }) {
  const [shown] = useState(show);
  const notice = useRef<HTMLParagraphElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!show) return;
    const from = document.activeElement;
    if (from === null || from === document.body) notice.current?.focus({ preventScroll: true });
    const url = new URL(window.location.href);
    if (!url.searchParams.has("excluida")) return;
    url.searchParams.delete("excluida");
    // Through the router, not history.replaceState: Next writes its own URL back on the feed's next
    // server re-render (an FG on a card), which brought ?excluida=1 back. The page re-renders in
    // place (no remount), so the notice stays.
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }, [show, router]);

  if (!shown) return null;
  return (
    <p
      ref={notice}
      role="status"
      tabIndex={-1}
      className="mt-6 border-l-2 border-l-accent bg-surface-2 px-3.5 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      Publicação excluída. O treino continua no histórico.
    </p>
  );
}
