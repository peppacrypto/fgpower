"use client";

import { useState, useTransition } from "react";
import { updatePrivacySettings, type PrivacySettings } from "@/lib/actions/profile";

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="block text-xs text-muted">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 accent-accent"
      />
    </label>
  );
}

export function PrivacyForm({ initial }: { initial: PrivacySettings }) {
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(true);

  function update(patch: Partial<PrivacySettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaved(false);
    startTransition(async () => {
      await updatePrivacySettings(next);
      setSaved(true);
    });
  }

  return (
    <div className="divide-y divide-border">
      <Toggle
        label="Conta pública"
        description="Outros usuários podem encontrar seu perfil e ver sua atividade pública."
        checked={settings.isPublicAccount}
        onChange={(v) => update({ isPublicAccount: v })}
      />
      <Toggle
        label="Permitir que sua conta seja descoberta"
        description="Aparecer em buscas e sugestões."
        checked={settings.discoverable}
        onChange={(v) => update({ discoverable: v })}
      />
      <Toggle
        label="Mostrar cargas publicamente por padrão"
        description="Fica desligado por padrão mesmo em treinos públicos."
        checked={settings.showLoadsPublicly}
        onChange={(v) => update({ showLoadsPublicly: v })}
      />
      <Toggle
        label="Mostrar medidas corporais publicamente"
        description="Peso e outras medidas nunca ficam públicas por padrão."
        checked={settings.showBodyMetricsPublicly}
        onChange={(v) => update({ showBodyMetricsPublicly: v })}
      />
      <Toggle
        label="Mostrar programa atual no perfil"
        checked={settings.showCurrentProgram}
        onChange={(v) => update({ showCurrentProgram: v })}
      />
      <Toggle
        label="Compartilhar recordes automaticamente"
        description="Novos PRs viram atividades no feed."
        checked={settings.autoShareAchievements}
        onChange={(v) => update({ autoShareAchievements: v })}
      />
      <div className="pt-3">
        <label className="text-sm font-medium">Visibilidade padrão dos treinos</label>
        <select
          value={settings.defaultWorkoutVisibility}
          onChange={(e) => update({ defaultWorkoutVisibility: e.target.value as PrivacySettings["defaultWorkoutVisibility"] })}
          className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3.5 text-sm"
        >
          <option value="PRIVATE">Privado</option>
          <option value="FOLLOWERS">Seguidores</option>
          <option value="PUBLIC">Público</option>
        </select>
      </div>
      <p className="pt-3 text-xs text-muted">{pending ? "Salvando…" : saved ? "Salvo automaticamente" : ""}</p>
    </div>
  );
}
