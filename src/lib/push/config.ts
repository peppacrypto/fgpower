import "server-only";

/**
 * Which Web Push transport this process uses (W-017):
 * - "webpush": VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and a valid VAPID_SUBJECT
 *   are set (no external account: the pair comes from
 *   `npx web-push generate-vapid-keys`);
 * - "dev": outside production without them — nothing leaves the machine,
 *   the payload is logged and kept on the delivery row;
 * - "off": PUSH_TRANSPORT=off, or production without keys (never "dev" in
 *   production). Off, the reminder switch and the ask are hidden.
 * The public key reaches the page as a prop, read per request.
 */
export type PushTransport = "webpush" | "dev" | "off";

export interface VapidDetails {
  subject: string;
  publicKey: string;
  privateKey: string;
}

export function vapidDetails(): VapidDetails | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  // web-push refuses anything else (and throws where it would be sent).
  if (!/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(subject)) return null;
  return { subject, publicKey, privateKey };
}

export function pushTransport(): PushTransport {
  const forced = process.env.PUSH_TRANSPORT?.trim().toLowerCase();
  if (forced === "off") return "off";
  const production = process.env.NODE_ENV === "production";
  if (forced === "dev" && !production) return "dev";
  if (vapidDetails()) return "webpush";
  return production ? "off" : "dev";
}

/** The key browsers subscribe with, when a real one exists (the dev transport has none to give). */
export function vapidPublicKey(): string | null {
  return pushTransport() === "off" ? null : (vapidDetails()?.publicKey ?? null);
}

/** Push can be turned on from this server: a transport, and a key for the browser to subscribe with. */
export function pushAvailable(): boolean {
  return vapidPublicKey() !== null;
}
