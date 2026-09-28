/**
 * The theme boot script (W-149, owned by C6): an inline <script> in <head>
 * that reads the per-device cookie `fg-theme` and sets <html data-theme>
 * (and the theme-color metas) before the first paint — never cookies() in
 * the root layout, which would make every page dynamic, the static marketing
 * pages included. globals.css already styles :root[data-theme].
 *
 * Phase 0 stub: renders nothing, so the system theme applies as today.
 */
export function ThemeScript() {
  return null;
}
