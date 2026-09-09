"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function useRestTimer() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (secondsLeft === null || paused || secondsLeft <= 0) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null) return null;
        const next = s - 1;
        return next <= 0 ? null : next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [secondsLeft, paused]);

  return {
    secondsLeft,
    isRunning: secondsLeft !== null,
    paused,
    start: (seconds: number) => {
      setPaused(false);
      setSecondsLeft(seconds);
    },
    addSeconds: (delta: number) => setSecondsLeft((s) => (s === null ? null : Math.max(0, s + delta))),
    togglePause: () => setPaused((p) => !p),
    skip: () => setSecondsLeft(null),
  };
}

export function RestTimerBar({
  secondsLeft,
  paused,
  onAdd,
  onSkip,
  onTogglePause,
}: {
  secondsLeft: number;
  paused: boolean;
  onAdd: (seconds: number) => void;
  onSkip: () => void;
  onTogglePause: () => void;
}) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-16 z-30 border-t border-accent/40 bg-accent px-4 py-3 text-accent-foreground shadow-lg sm:bottom-0"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-bold tabular-nums">
            {minutes}:{String(seconds).padStart(2, "0")}
          </span>
          <span className="text-sm font-medium opacity-80">Descanso</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAdd(15)}
            className="flex h-9 items-center gap-1 rounded-[3px] bg-black/10 px-3 text-sm font-semibold hover:bg-black/20"
          >
            <Plus className="size-3.5" />
            15s
          </button>
          <button
            onClick={onTogglePause}
            aria-label={paused ? "Retomar" : "Pausar"}
            className={cn("flex size-9 items-center justify-center rounded-[3px] bg-black/10 hover:bg-black/20")}
          >
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
          <button
            onClick={onSkip}
            aria-label="Pular descanso"
            className="flex size-9 items-center justify-center rounded-[3px] bg-black/10 hover:bg-black/20"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
