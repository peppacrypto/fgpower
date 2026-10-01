import { afterEach, describe, expect, it, vi } from "vitest";
import { pushDeviceKey } from "@/lib/push/device-key";
import { deviceKeyOf, isThisDeviceSubscribed } from "./push-client";

/** A browser whose worker registration holds `endpoint` (or no subscription). */
function browserWith(endpoint: string | null) {
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: async () => ({
        pushManager: { getSubscription: async () => (endpoint ? { endpoint } : null) },
      }),
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

const FCM = "https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bE-abc_123";
const APPLE = "https://web.push.apple.com/QGr2x0mJ6Z4-sample/token";

describe("which device this browser is", () => {
  it("the browser's key is the server's key (SHA-256 of the endpoint, base64url)", async () => {
    for (const endpoint of [FCM, APPLE, "https://updates.push.services.mozilla.com/wpush/v2/gAAAAA=="]) {
      expect(await deviceKeyOf(endpoint)).toBe(pushDeviceKey(endpoint));
    }
    expect(pushDeviceKey(FCM)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("only this browser's own subscription counts — not one the account no longer has, or another account's", async () => {
    const accountDevices = [pushDeviceKey(FCM)];
    browserWith(FCM);
    expect(await isThisDeviceSubscribed(accountDevices)).toBe(true);
    // A subscription left on this browser (turned off from another device, or another account's).
    browserWith(APPLE);
    expect(await isThisDeviceSubscribed(accountDevices)).toBe(false);
    browserWith(null);
    expect(await isThisDeviceSubscribed(accountDevices)).toBe(false);
    browserWith(FCM);
    expect(await isThisDeviceSubscribed([])).toBe(false);
  });
});
