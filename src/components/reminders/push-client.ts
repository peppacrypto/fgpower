"use client";

import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import { iosBrowser } from "@/components/pwa/install";
import { isStandalone } from "@/components/pwa/install-store";

/**
 * The browser half of Web Push reminders (W-017): what this device can do,
 * and turning it on or off. Permission is only ever asked from a tap (the
 * post-workout ask, the Settings switch) — iOS requires the gesture, and
 * decision 8 forbids asking on load.
 */

export type PushSupport = "unsupported" | "ios-needs-install" | "denied" | "default" | "granted";

export type EnableResult =
  | { ok: true; devices: number }
  | { ok: false; reason: "denied" | "dismissed" | "unsupported" | "failed" | "offline" | "session" | "locked"; message?: string };

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  // iPhone/iPad: Web Push exists only inside the app added to the home screen (iOS 16.4+).
  if (isIos() && !isStandalone()) {
    return iosBrowser(navigator.userAgent, navigator.maxTouchPoints ?? 0) ? "ios-needs-install" : "unsupported";
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" ? "granted" : "default";
}

/** For useSyncExternalStore: the permission can change in another tab or in the site settings. */
export function subscribePushSupport(onChange: () => void) {
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/**
 * The key the server knows a device by (lib/push/device-key: SHA-256 of the
 * endpoint, base64url), or null when it can't be computed here.
 */
export async function deviceKeyOf(endpoint: string): Promise<string | null> {
  try {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)));
    let binary = "";
    for (const byte of digest) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return null;
  }
}

/**
 * Whether this browser is one of the account's subscribed devices: its own
 * subscription, not merely any — one left by another account on this
 * browser, or turned off from another device, doesn't count.
 */
export async function isThisDeviceSubscribed(deviceKeys: readonly string[]): Promise<boolean> {
  const subscription = await currentSubscription();
  if (!subscription) return false;
  const key = await deviceKeyOf(subscription.endpoint);
  return key != null && deviceKeys.includes(key);
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64url}${"=".repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

const offline = () => navigator.onLine === false;

/**
 * Asks for permission FIRST (inside the tap), then subscribes this browser
 * with the server's key and saves it. The worker is registered on demand:
 * outside production it isn't registered on load.
 */
export async function enablePush(vapidPublicKey: string): Promise<EnableResult> {
  const support = pushSupport();
  if (support === "unsupported" || support === "ios-needs-install") return { ok: false, reason: "unsupported" };
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return { ok: false, reason: "failed" };
  }
  if (permission === "denied") return { ok: false, reason: "denied" };
  if (permission !== "granted") return { ok: false, reason: "dismissed" };

  let subscription: PushSubscription;
  try {
    const registration =
      (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const key = keyBytes(vapidPublicKey);
    let existing = await registration.pushManager.getSubscription();
    // Subscribed with another key (keys rotated): start over.
    if (existing && !sameKey(existing.options.applicationServerKey, key)) {
      await existing.unsubscribe().catch(() => undefined);
      existing = null;
    }
    subscription = existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
  } catch {
    return { ok: false, reason: offline() ? "offline" : "failed" };
  }

  try {
    const res = await fetch("/api/push/subscriptions", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    const body = (await res.json().catch(() => ({}))) as { devices?: number; error?: string };
    if (res.ok) return { ok: true, devices: body.devices ?? 1 };
    if (res.status === 401) return { ok: false, reason: "session", message: SESSION_EXPIRED_ERROR };
    if (res.status === 409) return { ok: false, reason: "locked", message: body.error };
    return { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: offline() ? "offline" : "failed" };
  }
}

/** Off for this browser, or for every device of the account. */
export async function disablePush(scope: "device" | "all"): Promise<{ ok: true; devices: number } | { ok: false; reason: "offline" | "failed" | "session" }> {
  const subscription = await currentSubscription();
  try {
    let devices = 0;
    if (scope === "all" || subscription) {
      const res = await fetch("/api/push/subscriptions", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(scope === "all" ? { all: true } : { endpoint: subscription!.endpoint }),
      });
      if (res.status === 401) return { ok: false, reason: "session" };
      if (!res.ok) return { ok: false, reason: "failed" };
      devices = ((await res.json().catch(() => ({}))) as { devices?: number }).devices ?? 0;
    }
    await subscription?.unsubscribe().catch(() => undefined);
    return { ok: true, devices };
  } catch {
    return { ok: false, reason: offline() ? "offline" : "failed" };
  }
}

/** pt-BR for a failed enable (the switch and the ask). */
export function enableErrorText(result: Extract<EnableResult, { ok: false }>): string {
  switch (result.reason) {
    case "denied":
      return "Notificações bloqueadas neste navegador. Dá para liberar nas configurações do site.";
    case "dismissed":
      return "Sem a permissão do navegador não dá para lembrar você. Tente de novo quando quiser.";
    case "unsupported":
      return "Este navegador não recebe notificações.";
    case "offline":
      return "Sem conexão. Tente de novo quando o sinal voltar.";
    case "session":
      return SESSION_EXPIRED_ERROR;
    case "locked":
      return result.message ?? "Disponível depois do seu primeiro treino.";
    default:
      return "Não foi possível ativar agora. Tente de novo.";
  }
}
