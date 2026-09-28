import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INSTALL_STORAGE_KEY } from "./install";

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
