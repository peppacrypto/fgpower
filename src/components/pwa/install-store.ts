import { INSTALL_STORAGE_KEY, installMode, parseInstallMemory, type InstallMemory, type InstallMode } from "./install";

/**
 * "Add to home screen" — the browser half: the stashed install dialog, the
 * remembered dismissal and the display mode, as one external store the card
 * reads with useSyncExternalStore.
 */

/** Chromium's install-dialog event (not in lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
/** Mirrors the stored memory for this page's life, so a closed card stays closed when storage throws. */
let sessionMemory: InstallMemory | null = null;
const listeners = new Set<() => void>();
let attached = false;

function emit() {
  for (const l of listeners) l();
}

function readMemory(): InstallMemory | null {
  if (sessionMemory) return sessionMemory;
  try {
    return parseInstallMemory(window.localStorage.getItem(INSTALL_STORAGE_KEY));
  } catch {
    return null; // private mode / blocked storage: the card just asks again next visit
  }
}

export function rememberInstall(memory: InstallMemory) {
  sessionMemory = memory;
  try {
    window.localStorage.setItem(INSTALL_STORAGE_KEY, memory);
  } catch {
    // Remembered for this page's life only.
  }
  emit();
}

const DISPLAY_MODES = ["(display-mode: standalone)", "(display-mode: fullscreen)", "(display-mode: minimal-ui)"];

/** Running from the home-screen icon (Android/desktop display-mode, or iOS's navigator.standalone). */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return typeof window.matchMedia === "function" && DISPLAY_MODES.some((q) => window.matchMedia(q).matches);
}

/**
 * Listens for the install dialog as early as the client bundle loads (the
 * browser may offer it before the card mounts, or on a page without one):
 * stash it — which also keeps Chrome's own mini-infobar away until the app
 * has earned the ask — and forget it once the app is installed. Idempotent.
 */
export function attachInstallListeners() {
  if (attached || typeof window === "undefined") return;
  attached = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    rememberInstall("installed");
  });
  window.addEventListener("storage", (e) => {
    if (e.key === INSTALL_STORAGE_KEY) emit();
  });
  if (typeof window.matchMedia === "function") {
    for (const q of DISPLAY_MODES) window.matchMedia(q).addEventListener?.("change", emit);
  }
}

if (typeof window !== "undefined") attachInstallListeners();

export function subscribeInstall(onChange: () => void) {
  attachInstallListeners();
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** The card's mode on this device right now (a string, so the snapshot is stable). */
export function getInstallMode(): InstallMode | null {
  return installMode({
    standalone: isStandalone(),
    memory: readMemory(),
    hasPrompt: deferredPrompt !== null,
    ua: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  });
}

export function getServerInstallMode(): InstallMode | null {
  return null;
}

/**
 * Opens the browser's install dialog. The event is single-use: whatever the
 * answer, it's spent. "accepted" and "dismissed" are both remembered — a
 * user who said no to the browser's own dialog isn't asked again.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const evt = deferredPrompt;
  if (!evt) return "unavailable";
  deferredPrompt = null;
  try {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    return outcome;
  } catch {
    emit();
    return "unavailable";
  }
}
