"use client";

import { updateWorkoutPreferences } from "@/lib/actions/preferences";
import { LOAD_INCREMENT_OPTIONS, type WorkoutPreferences } from "@/lib/validation/preferences";
import { formatDecimal } from "@/lib/training/set-plan";
import { ActionErrorText } from "@/components/social/session-expired";
import { SaveStatus } from "@/components/ui/save-status";
import { Toggle } from "@/components/ui/toggle";
import { useAutosave } from "@/components/ui/use-autosave";
import { ChipRadioGroup } from "./chip-radio-group";

/**
 * Settings → Durante o treino (W-149): the load step, the end-of-rest beep
 * and vibration. Autosaved as one object; the workout, the summary and the
 * history read the profile per request, so an open workout picks the new
 * step up on its next load.
 */
export function WorkoutPreferencesForm({ initial }: { initial: WorkoutPreferences }) {
  const { value: prefs, pending, savedAt, update, errorFor } = useAutosave(initial, updateWorkoutPreferences);
  // A value stored before these options existed (0,75) stays visible, selected.
  const steps: number[] = [...LOAD_INCREMENT_OPTIONS];
  if (!steps.includes(prefs.loadIncrementKg)) steps.push(prefs.loadIncrementKg);
  steps.sort((a, b) => a - b);
  const incrementError = errorFor("loadIncrementKg");

  return (
    <div className="divide-y divide-border">
      <div className="pb-4">
        <p id="load-increment-label" className="text-sm font-medium">
          Salto de carga <span className="font-mono text-xs text-muted">· kg</span>
        </p>
        <p id="load-increment-desc" className="mt-0.5 text-xs text-muted">
          Quanto a sugestão sobe quando é hora de aumentar a carga (“↑ Suba para…”) e o passo das cargas de aquecimento.
          Escolha o menor salto que seus pesos permitem.
        </p>
        <ChipRadioGroup
          labelId="load-increment-label"
          describedBy="load-increment-desc"
          // Six steps: two even rows of three on a phone, one row on a wider screen.
          className="mt-2.5 grid grid-cols-3 sm:flex"
          options={steps.map((v) => ({
            value: v,
            label: formatDecimal(v),
            // pt-BR: singular below 2 ("0,5 quilo", "1,25 quilo"), plural from 2 ("2,5 quilos").
            srLabel: `${formatDecimal(v)} ${v < 2 ? "quilo" : "quilos"}`,
          }))}
          value={prefs.loadIncrementKg}
          onChange={(v) => {
            if (v !== prefs.loadIncrementKg) update({ loadIncrementKg: v });
          }}
        />
        <p className="mt-2 text-xs text-muted">Exercícios com salto próprio no programa mantêm o deles.</p>
        {incrementError ? (
          <p role="alert" className="mt-1 text-xs font-medium text-danger">
            <ActionErrorText error={incrementError} />
          </p>
        ) : null}
      </div>
      <Toggle
        label="Aviso sonoro no fim do descanso"
        description="Toca um bipe quando o cronômetro de descanso zera."
        checked={prefs.restTimerSound}
        onChange={(v) => update({ restTimerSound: v })}
        error={errorFor("restTimerSound")}
      />
      <Toggle
        label="Vibração"
        description="No fim do descanso e ao bater um recorde. O iPhone não permite vibrar pelo navegador."
        checked={prefs.hapticsEnabled}
        onChange={(v) => update({ hapticsEnabled: v })}
        error={errorFor("hapticsEnabled")}
      />
      <SaveStatus pending={pending} savedAt={savedAt} idleText="Salvo automaticamente" className="pt-3" />
    </div>
  );
}
