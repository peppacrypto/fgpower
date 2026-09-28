/**
 * "Add to home screen" — the pure half: which install path this device has
 * and whether the card should show. No window access here (see install-store
 * for the browser side), so it runs in vitest.
 */

/** The card waits until the app has earned it: one finished workout. */
export const INSTALL_CARD_MIN_WORKOUTS = 1;

/** localStorage key; the value is an InstallMemory. */
export const INSTALL_STORAGE_KEY = "fg:install-card";

/** What this device remembers about the card: closed by the user, or the app got installed. */
export type InstallMemory = "dismissed" | "installed";

export function parseInstallMemory(raw: string | null | undefined): InstallMemory | null {
  return raw === "dismissed" || raw === "installed" ? raw : null;
}

/**
 * iOS browsers that can put a web app on the home screen through their share
 * sheet (Safari always; Chrome, Edge and Firefox since iOS 16.4). In-app
 * browsers (Instagram, Facebook, WhatsApp…) can't, so they get no card.
 */
export type IosBrowser = "safari" | "chrome" | "edge" | "firefox";

/**
 * The iOS browser behind this user agent, or null when it isn't iOS or can't
 * add to the home screen. iPadOS Safari reports a Mac user agent: a Mac with
 * a touch screen is an iPad.
 */
export function iosBrowser(ua: string, maxTouchPoints = 0): IosBrowser | null {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (!ios) return null;
  if (/CriOS\//.test(ua)) return "chrome";
  if (/EdgiOS\//.test(ua)) return "edge";
  if (/FxiOS\//.test(ua)) return "firefox";
  // Real Safari carries "Version/x Mobile/y Safari/z"; WKWebView in-app
  // browsers drop the Safari token (and usually add their own: FBAN, Instagram…).
  if (/Version\/[\d.]+.*Safari\//.test(ua) && !/FBAN|FBAV|Instagram|Line\/|GSA\/|WhatsApp|Twitter|LinkedInApp/.test(ua)) {
    return "safari";
  }
  return null;
}

/** Phones and tablets only: on a desktop "tela inicial" means nothing. */
export function isMobileUa(ua: string, maxTouchPoints = 0): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

/**
 * The install path the card offers, if any:
 * - "prompt": the browser handed us its install dialog (beforeinstallprompt:
 *   Chrome/Edge/Samsung on Android) — one button opens it;
 * - "ios-<browser>": no dialog exists on iOS — two short steps instead;
 * - null: nothing to offer (already installed, desktop, in-app browser, or
 *   an Android browser that didn't offer — typically because the app is
 *   already installed, so instructions there would nag).
 */
export type InstallMode = "prompt" | `ios-${IosBrowser}`;

export function installMode(input: {
  standalone: boolean;
  memory: InstallMemory | null;
  hasPrompt: boolean;
  ua: string;
  maxTouchPoints?: number;
}): InstallMode | null {
  if (input.standalone || input.memory) return null;
  const touch = input.maxTouchPoints ?? 0;
  if (!isMobileUa(input.ua, touch)) return null;
  const ios = iosBrowser(input.ua, touch);
  if (ios) return `ios-${ios}`;
  return input.hasPrompt ? "prompt" : null;
}

/** Whether the card shows at all, given the page's count of finished workouts. */
export function installCardEligible(finishedWorkouts: number): boolean {
  return finishedWorkouts >= INSTALL_CARD_MIN_WORKOUTS;
}
