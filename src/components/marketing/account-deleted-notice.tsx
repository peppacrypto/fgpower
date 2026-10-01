"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * "Sua conta foi excluída…" on the landing after a deletion (W-151), which
 * lands on /?conta=excluida. Read from the URL in an effect — the landing
 * never reads its query on the server for this — and the parameter is
 * dropped from the address bar, so a reload or a shared link doesn't repeat it.
 */
export function AccountDeletedNotice() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("conta") !== "excluida") return;
    url.searchParams.delete("conta");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only readable after mount
    setShown(true);
  }, []);

  return (
    <div role="status" aria-live="polite" className={shown ? "border-b border-white/10 bg-white/[0.04]" : "sr-only"}>
      {shown ? (
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <p className="text-sm text-white/85">Sua conta foi excluída e seus dados foram apagados.</p>
          <button
            type="button"
            onClick={() => setShown(false)}
            aria-label="Fechar aviso"
            className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center text-white/60 hover:text-white"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
