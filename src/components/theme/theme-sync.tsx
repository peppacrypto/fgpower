"use client";

import { useEffect, useLayoutEffect } from "react";
import { paintTheme, readThemeChoice } from "@/lib/theme";

/**
 * Keeps the device's forced theme on the page (W-149). After hydration it
 * re-applies the choice — dev Strict Mode resets <html> attributes on its
 * remount, and Next may insert the theme-color metas after the boot script
 * ran — before paint, so nothing flashes. Then, while a theme is forced, it
 * watches <head>: a client navigation makes Next write its theme-color metas
 * again (the status bar would go back to the phone's theme). A no-op for the
 * system theme.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    const choice = readThemeChoice();
    if (choice !== "system") paintTheme(choice);
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      // Read each time: Settings → Aparência may have just changed it.
      const choice = readThemeChoice();
      if (choice !== "system") paintTheme(choice);
    });
    observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] });
    return () => observer.disconnect();
  }, []);

  return null;
}
