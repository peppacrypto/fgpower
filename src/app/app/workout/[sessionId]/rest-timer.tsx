"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Minus, Pause, Play, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { restKey } from "@/components/workout/local-workout";
import { playRestBeep, vibrateRestEnd } from "./rest-audio";

/**
 * A rest between sets, kept as wall-clock timestamps — never a countdown in
 * memory — so a locked phone, a throttled tab, a reload or a trip to "Ver
 * técnica" can't freeze or lose it: the time left is always endsAt − now.
 */
export interface RestTimer {
  /** When it was started; identifies this rest. */
  id: number;
  endsAt: number;
  /** Time left while paused; null while running. */
  pausedLeftMs: number | null;
  totalSeconds: number;
  /** The exercise whose set started it ("Descanso · após …"). */
  after: string;
  exerciseIndex: number;
  /** The set that started it: un-✓ing that set cancels the rest. */
  setId: string;
}


/** A rest that ended while the user was away is still reported ("terminou há …") within this window. */
const REPORT_LATE_WITHIN_MS = 10 * 60 * 1000;
/** Seen this long after it ended, the bar says how long ago instead of "concluído". */
const LATE_AFTER_MS = 3000;
/** Past this, a vibration or beep would only startle: the user already moved on. */
const CUE_WITHIN_MS = 30_000;
/** A paused rest this old was forgotten, not paused: it isn't brought back. */
const PAUSED_KEEP_MS = 3 * 60 * 60 * 1000;

function readStoredTimer(sessionId: string): RestTimer | null {
  try {
    const t = JSON.parse(window.localStorage.getItem(restKey(sessionId)) ?? "null") as Partial<RestTimer> | null;
    if (
      !t ||
      typeof t.id !== "number" ||
      typeof t.endsAt !== "number" ||
      typeof t.totalSeconds !== "number" ||
      typeof t.after !== "string" ||
      typeof t.exerciseIndex !== "number" ||
      typeof t.setId !== "string" ||
      (t.pausedLeftMs !== null && typeof t.pausedLeftMs !== "number")
    ) {
      return null;
    }
    return t as RestTimer;
  } catch {
    return null;
  }
}

function writeStoredTimer(sessionId: string, t: RestTimer | null) {
  try {
    if (t) window.localStorage.setItem(restKey(sessionId), JSON.stringify(t));
    else window.localStorage.removeItem(restKey(sessionId));
  } catch {
    /* storage unavailable (private mode) — the rest still runs in memory */
  }
}

export function clearStoredRestTimer(sessionId: string) {
  writeStoredTimer(sessionId, null);
}

export function useRestTimer(sessionId: string) {
  const [timer, setTimer] = useState<RestTimer | null>(null);
  const timerRef = useRef<RestTimer | null>(null);
  const set = useCallback(
    (t: RestTimer | null) => {
      timerRef.current = t;
      setTimer(t);
      writeStoredTimer(sessionId, t);
    },
    [sessionId],
  );

  // Pick the rest back up after a reload or a trip away from the workout.
  useEffect(() => {
    const t = readStoredTimer(sessionId);
    const now = Date.now();
    const keep = t && (t.pausedLeftMs !== null ? now - t.id < PAUSED_KEEP_MS : now - t.endsAt < REPORT_LATE_WITHIN_MS);
    if (t && keep) {
      timerRef.current = t;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage, only readable after hydration
      setTimer(t);
    } else if (t) {
      writeStoredTimer(sessionId, null);
    }
  }, [sessionId]);

  const start = useCallback(
    (o: { seconds: number; after: string; exerciseIndex: number; setId: string }) => {
      if (!(o.seconds > 0)) return;
      const now = Date.now();
      set({
        id: now,
        endsAt: now + o.seconds * 1000,
        pausedLeftMs: null,
        totalSeconds: o.seconds,
        after: o.after,
        exerciseIndex: o.exerciseIndex,
        setId: o.setId,
      });
    },
    [set],
  );

  /** ±15 s. Taking the rest down to nothing ends it quietly (the user is ready). */
  const adjust = useCallback(
    (deltaSeconds: number) => {
      const t = timerRef.current;
      if (!t) return;
      const now = Date.now();
      const left = t.pausedLeftMs ?? t.endsAt - now;
      if (left <= 0) return;
      const next = left + deltaSeconds * 1000;
      if (next <= 0) set(null);
      else if (t.pausedLeftMs !== null) set({ ...t, pausedLeftMs: next });
      else set({ ...t, endsAt: now + next });
    },
    [set],
  );

  const togglePause = useCallback(() => {
    const t = timerRef.current;
    if (!t) return;
    const now = Date.now();
    if (t.pausedLeftMs !== null) set({ ...t, endsAt: now + t.pausedLeftMs, pausedLeftMs: null });
    else if (t.endsAt > now) set({ ...t, pausedLeftMs: t.endsAt - now });
  }, [set]);

  const dismiss = useCallback(() => set(null), [set]);

  return { timer, start, adjust, togglePause, dismiss };
}

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** "40 s", "2 min". */
function ago(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min`;
}

function spokenDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} segundos`;
  const mins = m === 1 ? "1 minuto" : `${m} minutos`;
  return s === 0 ? mins : `${mins} e ${s} segundos`;
}

const BAR_BUTTON = "flex h-11 items-center justify-center gap-0.5 rounded-[3px] bg-black/10 text-sm font-semibold hover:bg-black/20";

/**
 * The rest bar. The countdown itself is hidden from screen readers (it would
 * be re-read every second); `onAnnounce` feeds a polite live region with the
 * start, the last 30 s and the end only. At the end it vibrates, beeps (if
 * the user keeps the sound on) and turns into "Descanso concluído" for a few
 * seconds; a rest that ended while the phone was locked says how long ago.
 */
export function RestTimerBar({
  timer,
  sound,
  next,
  upNext,
  onAdjust,
  onTogglePause,
  onDismiss,
  onAnnounce,
}: {
  timer: RestTimer;
  sound: boolean;
  /** After an exercise's last set: a shortcut to the next exercise. */
  next: { name: string; onGo: () => void } | null;
  /** What comes next in this exercise ("Série 3 · 60 kg × 10"), shown when the rest ends. */
  upNext: string | null;
  onAdjust: (seconds: number) => void;
  onTogglePause: () => void;
  onDismiss: () => void;
  onAnnounce: (text: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [seenEndAt, setSeenEndAt] = useState<number | null>(null);
  const latest = useRef({ timer, sound, onAnnounce, onDismiss });
  useEffect(() => {
    latest.current = { timer, sound, onAnnounce, onDismiss };
  });

  useEffect(() => {
    const { timer: t, onAnnounce: announce } = latest.current;
    // A fresh rest (not one picked back up after a reload) is announced.
    if (Date.now() - t.id < 2000) announce(`Descanso de ${spokenDuration(t.totalSeconds)}.`);

    const flags = { cued: false, warned: false, seenAt: null as number | null };
    const tick = () => {
      const time = Date.now();
      const { timer: tm, sound: beep, onAnnounce: say, onDismiss: dismiss } = latest.current;
      const left = tm.pausedLeftMs ?? tm.endsAt - time;
      if (tm.pausedLeftMs === null && left > 0 && left <= 30_000 && tm.totalSeconds > 45 && !flags.warned) {
        flags.warned = true;
        say("30 segundos de descanso.");
      }
      if (tm.pausedLeftMs === null && left <= 0) {
        if (!flags.cued) {
          flags.cued = true;
          if (-left < CUE_WITHIN_MS) {
            vibrateRestEnd();
            if (beep) playRestBeep();
          }
          say(-left > LATE_AFTER_MS ? `Descanso terminou há ${ago(-left)}.` : "Descanso concluído.");
        }
        if (flags.seenAt === null && document.visibilityState === "visible") {
          flags.seenAt = time;
          setSeenEndAt(time);
        }
        if (flags.seenAt !== null && time - flags.seenAt > (flags.seenAt - tm.endsAt > LATE_AFTER_MS ? 12_000 : 6_000)) {
          dismiss();
          return;
        }
      }
      setNow(time);
    };
    const id = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const paused = timer.pausedLeftMs !== null;
  const leftMs = timer.pausedLeftMs ?? timer.endsAt - now;
  const ended = !paused && leftMs <= 0;
  const late = ended && (seenEndAt ?? now) - timer.endsAt > LATE_AFTER_MS;

  const nextButton = next ? (
    <button
      type="button"
      onClick={next.onGo}
      className="-mx-1 flex min-h-10 w-[calc(100%+0.5rem)] items-center justify-between gap-2 px-1 text-left font-mono text-[11px] font-bold uppercase tracking-[0.14em] hover:underline"
    >
      <span className="truncate">Próximo · {next.name}</span>
      <ChevronRight className="size-4 shrink-0" />
    </button>
  ) : null;

  return (
    <div
      data-rest-state={ended ? "ended" : paused ? "paused" : "running"}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 px-4 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg",
        // Ink, not accent, when it ends: unmistakably different from the running bar in both themes.
        ended ? "bg-foreground text-background" : "bg-accent text-accent-foreground",
      )}
    >
      <div className="mx-auto max-w-3xl">
        {ended ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 py-1">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]">
                  {late ? `Descanso terminou há ${ago(now - timer.endsAt)}` : "Descanso concluído"}
                </p>
                {!next && upNext ? <p className="mt-0.5 truncate text-sm font-semibold">{upNext}</p> : null}
              </div>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Fechar aviso de descanso"
                className="flex size-11 shrink-0 items-center justify-center rounded-[3px] bg-background/15 hover:bg-background/25"
              >
                <X className="size-4" />
              </button>
            </div>
            {nextButton}
          </>
        ) : (
          <>
            {nextButton ?? (
              <p className="truncate py-1.5 text-xs">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
                  {paused ? "Descanso pausado" : "Descanso"}
                </span>
                <span className="opacity-85"> · após {timer.after}</span>
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <span aria-hidden className="font-mono text-3xl font-bold tabular-nums">
                {clock(Math.ceil(leftMs / 1000))}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => onAdjust(-15)} aria-label="Menos 15 segundos" className={cn(BAR_BUTTON, "px-2.5")}>
                  <Minus className="size-3.5" />
                  15s
                </button>
                <button type="button" onClick={() => onAdjust(15)} aria-label="Mais 15 segundos" className={cn(BAR_BUTTON, "px-2.5")}>
                  <Plus className="size-3.5" />
                  15s
                </button>
                <button
                  type="button"
                  onClick={onTogglePause}
                  aria-label={paused ? "Retomar descanso" : "Pausar descanso"}
                  className={cn(BAR_BUTTON, "size-11")}
                >
                  {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                </button>
                <button type="button" onClick={onDismiss} aria-label="Pular descanso" className={cn(BAR_BUTTON, "size-11")}>
                  <X className="size-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
