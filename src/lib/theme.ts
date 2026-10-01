/**
 * The app's theme choice (W-149, Settings → Aparência): "system" follows the
 * phone, "light"/"dark" force one. Kept per device in the `fg-theme` cookie —
 * never on the server: the root layout must not read cookies() (every page,
 * the static marketing ones included, would turn dynamic). An inline script
 * (THEME_BOOT_SCRIPT, rendered by <ThemeScript/> in <head>) reads the cookie
 * while the HTML is parsed and sets <html data-theme>, which globals.css
 * already styles, before the first paint. Plain module: the settings page
 * reads the cookie server-side to render the control, the client applies it.
 */

export const THEME_COOKIE = "fg-theme";
export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** --background of each theme (globals.css): the browser chrome's color. */
export const THEME_COLORS = { light: "#fafafb", dark: "#0b0c0e" } as const;

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** The stored choice from a cookie value; anything else is "system". */
export function parseThemeChoice(value: string | null | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * Runs as the <head> is parsed: the forced theme on <html> and on every
 * theme-color meta (both media-bound metas take the forced color, so the
 * status bar matches the page). Plain ES5 in a try/catch: a blocked cookie
 * jar or an old browser leaves the system theme, never an error.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)/);if(!m)return;var t=m[1];document.documentElement.setAttribute("data-theme",t);var c=t==="dark"?"${THEME_COLORS.dark}":"${THEME_COLORS.light}";var ms=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<ms.length;i++)ms[i].setAttribute("content",c)}catch(e){}})();`;

/** This device's stored choice (client only). */
export function readThemeChoice(): ThemeChoice {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)`));
    return parseThemeChoice(m?.[1]);
  } catch {
    return "system";
  }
}

/**
 * The theme-color metas back to their own media's color ("system"), or all
 * of them to the forced theme's.
 */
function paintThemeColor(choice: ThemeChoice) {
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  metas.forEach((meta) => {
    const media = meta.getAttribute("media") ?? "";
    const color = choice !== "system" ? THEME_COLORS[choice] : /dark/.test(media) ? THEME_COLORS.dark : THEME_COLORS.light;
    // Only a real change is written: ThemeSync watches these metas, so a no-op write would echo.
    if (meta.getAttribute("content") !== color) meta.setAttribute("content", color);
  });
}

/** Shows `choice` on this page now (no storage). */
export function paintTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  paintThemeColor(choice);
}

/** Applies `choice` at once and keeps it on this device (a year; "system" clears it). */
export function applyTheme(choice: ThemeChoice) {
  paintTheme(choice);
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      choice === "system"
        ? `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
        : `${THEME_COOKIE}=${choice}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  } catch {
    /* cookies blocked — the choice holds for this page only */
  }
}
