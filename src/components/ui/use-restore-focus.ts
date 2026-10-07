"use client";

import { useEffect, useState } from "react";

/**
 * Restore focus to the element that opened a dialog when the dialog unmounts.
 *
 * A native <dialog> restores focus itself on dialog.close(), but these sheets
 * are unmounted by their parent without a close() call, so focus falls to
 * <body> (WCAG 2.4.3). The trigger is captured during render — before the
 * sheet's own effect calls showModal()/.focus() and moves focus inside — and
 * refocused after a frame, once the dialog has left the DOM and the page is no
 * longer inert. Call it near the top of a dialog/sheet component. SSR-safe.
 *
 * Not for cases where the trigger is unmounted while the dialog is open (e.g.
 * a menu item that closes its menu to open a dialog): capture the trigger with
 * a ref there and refocus it in requestAnimationFrame instead.
 */
export function useRestoreFocus() {
  const [trigger] = useState(() => (typeof document === "undefined" ? null : document.activeElement));
  useEffect(
    () => () => {
      if (trigger instanceof HTMLElement && trigger.isConnected)
        requestAnimationFrame(() => {
          // Only restore when focus fell to nowhere (the WCAG 2.4.3 case this fixes).
          // If the sheet was closed by an action that moved focus on purpose — "Revisar"
          // to the incomplete field, a swap to the new exercise's name — don't steal it.
          const active = document.activeElement;
          if (active === null || active === document.body) trigger.focus();
        });
    },
    [trigger],
  );
}
