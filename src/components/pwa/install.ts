import { isWorkoutFocusPath } from "./resume";

/**
 * "Add to home screen" — the pure half: which install path this device has
 * and whether the card (and iOS's entry banner) should show. No window access here (see install-store
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

/**
 * The entry banner — iOS's stand-in for the install prompt Chrome shows by
 * itself on Android. Safari never offers to install, so without it an iPhone
 * user only meets the ask after a finished workout (the card above).
 */
export const INSTALL_BANNER_STORAGE_KEY = "fg:install-banner";

/** Closed, it stays closed this long on the device (Chrome's own prompt waits about as much). */
export const INSTALL_BANNER_SNOOZE_MS = 90 * 86_400_000;

/** The value stored when the banner is closed: when it was. */
export function parseBannerClosedAt(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,15}$/.test(raw)) return null;
  return Number(raw);
}

/**
 * Screens the banner stays off: the live workout (focus mode, its own
 * bottom bar), the onboarding wizard, the e-mail sign-in hand-off, the
 * e-mail pages and the admin.
 */
export function installBannerPathAllowed(pathname: string): boolean {
  if (isWorkoutFocusPath(pathname)) return false;
  return !/^\/(onboarding|admin|email|login\/link)(\/|$)/.test(pathname);
}

/**
 * The banner's mode (the iOS browser it explains), or null. iOS only: on
 * Android, Chrome shows its own prompt and the card opens the real dialog.
 * Off when the app runs from the home screen, once the card was closed or
 * the app installed (InstallMemory), within the snooze after the banner was
 * closed, on the screens above, and while an install card is on screen —
 * one ask at a time.
 */
export function installBannerMode(input: {
  standalone: boolean;
  memory: InstallMemory | null;
  closedAt: number | null;
  now: number;
  cardShown: boolean;
  pathname: string;
  ua: string;
  maxTouchPoints?: number;
}): Exclude<InstallMode, "prompt"> | null {
  if (input.standalone || input.memory || input.cardShown) return null;
  // Either side of now: a clock set back doesn't bring it back early.
  if (input.closedAt !== null && Math.abs(input.now - input.closedAt) < INSTALL_BANNER_SNOOZE_MS) return null;
  if (!installBannerPathAllowed(input.pathname)) return null;
  const ios = iosBrowser(input.ua, input.maxTouchPoints ?? 0);
  return ios ? `ios-${ios}` : null;
}
