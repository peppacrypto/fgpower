import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import { InlineScript } from "./inline-script";

/**
 * The theme boot script (W-149): an inline <script> in <head> that reads the
 * per-device cookie `fg-theme` and sets <html data-theme> (and the
 * theme-color metas) before the first paint — never cookies() in the root
 * layout, which would make every page dynamic, the static marketing pages
 * included. globals.css already styles :root[data-theme]; <html> carries
 * suppressHydrationWarning, so React keeps the attribute the script set.
 * It runs once, from the server's HTML: the copy React renders on the client
 * is an inert data block (InlineScript), so it never runs twice and React has
 * no script tag to warn about.
 */
export function ThemeScript() {
  return <InlineScript html={THEME_BOOT_SCRIPT} />;
}
