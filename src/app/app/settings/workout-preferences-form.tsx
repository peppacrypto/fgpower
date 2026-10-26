"use client";

import { updateWorkoutPreferences } from "@/lib/actions/preferences";
import type { WorkoutPreferences } from "@/lib/validation/preferences-constants";
import { SaveStatus } from "@/components/ui/save-status";
import { Toggle } from "@/components/ui/toggle";
import { useAutosave } from "@/components/ui/use-autosave";

/**
 * Settings → Durante o treino (W-149): the end-of-rest beep and vibration.
 * Autosaved as one object; the workout reads the profile per request. The
 * single "Salto de carga" that lived here is gone: loads follow the gym's
 * equipment (Minha academia, gym-loads-form).
 */
export function WorkoutPreferencesForm({ initial }: { initial: WorkoutPreferences }) {
  const { value: prefs, pending, savedAt, update, errorFor } = useAutosave(initial, updateWorkoutPreferences);

  return (
    <div className="divide-y divide-border">
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
