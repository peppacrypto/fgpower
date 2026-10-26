"use client";

import { updateGymLoads } from "@/lib/actions/gym";
import {
  CABLE_STEP_OPTIONS,
  DUMBBELL_SCHEMES,
  KETTLEBELL_STEP_OPTIONS,
  PLATE_OPTIONS,
  STACK_STEP_OPTIONS,
  type GymLoadSettings,
} from "@/lib/training/load-grid";
import { ActionErrorText } from "@/components/social/session-expired";
import { SaveStatus } from "@/components/ui/save-status";
import { useAutosave } from "@/components/ui/use-autosave";
import { cn } from "@/lib/utils/cn";
import { ChipRadioGroup, type ChipOption } from "./chip-radio-group";
import { DUMBBELL_SCHEME_LABEL, gymExamples, kgChip } from "./gym-options";

// "2 em 2": the group's name carries the unit ("Halteres · kg"), as it does for the plates.
const DUMBBELL_CHIPS = DUMBBELL_SCHEMES.map((s) => ({ value: s, label: DUMBBELL_SCHEME_LABEL[s] }));
const KETTLEBELL_CHIPS = KETTLEBELL_STEP_OPTIONS.map((v) => ({ value: v, label: `${v} em ${v}` }));

/**
 * Settings → Minha academia → Pesos: how the loads move in the user's gym —
 * the dumbbell rack's spacing, one plate of a machine's and of a cable's
 * stack, the lightest plate, the kettlebell gap (lib/training/load-grid).
 * Autosaved as one block (updateGymLoads); the workout, the summary and the
 * history read the profile per request, so the next suggestion, the warm-ups
 * and the ease-back after a break land on a load that exists. Under each
 * choice, what it means right now ("Ex.: 12 → 14 kg"), read off the same grid.
 */
export function GymLoadsForm({ initial }: { initial: GymLoadSettings }) {
  const { value: gym, pending, savedAt, update, errorFor } = useAutosave(initial, updateGymLoads);
  const example = gymExamples(gym);

  return (
    <div>
      <h3 className="text-base font-semibold">Pesos</h3>
      <p className="mt-0.5 text-[13px] text-muted">Como a carga sobe em cada equipamento: a sugestão é sempre um peso que existe.</p>
      <div className="mt-1 divide-y divide-border">
        <LoadChoice
          id="gym-dumbbells"
          label="Halteres"
          unit="kg"
          example={example.dumbbellScheme}
          // The long default on its own row; the three even spacings share the next.
          className="grid grid-cols-3 [&>:first-child]:col-span-3"
          options={DUMBBELL_CHIPS}
          value={gym.dumbbellScheme}
          onChange={(v) => update({ dumbbellScheme: v })}
          error={errorFor("dumbbellScheme")}
        />
        <LoadChoice
          id="gym-stack"
          label="Máquinas com pino"
          unit="kg por placa"
          help="Extensora, flexora, voador e outras com pilha de placas."
          example={example.stackStepKg}
          options={STACK_STEP_OPTIONS.map(kgChip)}
          value={gym.stackStepKg}
          onChange={(v) => update({ stackStepKg: v })}
          error={errorFor("stackStepKg")}
        />
        <LoadChoice
          id="gym-cable"
          label="Polias"
          unit="kg por placa"
          help="Crossover, puxador e remada baixa."
          example={example.cableStepKg}
          options={CABLE_STEP_OPTIONS.map(kgChip)}
          value={gym.cableStepKg}
          onChange={(v) => update({ cableStepKg: v })}
          error={errorFor("cableStepKg")}
        />
        <LoadChoice
          id="gym-plate"
          label="Menor anilha"
          unit="kg"
          help="A barra e o leg press usam um par; cavalinho e cinto, uma."
          example={example.smallestPlateKg}
          // Six plates: two even rows of three on a phone, one row on a wider screen.
          className="grid grid-cols-3 sm:flex"
          options={PLATE_OPTIONS.map(kgChip)}
          value={gym.smallestPlateKg}
          onChange={(v) => update({ smallestPlateKg: v })}
          error={errorFor("smallestPlateKg")}
        />
        <LoadChoice
          id="gym-kettlebell"
          label="Kettlebell"
          unit="kg"
          example={example.kettlebellStepKg}
          options={KETTLEBELL_CHIPS}
          value={gym.kettlebellStepKg}
          onChange={(v) => update({ kettlebellStepKg: v })}
          error={errorFor("kettlebellStepKg")}
        />
      </div>
      {/* The exceptions live on the exercise itself (ExerciseLoadStep, set from the workout). */}
      <p className="border-t border-border pt-3 text-xs text-muted">
        Um aparelho que sobe diferente dos outros? Ajuste no próprio exercício, durante o treino.
      </p>
      <SaveStatus pending={pending} savedAt={savedAt} idleText="Salvo automaticamente" className="pt-2" />
    </div>
  );
}

/**
 * One "Pesos" setting: its name (and unit), what it covers, the example at
 * the value picked — the radio group's description, so a screen reader hears
 * it on entering — the chips, and the error when its save was rolled back.
 */
function LoadChoice<T extends string | number>({
  id,
  label,
  unit,
  help,
  example,
  options,
  value,
  onChange,
  error,
  className,
}: {
  id: string;
  label: string;
  unit?: string;
  help?: string;
  example: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  error: string | null;
  className?: string;
}) {
  return (
    <div className="py-3.5">
      <p id={`${id}-label`} className="text-sm font-medium">
        {label}
        {unit ? <span className="font-normal text-muted"> · {unit}</span> : null}
      </p>
      <p id={`${id}-desc`} className="mt-0.5 text-xs text-muted">
        {help ? `${help} ` : null}
        <span className="tabular-nums text-foreground/80">{example}</span>
      </p>
      <ChipRadioGroup
        labelId={`${id}-label`}
        describedBy={`${id}-desc`}
        className={cn("mt-2.5", className)}
        options={options}
        value={value}
        onChange={(v) => {
          if (v !== value) onChange(v);
        }}
      />
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}
    </div>
  );
}
