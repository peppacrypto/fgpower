"use client";

import { updateWorkoutPreferences, type WorkoutPreferences } from "@/lib/actions/profile";
import { SaveStatus } from "./save-status";
import { Toggle } from "./toggle";
import { useAutosave } from "./use-autosave";

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
      <SaveStatus pending={pending} savedAt={savedAt} idleText="Salvo automaticamente" className="pt-3" />
    </div>
  );
}
