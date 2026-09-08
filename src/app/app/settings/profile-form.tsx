"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { updateProfile, type ProfileUpdateState } from "@/lib/actions/profile";
import {
  TRAINING_GOALS,
  EXPERIENCE_LEVELS,
  EQUIPMENT_ACCESS_OPTIONS,
} from "@/lib/validation/onboarding";

const GOAL_LABEL: Record<string, string> = {
  HYPERTROPHY: "Hipertrofia",
  STRENGTH: "Força",
  GENERAL_FITNESS: "Fitness geral",
  STRENGTH_HYPERTROPHY: "Força + Hipertrofia",
  SPORTS_PERFORMANCE: "Performance esportiva",
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

interface Props {
  initial: {
    displayName: string;
    bio: string;
    goal: string;
    experience: string;
    daysPerWeek: number;
    sessionMinutes: number;
    equipmentAccess: string;
  };
}

const initialState: ProfileUpdateState = {};

export function ProfileForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <p className="rounded-[var(--radius-md)] bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{state.error}</p> : null}

      <div>
        <Label htmlFor="displayName">Nome de exibição</Label>
        <Input id="displayName" name="displayName" defaultValue={initial.displayName} required maxLength={60} className="mt-1.5" />
      </div>

      <div>
        <Label htmlFor="bio">Bio (opcional)</Label>
        <Textarea id="bio" name="bio" defaultValue={initial.bio} maxLength={280} rows={2} className="mt-1.5" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="goal">Objetivo</Label>
          <Select id="goal" name="goal" defaultValue={initial.goal} className="mt-1.5">
            {TRAINING_GOALS.map((g) => (
              <option key={g} value={g}>
                {GOAL_LABEL[g]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="experience">Experiência</Label>
          <Select id="experience" name="experience" defaultValue={initial.experience} className="mt-1.5">
            {EXPERIENCE_LEVELS.map((e) => (
              <option key={e} value={e}>
                {EXPERIENCE_LABEL[e]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="daysPerWeek">Dias por semana</Label>
          <Select id="daysPerWeek" name="daysPerWeek" defaultValue={initial.daysPerWeek} className="mt-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {d}x
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="sessionMinutes">Duração da sessão</Label>
          <Select id="sessionMinutes" name="sessionMinutes" defaultValue={initial.sessionMinutes} className="mt-1.5">
            {[30, 45, 60, 75, 90, 120].map((m) => (
              <option key={m} value={m}>
                ~{m} min
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="equipmentAccess">Equipamento</Label>
        <Select id="equipmentAccess" name="equipmentAccess" defaultValue={initial.equipmentAccess} className="mt-1.5">
          {EQUIPMENT_ACCESS_OPTIONS.map((e) => (
            <option key={e} value={e}>
              {EQUIPMENT_LABEL[e]}
            </option>
          ))}
        </Select>
      </div>

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
