"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useRestoreFocus } from "@/components/ui/use-restore-focus";
import { cn } from "@/lib/utils/cn";
import { EXERCISE_STEP_OPTIONS } from "@/lib/training/load-grid";
import { formatDecimal } from "@/lib/training/set-plan";
import { SheetGrip } from "@/components/workout/sheet-grip";
import { ChipRadioGroup } from "@/app/app/settings/chip-radio-group";
import type { ExecutionExerciseLog } from "./types";
import { WorkoutActionError } from "./action-error";

/** "ajustado por você", "o salto do programa", "o padrão da sua academia": whose step the grid follows. */
function whose(source: ExecutionExerciseLog["loadGrid"]["source"]): string {
  return source === "exercise" ? "ajustado por você" : source === "program" ? "o salto do programa" : "o padrão da sua academia";
}

/**
 * "Este aparelho sobe de…" (Minha academia): this exercise's own load step —
 * a machine whose stack isn't the gym's usual one, a rack of 2,5 kg
 * dumbbells — or back to what it follows without one (the program row's
 * step, else the gym's). A chip saves at once; the parent runs the action
 * (setExerciseLoadStep) and refreshes the workout, so the suggestions, the
 * grey numbers and the warm-ups move along the new step. `busy` is the
 * choice being saved; `error` stays here with the chips (no signal at the
 * gym): nothing changed.
 */
export function LoadStepSheet({
  exercise,
  busy,
  error,
  loginHref,
  onPick,
  onClose,
}: {
  exercise: Pick<ExecutionExerciseLog, "exerciseName" | "loadGrid" | "loadGridText" | "loadStepKg" | "defaultLoad">;
  /** The step being saved ("default": back to the program's / gym's). */
  busy: number | "default" | null;
  error: string | null;
  /** Where "Entrar" goes when the login is gone (back to this exercise). */
  loginHref: string;
  /** A step for this exercise, or null to follow the program's / gym's again. */
  onPick: (stepKg: number | null) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useRestoreFocus();

  useEffect(() => {
    const dialog = dialogRef.current;
    // A native modal <dialog>: focus is trapped inside and the workout behind is inert.
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus();
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, []);

  const saving = busy !== null;
  // Only the user's own step is a choice made here: following the default, no chip is lit.
  const chosen = typeof busy === "number" ? busy : busy === "default" ? Number.NaN : (exercise.loadStepKg ?? Number.NaN);
  const back = exercise.defaultLoad.source === "program" ? "Usar o salto do programa" : "Usar o padrão da academia";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="load-step-kicker load-step-title"
      // Escape closes it; the parent unmounts the sheet, so prevent the native close.
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-dvw max-w-dvw bg-transparent p-0 text-foreground backdrop:bg-black/45"
      data-load-step-sheet
    >
      <div className="flex h-full w-full items-end justify-center sm:items-center" onClick={() => (saving ? null : onClose())}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="sheet max-h-[calc(100dvh-env(safe-area-inset-top,0px))] w-full max-w-lg overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:pt-6"
        >
          <SheetGrip />
          <span id="load-step-kicker" className="eyebrow block text-accent wrap-break-word">
            {exercise.exerciseName}
          </span>
          <h2 id="load-step-title" className="text-display mt-0.5 text-2xl font-semibold">
            Este aparelho sobe de…
          </h2>
          <p id="load-step-now" className="mt-2 text-[15px] leading-relaxed text-foreground">
            Hoje: {exercise.loadGridText} — {whose(exercise.loadGrid.source)}.
          </p>

          <p id="load-step-unit" className="mt-4 text-sm font-medium">
            Quanto sobe a cada degrau <span className="font-normal text-muted">· kg</span>
          </p>
          {/* Disabled while a choice is saved: one step at a time. */}
          <fieldset disabled={saving} className={cn("min-w-0", saving && "[&_button]:opacity-60")}>
            <ChipRadioGroup
              labelId="load-step-unit"
              describedBy="load-step-now"
              // Ten steps: two even rows of five on a phone.
              className="mt-2 grid grid-cols-5"
              options={EXERCISE_STEP_OPTIONS.map((v) => ({
                value: v,
                label: formatDecimal(v),
                // pt-BR: singular below 2 ("0,5 quilo", "1,25 quilo"), plural from 2 ("2,5 quilos").
                srLabel: `${formatDecimal(v)} ${v < 2 ? "quilo" : "quilos"}`,
              }))}
              value={chosen}
              onChange={(v) => {
                if (v !== exercise.loadStepKg) onPick(v);
              }}
            />
          </fieldset>
          <p className="mt-2 text-[13px] text-muted">
            Vale para este exercício em todos os treinos: a sugestão de carga e o aquecimento seguem este salto.
          </p>

          {exercise.loadStepKg !== null ? (
            <Button
              variant="secondary"
              size="lg"
              className="mt-4 h-auto min-h-12 w-full flex-col gap-0 whitespace-normal py-2 text-center"
              disabled={saving}
              onClick={() => onPick(null)}
            >
              <span>{busy === "default" ? "Salvando…" : back}</span>
              <span className="text-[13px] font-normal text-muted">{exercise.defaultLoad.text}</span>
            </Button>
          ) : null}

          <p role="status" className={cn("text-[13px] text-muted", saving && "mt-3")}>
            {saving ? "Salvando…" : ""}
          </p>
          {error ? (
            <p role="alert" className="mt-3 rounded-[var(--radius-md)] bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger">
              <WorkoutActionError error={error} loginHref={loginHref} />
            </p>
          ) : null}

          <Button ref={closeRef} size="lg" variant="ghost" className="mt-3 w-full" disabled={saving} onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </dialog>
  );
}
