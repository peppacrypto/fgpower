"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Dumbbell, Info, Plus, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addSet, finishWorkoutSession, skipExercise } from "@/lib/actions/workouts";
import { saveExerciseNote } from "@/lib/actions/exercise-notes";
import { SetRow } from "./set-row";
import { RestTimerBar, useRestTimer } from "./rest-timer";
import type { ExecutionSession } from "./types";

function useElapsedTime(startedAtIso: string) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAtIso).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAtIso]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WorkoutExecutionClient({ session }: { session: ExecutionSession }) {
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [noteDraft, setNoteDraft] = useState(session.notes ?? "");
  const [finishing, startFinishing] = useTransition();
  const [, startTransition] = useTransition();
  const timer = useRestTimer();
  const elapsed = useElapsedTime(session.startedAtIso);

  const exercise = session.exercises[exerciseIndex];
  const total = session.exercises.length;

  const activeSetId = useMemo(() => exercise?.sets.find((s) => !s.isCompleted)?.id ?? null, [exercise]);

  const allSetsDone = exercise ? exercise.sets.every((s) => s.isCompleted) && exercise.sets.length > 0 : false;

  function goToExercise(delta: number) {
    setExerciseIndex((i) => Math.max(0, Math.min(total - 1, i + delta)));
  }

  if (!exercise) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-semibold">Nenhum exercício neste treino.</p>
        <Button asChild>
          <Link href="/app/today">Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col pb-40">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{session.name}</p>
            <p className="text-xs text-muted">
              Exercício {exerciseIndex + 1} de {total} · {elapsed}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={finishing}
            onClick={() => startFinishing(() => finishWorkoutSession(session.id))}
          >
            {finishing ? "Finalizando…" : "Finalizar"}
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => goToExercise(-1)}
            disabled={exerciseIndex === 0}
            className="flex size-9 items-center justify-center rounded-full border border-border disabled:opacity-30"
            aria-label="Exercício anterior"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex flex-1 items-center gap-3 px-3">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-surface-2">
              {exercise.imageUrl ? (
                <Image src={exercise.imageUrl} alt={exercise.exerciseName} fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted">
                  <Dumbbell className="size-5" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold">{exercise.exerciseName}</h1>
              <p className="text-xs text-muted">
                {exercise.repMin}–{exercise.repMax} reps
                {exercise.rirTarget != null ? ` · RIR ${exercise.rirTarget}` : ""} · Descanso{" "}
                {Math.round(exercise.restSeconds / 60) >= 1
                  ? `${Math.floor(exercise.restSeconds / 60)}:${String(exercise.restSeconds % 60).padStart(2, "0")}`
                  : `${exercise.restSeconds}s`}
              </p>
            </div>
          </div>
          <button
            onClick={() => goToExercise(1)}
            disabled={exerciseIndex === total - 1}
            className="flex size-9 items-center justify-center rounded-full border border-border disabled:opacity-30"
            aria-label="Próximo exercício"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Link
            href={`/app/exercises/${exercise.exerciseSlug}`}
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <Info className="size-3.5" />
            Ver técnica
          </Link>
          <button
            onClick={() => startTransition(() => skipExercise(exercise.id))}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
          >
            <SkipForward className="size-3.5" />
            Pular exercício
          </button>
        </div>

        {exercise.persistentNote ? (
          <p className="mt-3 rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2 text-xs text-muted">
            📝 {exercise.persistentNote}
          </p>
        ) : null}

        {exercise.previousSets.length > 0 ? (
          <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3.5 py-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Último treino</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
              {exercise.previousSets.map((s, i) => (
                <span key={i}>
                  {s.weightKg ?? "—"}kg × {s.reps ?? "—"}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2.5">
          {exercise.sets.map((set) => {
            const matchingPrevious = exercise.previousSets[set.setNumber - 1] ?? exercise.previousSets[0] ?? null;
            return (
              <SetRow
                key={set.id}
                set={set}
                isActive={set.id === activeSetId}
                prefillWeight={matchingPrevious?.weightKg ?? null}
                prefillReps={matchingPrevious?.reps ?? null}
                onCompleted={() => timer.start(exercise.restSeconds)}
              />
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => startTransition(() => addSet(exercise.id))}
        >
          <Plus className="size-4" />
          Adicionar série
        </Button>

        {allSetsDone && exerciseIndex < total - 1 ? (
          <Button className="mt-6 w-full" size="lg" onClick={() => goToExercise(1)}>
            Próximo exercício
            <ChevronRight className="size-4" />
          </Button>
        ) : null}

        <div className="mt-8 border-t border-border pt-5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted">Nota da série/máquina</label>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => startTransition(() => saveExerciseNote(exercise.exerciseId, noteDraft))}
            placeholder="Ex.: banco na posição 4"
            className="mt-1.5 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm"
            rows={2}
          />
        </div>
      </div>

      {timer.isRunning && timer.secondsLeft !== null ? (
        <RestTimerBar
          secondsLeft={timer.secondsLeft}
          paused={timer.paused}
          onAdd={timer.addSeconds}
          onSkip={timer.skip}
          onTogglePause={timer.togglePause}
        />
      ) : null}
    </div>
  );
}
