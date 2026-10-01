import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint, pushSubscriptionSchema } from "./endpoint";

describe("isAllowedPushEndpoint", () => {
  it("accepts the real push services", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc:APA91b",
      "https://fcm.googleapis.com/wp/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://web.push.apple.com/QK1f3",
      "https://api.push.apple.com/3/device/x",
      "https://wns2-bl2p.notify.windows.com/w/?token=AwYAAAB",
      "https://fcm.googleapis.com:443/fcm/send/x",
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(true);
    }
  });

  it("refuses anything else", () => {
    for (const url of [
      "http://fcm.googleapis.com/fcm/send/x",
      "https://fcm.googleapis.com:8443/fcm/send/x",
      "https://localhost/push",
      "https://127.0.0.1/push",
      "https://[::1]/push",
      "https://169.254.169.254/latest/meta-data",
      "https://web.railway.internal/api",
      "https://evil.com/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.com/x",
      "https://notfcm.googleapis.com/x",
      "https://push.apple.com.evil.com/x",
      "https://user:pass@fcm.googleapis.com/x",
      ".push.apple.com",
      "not a url",
      `https://fcm.googleapis.com/${"a".repeat(2100)}`,
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(false);
    }
  });

  it("checks the keys' shape", () => {
    const ok = {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      expirationTime: null,
      keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) },
    };
    expect(pushSubscriptionSchema.safeParse(ok).success).toBe(true);
    expect(pushSubscriptionSchema.safeParse({ ...ok, keys: { ...ok.keys, p256dh: "B".repeat(40) } }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ ...ok, keys: { ...ok.keys, auth: "a b".repeat(8) } }).success).toBe(false);
    expect(pushSubscriptionSchema.safeParse({ ...ok, endpoint: "https://evil.com/x" }).success).toBe(false);
  });
});
