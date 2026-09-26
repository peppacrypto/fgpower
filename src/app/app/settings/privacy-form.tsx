"use client";

import { Select } from "@/components/ui/input";
import { updatePrivacySettings, type PrivacySettings } from "@/lib/actions/profile";
import { SaveStatus } from "./save-status";
import { Toggle } from "./toggle";
import { useAutosave } from "./use-autosave";

export function PrivacyForm({ initial }: { initial: PrivacySettings }) {
  // A failed save rolls back and shows its message on the row that was tapped.
  const { value: settings, pending, savedAt, update, errorFor } = useAutosave(initial, updatePrivacySettings);

  return (
    <div className="divide-y divide-border">
      <Toggle
        label="Conta pública"
        description="Outros usuários podem encontrar seu perfil e ver sua atividade pública."
        checked={settings.isPublicAccount}
        onChange={(v) => update({ isPublicAccount: v })}
        error={errorFor("isPublicAccount")}
      />
      <Toggle
        label="Permitir que sua conta seja descoberta"
        description="Aparecer em buscas e sugestões."
        checked={settings.discoverable}
        onChange={(v) => update({ discoverable: v })}
        error={errorFor("discoverable")}
      />
      <Toggle
        label="Mostrar cargas publicamente por padrão"
        description="Fica desligado por padrão mesmo em treinos públicos."
        checked={settings.showLoadsPublicly}
        onChange={(v) => update({ showLoadsPublicly: v })}
        error={errorFor("showLoadsPublicly")}
      />
      <Toggle
        label="Mostrar medidas corporais publicamente"
        description="Peso e outras medidas nunca ficam públicas por padrão."
        checked={settings.showBodyMetricsPublicly}
        onChange={(v) => update({ showBodyMetricsPublicly: v })}
        error={errorFor("showBodyMetricsPublicly")}
      />
      <Toggle
        label="Mostrar programa atual no perfil"
        checked={settings.showCurrentProgram}
        onChange={(v) => update({ showCurrentProgram: v })}
        error={errorFor("showCurrentProgram")}
      />
      <Toggle
        label="Compartilhar recordes automaticamente"
        description="Novos PRs viram atividades no feed."
        checked={settings.autoShareAchievements}
        onChange={(v) => update({ autoShareAchievements: v })}
        error={errorFor("autoShareAchievements")}
      />
      <div className="pt-3">
        <label htmlFor="defaultWorkoutVisibility" className="text-sm font-medium">
          Visibilidade padrão dos treinos
        </label>
        <Select
          id="defaultWorkoutVisibility"
          value={settings.defaultWorkoutVisibility}
          onChange={(e) => update({ defaultWorkoutVisibility: e.target.value as PrivacySettings["defaultWorkoutVisibility"] })}
          className="mt-1.5"
        >
          <option value="PRIVATE">Privado</option>
          <option value="FOLLOWERS">Seguidores</option>
          <option value="PUBLIC">Público</option>
        </Select>
        {errorFor("defaultWorkoutVisibility") ? (
          <p role="alert" className="mt-1 text-xs font-medium text-danger">
            {errorFor("defaultWorkoutVisibility")}
          </p>
        ) : null}
      </div>
      <SaveStatus pending={pending} savedAt={savedAt} idleText="Salvo automaticamente" className="pt-3" />
    </div>
  );
}
