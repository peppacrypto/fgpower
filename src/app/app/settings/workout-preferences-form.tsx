"use client";

import { updateWorkoutPreferences } from "@/lib/actions/preferences";
import type { WorkoutPreferences } from "@/lib/validation/preferences";
import { SaveStatus } from "@/components/ui/save-status";
import { Toggle } from "@/components/ui/toggle";
import { useAutosave } from "@/components/ui/use-autosave";

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
