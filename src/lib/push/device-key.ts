import "server-only";
import { createHash } from "node:crypto";

/**
 * A device's key: SHA-256 of its push endpoint, base64url. Settings hands
 * the page the keys of the account's devices, so the browser can tell
 * whether ITS subscription is one of them (push-client deviceKeyOf computes
 * the same key) without the page ever holding the endpoints themselves.
 */
export function pushDeviceKey(endpoint: string): string {
  return createHash("sha256").update(endpoint, "utf8").digest("base64url");
}
