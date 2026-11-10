"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { currentSubscription, type PushSupport } from "@/components/reminders/push-client";
import type { RestTimer } from "./rest-timer";

/**
 * The end-of-rest notification, the page's half (the server's is
 * lib/push/rest-alert). A locked iPhone runs none of the page's timers, and
 * an iPhone browser often can't beep at all (rest-audio), so when this device
 * has notifications on, the start of a rest asks the server to push one at
 * its end, and anything that changes that end takes it back or replaces it:
 * skipping, pausing, ±15 s, un-✓ing the set, another set's rest, a change in
 * what comes next, the workout closing. The page's own beep and vibration go
 * on as before where they work.
 */

export const REST_ALERT_URL = "/api/workout/rest-alert";
/** Less than this left (a rest cut down to its last seconds): the page's own cue covers it. */
export const MIN_LEAD_MS = 3000;

type TimerLike = Pick<RestTimer, "id" | "endsAt" | "pausedLeftMs" | "kind">;

export interface PlannedAlert {
  restId: number;
  endsAt: number;
  kind: "rest" | "transition";
  /** What comes next ("Série 2 · Supino reto"). */
  next: string | null;
}

export type AlertStep = { do: "schedule"; alert: PlannedAlert } | { do: "cancel" } | { do: "forget" } | { do: "none" };

const sameEnd = (a: PlannedAlert, b: PlannedAlert) => a.restId === b.restId && Math.abs(a.endsAt - b.endsAt) < 1000;

/**
 * What to tell the server, given the alert it holds (`sent`) and the rest on
 * screen now: schedule (or replace) one, take it back, or nothing. One already
 * due is forgotten, not taken back: it is on its way.
 */
export function restAlertStep(sent: PlannedAlert | null, timer: TimerLike | null, next: string | null, now: number): AlertStep {
  const due = (a: PlannedAlert): AlertStep => (a.endsAt - now > 500 ? { do: "cancel" } : { do: "forget" });
  if (timer && timer.pausedLeftMs === null && timer.endsAt > now) {
    const want: PlannedAlert = { restId: timer.id, endsAt: timer.endsAt, kind: timer.kind ?? "rest", next };
    if (sent && sameEnd(sent, want) && sent.kind === want.kind && sent.next === want.next) return { do: "none" };
    if (want.endsAt - now >= MIN_LEAD_MS) return { do: "schedule", alert: want };
    // Seconds left: the one due about now stays; any other is taken back.
    if (!sent || sameEnd(sent, want)) return { do: "none" };
    return due(sent);
  }
  return sent ? due(sent) : { do: "none" };
}

/**
 * The notification's line: the next set of the exercise ("Série 2 · Supino
 * reto"), else the next exercise. Never a load: it shows on a lock screen.
 */
export function restAlertNext(o: { set: string | null; exercise: string | null; nextExercise: string | null }): string | null {
  if (o.set && o.exercise) return `${o.set} · ${o.exercise}`;
  if (o.nextExercise) return `Próximo exercício: ${o.nextExercise}`;
  return null;
}

/** This device and the notification: not known yet, none (not subscribed here), or on. */
export type AlertDevice = "unknown" | "none" | "subscribed";

export type RestAlertHintKind = "install" | "enable" | "blocked";

/**
 * The hint the rest bar shows on a device whose beep can't be counted on (an
 * iPhone) while the notification can't reach it: install to the home screen
 * first (iOS pushes only to an installed web app), turn notifications on, or
 * unblock them. Nothing where nothing can be done (an in-app browser), while
 * it isn't known yet, or once it works.
 */
export function restAlertHintKind(o: { soundUnreliable: boolean; support: PushSupport | null; device: AlertDevice }): RestAlertHintKind | null {
  if (!o.soundUnreliable || o.support === null || o.support === "unsupported") return null;
  if (o.support === "ios-needs-install") return "install";
  if (o.support === "denied") return "blocked";
  return o.device === "none" ? "enable" : null;
}

let lastSeq = 0;
/** Increasing on this device, so the server can tell a late request from a newer one. */
function nextSeq(): number {
  lastSeq = Math.max(lastSeq + 1, Date.now());
  return lastSeq;
}

/** When the alert the server holds for this page is due (0: none). */
let pendingUntil = 0;

function send(method: "POST" | "DELETE", body: object): Promise<Response | null> {
  // keepalive: the ✓ that starts a rest is often the last tap before the phone is locked.
  return fetch(REST_ALERT_URL, {
    method,
    credentials: "same-origin",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

/** The workout closed (finished, discarded): a notification still coming for its rest is taken back. */
export function cancelRestAlert() {
  if (pendingUntil <= Date.now()) return;
  pendingUntil = 0;
  void send("DELETE", { seq: nextSeq() });
}

/**
 * Keeps the server's alert in step with the rest on screen. Returns what is
 * known about this device, for the rest bar's hint. Leaving the screen (the
 * technique page) keeps the alert: the rest goes on.
 */
export function useRestAlert({
  sessionId,
  timer,
  next,
  on,
}: {
  sessionId: string;
  timer: TimerLike | null;
  next: string | null;
  /** The user keeps it on and this server can push (ExecutionSession.restAlert.on). */
  on: boolean;
}): AlertDevice {
  const [device, setDevice] = useState<AlertDevice>("unknown");
  const deviceRef = useRef<AlertDevice>("unknown");
  const endpointRef = useRef<Promise<string | null> | null>(null);
  const sentRef = useRef<PlannedAlert | null>(null);

  const mark = useCallback((d: AlertDevice) => {
    deviceRef.current = d;
    setDevice(d);
  }, []);
  const endpoint = useCallback(
    () => (endpointRef.current ??= currentSubscription().then((s) => s?.endpoint ?? null)),
    [],
  );

  // Looked up before the first rest, so the ✓ that starts one doesn't wait on it.
  useEffect(() => {
    if (!on) return;
    let live = true;
    void endpoint().then((e) => {
      if (live && !e) mark("none");
    });
    return () => {
      live = false;
    };
  }, [on, endpoint, mark]);

  const id = timer?.id;
  const endsAt = timer?.endsAt;
  const pausedLeftMs = timer?.pausedLeftMs ?? null;
  const kind = timer?.kind;
  useEffect(() => {
    const current = id === undefined || endsAt === undefined ? null : { id, endsAt, pausedLeftMs, kind };
    const step = restAlertStep(sentRef.current, on && deviceRef.current !== "none" ? current : null, next, Date.now());
    if (step.do === "none") return;
    if (step.do === "forget" || step.do === "cancel") {
      sentRef.current = null;
      if (step.do === "cancel") {
        pendingUntil = 0;
        void send("DELETE", { seq: nextSeq() });
      }
      return;
    }
    const alert = step.alert;
    sentRef.current = alert;
    // Numbered now: a take-back tapped while this is on its way comes after it.
    const seq = nextSeq();
    void endpoint().then(async (ep) => {
      const inMs = Math.round(alert.endsAt - Date.now());
      if (!ep || inMs < 1000) {
        if (sentRef.current === alert) sentRef.current = null;
        if (!ep) mark("none");
        return;
      }
      pendingUntil = alert.endsAt;
      const res = await send("POST", { seq, sessionId, endpoint: ep, inMs, kind: alert.kind, next: alert.next });
      if (res?.status === 404) {
        // Not one of this account's devices (turned off elsewhere, another account's): the hint says how.
        if (sentRef.current === alert) sentRef.current = null;
        mark("none");
      } else if (res?.ok) {
        mark("subscribed");
      }
    });
  }, [on, id, endsAt, pausedLeftMs, kind, next, sessionId, endpoint, mark]);

  return device;
}
