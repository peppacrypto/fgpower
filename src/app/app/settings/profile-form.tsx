"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { updateProfile, type ProfileField, type ProfileUpdateState } from "@/lib/actions/profile";
import {
  TRAINING_GOALS,
  EXPERIENCE_LEVELS,
  EQUIPMENT_ACCESS_OPTIONS,
} from "@/lib/validation/onboarding";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { cn } from "@/lib/utils/cn";
import { INVALID_FIELD, SaveStatus } from "@/components/ui/save-status";

const GOAL_LABEL: Record<string, string> = {
  HYPERTROPHY: "Hipertrofia",
  STRENGTH: "Força",
  GENERAL_FITNESS: "Fitness geral",
  STRENGTH_HYPERTROPHY: "Força + Hipertrofia",
  SPORTS_PERFORMANCE: "Performance esportiva",
  FAT_LOSS: "Emagrecer / definir",
};
const EXPERIENCE_LABEL: Record<string, string> = {
  BEGINNER: "Iniciante",
  INTERMEDIATE: "Intermediário",
  ADVANCED: "Avançado",
};
const EQUIPMENT_LABEL: Record<string, string> = {
  FULL_GYM: "Academia completa",
  HOME_DUMBBELLS: "Halteres em casa",
  HOME_BODYWEIGHT: "Só peso do corpo",
  MINIMAL: "Equipamento mínimo",
};

/**
 * Submits a Settings block to `updateProfile` (which only writes the fields
 * the block carries). Submitting by hand instead of `<form action>` keeps
 * what the user typed on a validation error — React resets uncontrolled
 * fields after every form-action submission — and a rejected call (offline)
 * becomes an inline error instead of the error page.
 */
export function useProfileSave() {
  const [state, setState] = useState<ProfileUpdateState>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const next: ProfileUpdateState = await runAction(() => updateProfile({}, formData));
      setState(next);
      if (next.fieldErrors) {
        // Move focus to the first highlighted field, in DOM order.
        const first = Array.from(form.elements).find(
          (el) => el instanceof HTMLElement && (el as HTMLInputElement).name in next.fieldErrors!,
        );
        (first as HTMLElement | undefined)?.focus();
      }
    });
  }

  /** Clears a field's error as soon as the user edits it. */
  function onChange(e: React.FormEvent<HTMLFormElement>) {
    const name = (e.target as HTMLInputElement).name as ProfileField;
    if (!state.fieldErrors?.[name]) return;
    setState((s) => {
      const fieldErrors = { ...s.fieldErrors };
      delete fieldErrors[name];
      return { ...s, fieldErrors };
    });
  }

  function field(name: ProfileField) {
    const error = state.fieldErrors?.[name];
    return {
      error,
      props: {
        name,
        id: name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? `${name}-error` : undefined,
      },
    };
  }

  // A failure that isn't about a field (offline, server error, expired
  // session) is shown next to the submit button — the user is down there,
  // and on a phone the top of a tall form is off-screen. Field errors keep
  // the banner at the top plus focus on the first highlighted field.
  const formError = state.fieldErrors ? state.error : undefined;
  const saveError = !pending && !state.fieldErrors ? (state.error ?? null) : null;

  return { state, pending, onSubmit, onChange, field, formError, saveError };
}

export function FieldError({ name, error }: { name: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${name}-error`} className="mt-1 text-xs text-danger">
      {error}
    </p>
  );
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="border-l-2 border-l-danger bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
      <ActionErrorText error={error} />
    </p>
  );
}

interface Props {
  initial: {
    displayName: string;
    bio: string;
    goal: string;
    experience: string;
    equipmentAccess: string;
  };
}

export function ProfileForm({ initial }: Props) {
  const { state, pending, onSubmit, onChange, field, formError, saveError } = useProfileSave();
  const displayName = field("displayName");
  const bio = field("bio");
  const goal = field("goal");
  const experience = field("experience");
  const equipment = field("equipmentAccess");

  return (
    <form onSubmit={onSubmit} onChange={onChange} noValidate className="flex flex-col gap-4">
      <FormError error={formError} />

      <div>
        <Label htmlFor="displayName">Nome de exibição</Label>
        <Input
          {...displayName.props}
          defaultValue={initial.displayName}
          required
          maxLength={60}
          autoComplete="nickname"
          aria-describedby={displayName.error ? "displayName-error displayName-hint" : "displayName-hint"}
          className={cn("mt-1.5", INVALID_FIELD)}
        />
        <FieldError name="displayName" error={displayName.error} />
        <p id="displayName-hint" className="mt-1 text-xs text-muted">
          É assim que outras pessoas veem você no feed e no seu perfil.
        </p>
      </div>

      <div>
        <Label htmlFor="bio">Bio (opcional)</Label>
        <Textarea {...bio.props} defaultValue={initial.bio} maxLength={280} rows={2} className={cn("mt-1.5", INVALID_FIELD)} />
        <FieldError name="bio" error={bio.error} />
      </div>

      {/* Stacked on phones: half a phone's width cut "Emagrecer / definir" to "Emagrec". */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="goal">Objetivo</Label>
          <Select {...goal.props} defaultValue={initial.goal} className={cn("mt-1.5", INVALID_FIELD)}>
            {TRAINING_GOALS.map((g) => (
              <option key={g} value={g}>
                {GOAL_LABEL[g]}
              </option>
            ))}
          </Select>
          <FieldError name="goal" error={goal.error} />
        </div>
        <div>
          <Label htmlFor="experience">Experiência</Label>
          <Select {...experience.props} defaultValue={initial.experience} className={cn("mt-1.5", INVALID_FIELD)}>
            {EXPERIENCE_LEVELS.map((e) => (
              <option key={e} value={e}>
                {EXPERIENCE_LABEL[e]}
              </option>
            ))}
          </Select>
          <FieldError name="experience" error={experience.error} />
        </div>
      </div>

      <div>
        <Label htmlFor="equipmentAccess">Equipamento</Label>
        <Select {...equipment.props} defaultValue={initial.equipmentAccess} className={cn("mt-1.5", INVALID_FIELD)}>
          {EQUIPMENT_ACCESS_OPTIONS.map((e) => (
            <option key={e} value={e}>
              {EQUIPMENT_LABEL[e]}
            </option>
          ))}
        </Select>
        <FieldError name="equipmentAccess" error={equipment.error} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Salvando…" : "Salvar perfil"}
        </Button>
        <SaveStatus pending={false} savedAt={pending ? null : state.savedAt} error={saveError} />
      </div>
    </form>
  );
}
