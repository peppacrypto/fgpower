"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Drops one-time notice params (?descartado=1, ?ativado=1…) from the address
 * bar once Today has rendered them, so a reload or a later visit doesn't show
 * "Treino descartado." again. The notice itself stays until the user leaves.
 * Keyed on the search params: Today can land on itself with a new notice
 * (e.g. after "Salvar como feito em …") without remounting this.
 */
export function ClearParams({ keys }: { keys: string[] }) {
  const search = useSearchParams().toString();
  const joined = keys.join(",");
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of joined.split(",")) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [joined, search]);
  return null;
}
