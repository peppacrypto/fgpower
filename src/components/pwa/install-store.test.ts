import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INSTALL_BANNER_SNOOZE_MS, INSTALL_BANNER_STORAGE_KEY, INSTALL_STORAGE_KEY } from "./install";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

/** A minimal browser: events, storage (optionally throwing), display-mode queries. */
function fakeBrowser(opts: { ua: string; standalone?: boolean; storage?: "ok" | "throws" }) {
  const win = new EventTarget() as EventTarget & Record<string, unknown>;
  const store = new Map<string, string>();
  const denied = () => {
    throw new DOMException("denied", "SecurityError");
  };
  win.localStorage =
    opts.storage === "throws"
      ? { getItem: denied, setItem: denied, removeItem: denied }
      : {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => void store.set(k, v),
          removeItem: (k: string) => void store.delete(k),
        };
  win.matchMedia = (q: string) => ({
    matches: Boolean(opts.standalone) && q === "(display-mode: standalone)",
    addEventListener: () => {},
  });
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", { userAgent: opts.ua, maxTouchPoints: 0 });
  return { win, store };
}

/** Chromium's install dialog event, answering `outcome`. */
function installEvent(outcome: "accepted" | "dismissed") {
  const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & Record<string, unknown>;
  e.prompt = vi.fn(async () => {});
  e.userChoice = Promise.resolve({ outcome, platform: "web" });
  return e;
}

async function loadStore() {
  vi.resetModules();
  return import("./install-store");
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("install-store", () => {
  it("stashes the browser's dialog (suppressing its own banner) and offers it", async () => {
    const { win } = fakeBrowser({ ua: ANDROID });
    const s = await loadStore();
    const onChange = vi.fn();
    s.subscribeInstall(onChange);
    expect(s.getInstallMode()).toBeNull();

    const e = installEvent("accepted");
    win.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenCalled();
    expect(s.getInstallMode()).toBe("prompt");

    expect(await s.promptInstall()).toBe("accepted");
    expect(e.prompt).toHaveBeenCalledOnce();
    // Single-use: spent whatever the answer.
    expect(await s.promptInstall()).toBe("unavailable");
  });

  it("remembers a dismissal on the device", async () => {
    const { store } = fakeBrowser({ ua: IPHONE });
    const s = await loadStore();
    expect(s.getInstallMode()).toBe("ios-safari");
    s.rememberInstall("dismissed");
    expect(store.get(INSTALL_STORAGE_KEY)).toBe("dismissed");
    expect(s.getInstallMode()).toBeNull();

    // A new page load (fresh module, same device storage) reads it back.
    expect((await loadStore()).getInstallMode()).toBeNull();
  });

  it("keeps a closed card closed for the page's life when storage throws", async () => {
    fakeBrowser({ ua: IPHONE, storage: "throws" });
    const s = await loadStore();
    expect(s.getInstallMode()).toBe("ios-safari");
    expect(() => s.rememberInstall("dismissed")).not.toThrow();
    expect(s.getInstallMode()).toBeNull();
  });

  it("hides in the installed app and after an install from the browser menu", async () => {
    fakeBrowser({ ua: IPHONE, standalone: true });
    expect((await loadStore()).getInstallMode()).toBeNull();

    const { win, store } = fakeBrowser({ ua: ANDROID });
    const s = await loadStore();
    win.dispatchEvent(installEvent("dismissed"));
    expect(s.getInstallMode()).toBe("prompt");
    win.dispatchEvent(new Event("appinstalled"));
    expect(store.get(INSTALL_STORAGE_KEY)).toBe("installed");
    expect(s.getInstallMode()).toBeNull();
  });

  it("reports the user's answer to the dialog", async () => {
    const { win } = fakeBrowser({ ua: ANDROID });
    const s = await loadStore();
    win.dispatchEvent(installEvent("dismissed"));
    expect(await s.promptInstall()).toBe("dismissed");
  });

  it("is inert on the server", async () => {
    const s = await loadStore();
    expect(s.getServerInstallMode()).toBeNull();
  });
});

describe("install-store: iOS's entry banner", () => {
  it("asks on iOS from the first screen; never on Android, where Chrome has its own prompt", async () => {
    fakeBrowser({ ua: IPHONE });
    expect((await loadStore()).getInstallBannerMode("/")).toBe("ios-safari");

    fakeBrowser({ ua: ANDROID });
    expect((await loadStore()).getInstallBannerMode("/")).toBeNull();
  });

  it("remembers its close on the device for the snooze, and only its own", async () => {
    const { store } = fakeBrowser({ ua: IPHONE });
    const s = await loadStore();
    const onChange = vi.fn();
    s.subscribeInstall(onChange);
    s.closeInstallBanner(Date.now());
    expect(onChange).toHaveBeenCalled();
    expect(s.getInstallBannerMode("/")).toBeNull();
    expect(Number(store.get(INSTALL_BANNER_STORAGE_KEY))).toBeGreaterThan(0);
    // The card (after a workout) is a different ask: still offered.
    expect(s.getInstallMode()).toBe("ios-safari");

    // A new page load reads it back…
    expect((await loadStore()).getInstallBannerMode("/")).toBeNull();
    // …until the snooze is over.
    store.set(INSTALL_BANNER_STORAGE_KEY, String(Date.now() - INSTALL_BANNER_SNOOZE_MS - 1));
    expect((await loadStore()).getInstallBannerMode("/")).toBe("ios-safari");
  });

  it("goes for good with the card's close (or an install)", async () => {
    const { store } = fakeBrowser({ ua: IPHONE });
    const s = await loadStore();
    s.rememberInstall("dismissed");
    expect(s.getInstallBannerMode("/")).toBeNull();
    store.set(INSTALL_STORAGE_KEY, "installed");
    expect((await loadStore()).getInstallBannerMode("/")).toBeNull();
  });

  it("keeps a closed banner closed for the page's life when storage throws", async () => {
    fakeBrowser({ ua: IPHONE, storage: "throws" });
    const s = await loadStore();
    expect(s.getInstallBannerMode("/")).toBe("ios-safari");
    expect(() => s.closeInstallBanner()).not.toThrow();
    expect(s.getInstallBannerMode("/")).toBeNull();
  });

  it("waits while an install card is on screen, and comes back when it leaves", async () => {
    fakeBrowser({ ua: IPHONE });
    const s = await loadStore();
    const onChange = vi.fn();
    s.subscribeInstall(onChange);
    const leaveA = s.showingInstallCard();
    const leaveB = s.showingInstallCard();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(s.getInstallBannerMode("/app/today")).toBeNull();
    leaveA();
    leaveA(); // a repeated goodbye counts once
    expect(s.getInstallBannerMode("/app/today")).toBeNull();
    leaveB();
    expect(s.getInstallBannerMode("/app/today")).toBe("ios-safari");
  });

  it("never shows inside the installed app, nor on the live workout", async () => {
    fakeBrowser({ ua: IPHONE, standalone: true });
    expect((await loadStore()).getInstallBannerMode("/")).toBeNull();
    fakeBrowser({ ua: IPHONE });
    expect((await loadStore()).getInstallBannerMode("/app/workout/abc")).toBeNull();
  });
});
