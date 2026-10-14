import { describe, expect, it } from "vitest";
import {
  INSTALL_BANNER_SNOOZE_MS,
  installBannerMode,
  installBannerPathAllowed,
  installCardEligible,
  installMode,
  INSTALL_CARD_MIN_WORKOUTS,
  iosBrowser,
  isMobileUa,
  parseBannerClosedAt,
  parseInstallMemory,
} from "./install";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  // iOS 26 froze the OS token at 18_6; Safari's own version moved to 26.
  iosSafari26:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  iosChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  iosEdge:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/126.0.2592.56 Version/17.0 Mobile/15E148 Safari/604.1",
  iosFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15",
  iosInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone14,5; iOS 17_5; pt_BR; pt; scale=3.00; 1170x2532; 614117039)",
  iosFacebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.108;FBBV/620000000;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/pt_BR;FBOP/5]",
  iosGoogleApp:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/320.0.648715581 Mobile/15E148 Safari/604.1",
  // iPadOS Safari asks for the desktop site by default: a Mac UA, told apart by touch.
  macLike:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  desktopChrome:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

describe("iosBrowser", () => {
  it("recognises the iOS browsers that can add to the home screen", () => {
    expect(iosBrowser(UA.iosSafari)).toBe("safari");
    expect(iosBrowser(UA.iosSafari26)).toBe("safari");
    expect(iosBrowser(UA.iosChrome)).toBe("chrome");
    expect(iosBrowser(UA.iosEdge)).toBe("edge");
    expect(iosBrowser(UA.iosFirefox)).toBe("firefox");
  });

  it("gives in-app browsers nothing: their share sheet can't add to the home screen", () => {
    expect(iosBrowser(UA.iosInstagram)).toBeNull();
    expect(iosBrowser(UA.iosFacebook)).toBeNull();
    expect(iosBrowser(UA.iosGoogleApp)).toBeNull();
  });

  it("treats a touch 'Mac' as an iPad, and a real Mac as not iOS", () => {
    expect(iosBrowser(UA.macLike, 5)).toBe("safari");
    expect(iosBrowser(UA.macLike, 0)).toBeNull();
  });

  it("is null off iOS", () => {
    expect(iosBrowser(UA.androidChrome)).toBeNull();
    expect(iosBrowser(UA.desktopChrome)).toBeNull();
  });
});

describe("isMobileUa", () => {
  it("covers phones and tablets, not desktops", () => {
    expect(isMobileUa(UA.iosSafari)).toBe(true);
    expect(isMobileUa(UA.androidChrome)).toBe(true);
    expect(isMobileUa(UA.androidTablet)).toBe(true);
    expect(isMobileUa(UA.macLike, 5)).toBe(true);
    expect(isMobileUa(UA.macLike, 0)).toBe(false);
    expect(isMobileUa(UA.desktopChrome)).toBe(false);
  });
});

describe("installMode", () => {
  const base = { standalone: false, memory: null, hasPrompt: false } as const;

  it("offers the browser's dialog on Android once it was handed over", () => {
    expect(installMode({ ...base, ua: UA.androidChrome, hasPrompt: true })).toBe("prompt");
    // No dialog: usually already installed — instructions there would nag.
    expect(installMode({ ...base, ua: UA.androidChrome })).toBeNull();
  });

  it("offers the two share-sheet steps on iOS, per browser", () => {
    expect(installMode({ ...base, ua: UA.iosSafari })).toBe("ios-safari");
    expect(installMode({ ...base, ua: UA.iosChrome })).toBe("ios-chrome");
    expect(installMode({ ...base, ua: UA.macLike, maxTouchPoints: 5 })).toBe("ios-safari");
    expect(installMode({ ...base, ua: UA.iosInstagram })).toBeNull();
  });

  it("never shows inside the installed app", () => {
    expect(installMode({ ...base, ua: UA.iosSafari, standalone: true })).toBeNull();
    expect(installMode({ ...base, ua: UA.androidChrome, hasPrompt: true, standalone: true })).toBeNull();
  });

  it("stays away once closed or installed on this device", () => {
    expect(installMode({ ...base, ua: UA.iosSafari, memory: "dismissed" })).toBeNull();
    expect(installMode({ ...base, ua: UA.androidChrome, hasPrompt: true, memory: "installed" })).toBeNull();
  });

  it("skips desktops even when the browser offers an install", () => {
    expect(installMode({ ...base, ua: UA.desktopChrome, hasPrompt: true })).toBeNull();
    expect(installMode({ ...base, ua: UA.macLike, hasPrompt: false })).toBeNull();
  });
});

describe("installCardEligible", () => {
  it("waits for the first finished workout", () => {
    expect(INSTALL_CARD_MIN_WORKOUTS).toBe(1);
    expect(installCardEligible(0)).toBe(false);
    expect(installCardEligible(1)).toBe(true);
    expect(installCardEligible(40)).toBe(true);
  });
});

describe("parseInstallMemory", () => {
  it("accepts only the two known values", () => {
    expect(parseInstallMemory("dismissed")).toBe("dismissed");
    expect(parseInstallMemory("installed")).toBe("installed");
    expect(parseInstallMemory("1")).toBeNull();
    expect(parseInstallMemory(null)).toBeNull();
    expect(parseInstallMemory(undefined)).toBeNull();
  });
});

describe("installBannerMode (iOS's entry banner)", () => {
  const NOW = Date.UTC(2026, 9, 14, 12);
  const base = { standalone: false, memory: null, closedAt: null, now: NOW, cardShown: false, pathname: "/" } as const;

  it("asks on the first screen in the iOS browsers that can add to the home screen", () => {
    expect(installBannerMode({ ...base, ua: UA.iosSafari })).toBe("ios-safari");
    expect(installBannerMode({ ...base, ua: UA.iosSafari26 })).toBe("ios-safari");
    expect(installBannerMode({ ...base, ua: UA.iosChrome, pathname: "/app/today" })).toBe("ios-chrome");
    expect(installBannerMode({ ...base, ua: UA.iosEdge, pathname: "/login" })).toBe("ios-edge");
    expect(installBannerMode({ ...base, ua: UA.iosFirefox, pathname: "/u/ana" })).toBe("ios-firefox");
    expect(installBannerMode({ ...base, ua: UA.macLike, maxTouchPoints: 5 })).toBe("ios-safari");
  });

  it("leaves Android to Chrome's own prompt, and skips desktops and in-app browsers", () => {
    expect(installBannerMode({ ...base, ua: UA.androidChrome })).toBeNull();
    expect(installBannerMode({ ...base, ua: UA.androidTablet })).toBeNull();
    expect(installBannerMode({ ...base, ua: UA.desktopChrome })).toBeNull();
    expect(installBannerMode({ ...base, ua: UA.macLike })).toBeNull();
    expect(installBannerMode({ ...base, ua: UA.iosInstagram })).toBeNull();
    expect(installBannerMode({ ...base, ua: UA.iosFacebook })).toBeNull();
    expect(installBannerMode({ ...base, ua: UA.iosGoogleApp })).toBeNull();
  });

  it("never shows inside the installed app, nor once the card was closed or the app installed", () => {
    expect(installBannerMode({ ...base, ua: UA.iosSafari, standalone: true })).toBeNull();
    expect(installBannerMode({ ...base, ua: UA.iosSafari, memory: "dismissed" })).toBeNull();
    expect(installBannerMode({ ...base, ua: UA.iosSafari, memory: "installed" })).toBeNull();
  });

  it("steps aside while an install card is on screen", () => {
    expect(installBannerMode({ ...base, ua: UA.iosSafari, cardShown: true })).toBeNull();
  });

  it("closed, it stays closed for the snooze — a clock set back included — then asks again", () => {
    const day = 86_400_000;
    expect(INSTALL_BANNER_SNOOZE_MS).toBe(90 * day);
    expect(installBannerMode({ ...base, ua: UA.iosSafari, closedAt: NOW })).toBeNull();
    expect(installBannerMode({ ...base, ua: UA.iosSafari, closedAt: NOW - 89 * day })).toBeNull();
    expect(installBannerMode({ ...base, ua: UA.iosSafari, closedAt: NOW + 30 * day })).toBeNull();
    expect(installBannerMode({ ...base, ua: UA.iosSafari, closedAt: NOW - 90 * day })).toBe("ios-safari");
  });

  it("stays off the live workout, the onboarding, the e-mail sign-in hand-off and the admin", () => {
    expect(installBannerMode({ ...base, ua: UA.iosSafari, pathname: "/app/workout/abc" })).toBeNull();
    expect(installBannerMode({ ...base, ua: UA.iosSafari, pathname: "/onboarding" })).toBeNull();
    // The summary keeps the nav (and its own card decides there).
    expect(installBannerMode({ ...base, ua: UA.iosSafari, pathname: "/app/workout/abc/summary" })).toBe("ios-safari");
  });
});

describe("installBannerPathAllowed", () => {
  it("allows the entry screens and the app's tabs", () => {
    for (const p of ["/", "/login", "/programs", "/programs/gd-1", "/exercises", "/u/ana", "/t/x", "/app/today", "/app/progress"]) {
      expect(installBannerPathAllowed(p), p).toBe(true);
    }
  });

  it("refuses the focused flows, matching whole segments only", () => {
    for (const p of ["/app/workout/abc", "/onboarding", "/onboarding/step", "/admin", "/admin/reports", "/email/cancelar", "/login/link"]) {
      expect(installBannerPathAllowed(p), p).toBe(false);
    }
    expect(installBannerPathAllowed("/administrar")).toBe(true);
    expect(installBannerPathAllowed("/login/linked")).toBe(true);
  });
});

describe("parseBannerClosedAt", () => {
  it("reads back a stored timestamp and nothing else", () => {
    expect(parseBannerClosedAt("1760443200000")).toBe(1760443200000);
    expect(parseBannerClosedAt("dismissed")).toBeNull();
    expect(parseBannerClosedAt("-1")).toBeNull();
    expect(parseBannerClosedAt("1e12")).toBeNull();
    expect(parseBannerClosedAt("")).toBeNull();
    expect(parseBannerClosedAt(null)).toBeNull();
    expect(parseBannerClosedAt(undefined)).toBeNull();
  });
});
