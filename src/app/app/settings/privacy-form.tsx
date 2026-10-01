"use client";

import { Select } from "@/components/ui/input";
import { updatePrivacySettings, type PrivacySettings } from "@/lib/actions/profile";
import { ActionErrorText } from "@/components/social/session-expired";
import { SaveStatus } from "@/components/ui/save-status";
import { Toggle } from "@/components/ui/toggle";
import { useAutosave } from "@/components/ui/use-autosave";

/**
 * Privacidade: who sees the profile and the workouts, each switch saying
 * exactly what it does (W-048, W-147). Every setting here is read somewhere:
 * the account and discovery switches by /u, search and Descobrir; the loads
 * and the default audience by each new workout (and its summary, link and
 * story image); the current program by /u and its preview.
 */
export function PrivacyForm({ initial }: { initial: PrivacySettings }) {
  // A failed save rolls back and shows its message on the row that was tapped.
  const { value: settings, pending, savedAt, update, errorFor } = useAutosave(initial, updatePrivacySettings);
  const visibilityError = errorFor("defaultWorkoutVisibility");

  return (
    <div className="divide-y divide-border">
      <Toggle
        label="Conta pública"
        description="Qualquer pessoa — mesmo sem conta — vê seu perfil e seus treinos públicos, e pode te seguir sem pedir. Desligada, você aprova cada seguidor. Links de compartilhamento abrem só aquele treino, para quem tiver o link."
        checked={settings.isPublicAccount}
        onChange={(v) => update({ isPublicAccount: v })}
        error={errorFor("isPublicAccount")}
      />
      <Toggle
        label="Permitir que sua conta seja descoberta"
        description="Seu perfil aparece na busca e nas sugestões de Descobrir (por nome, @usuário e programa)."
        checked={settings.discoverable}
        onChange={(v) => update({ discoverable: v })}
        error={errorFor("discoverable")}
      />
      <Toggle
        label="Mostrar programa atual no perfil"
        description="Aparece como “Treinando: GD 3” no seu perfil público."
        checked={settings.showCurrentProgram}
        onChange={(v) => update({ showCurrentProgram: v })}
        error={errorFor("showCurrentProgram")}
      />
      <Toggle
        label="Mostrar kg e reps no que eu compartilhar"
        description="Vale para o feed, o link e a imagem do treino. Dá para mudar em cada treino."
        checked={settings.showLoadsPublicly}
        onChange={(v) => update({ showLoadsPublicly: v })}
        error={errorFor("showLoadsPublicly")}
      />
      <div className="py-3">
        <label htmlFor="defaultWorkoutVisibility" className="text-sm font-medium">
          Quem vê seus novos treinos
        </label>
        <p id="defaultWorkoutVisibility-help" className="text-xs text-muted">
          Cada treino é publicado assim ao terminar; dá para mudar no resumo dele.
        </p>
        <Select
          id="defaultWorkoutVisibility"
          aria-describedby="defaultWorkoutVisibility-help"
          value={settings.defaultWorkoutVisibility}
          onChange={(e) => update({ defaultWorkoutVisibility: e.target.value as PrivacySettings["defaultWorkoutVisibility"] })}
          className="mt-1.5"
        >
          <option value="PRIVATE">Privado</option>
          <option value="FOLLOWERS">Seguidores</option>
          <option value="PUBLIC">Público</option>
        </Select>
        {visibilityError ? (
          <p role="alert" className="mt-1 text-xs font-medium text-danger">
            <ActionErrorText error={visibilityError} />
          </p>
        ) : null}
      </div>
      <SaveStatus pending={pending} savedAt={savedAt} idleText="Salvo automaticamente" className="pt-3" />
    </div>
  );
}
