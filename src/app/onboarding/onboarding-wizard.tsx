"use client";

import { useActionState, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/misc";
import { completeOnboarding, type OnboardingFormState } from "@/lib/actions/onboarding";

const GOALS = [
  { value: "HYPERTROPHY", label: "Hipertrofia", desc: "Ganhar massa muscular" },
  { value: "STRENGTH", label: "Força", desc: "Levantar mais peso" },
  { value: "GENERAL_FITNESS", label: "Fitness geral", desc: "Saúde e condicionamento" },
  { value: "STRENGTH_HYPERTROPHY", label: "Força + Hipertrofia", desc: "Os dois objetivos" },
  { value: "SPORTS_PERFORMANCE", label: "Performance esportiva", desc: "Para outro esporte" },
];

const EXPERIENCE = [
  { value: "BEGINNER", label: "Iniciante", desc: "Menos de 1 ano de treino" },
  { value: "INTERMEDIATE", label: "Intermediário", desc: "1 a 3 anos" },
  { value: "ADVANCED", label: "Avançado", desc: "3+ anos consistentes" },
];

const EQUIPMENT = [
  { value: "FULL_GYM", label: "Academia completa", desc: "Barras, halteres, máquinas e cabos" },
  { value: "HOME_DUMBBELLS", label: "Halteres em casa", desc: "Halteres e talvez um banco" },
  { value: "HOME_BODYWEIGHT", label: "Só peso do corpo", desc: "Sem equipamento" },
  { value: "MINIMAL", label: "Equipamento mínimo", desc: "Faixas elásticas, kettlebell etc." },
];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SESSION_MINUTES = [30, 45, 60, 75, 90, 120];

const initialState: OnboardingFormState = {};

export function OnboardingWizard() {
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);
  const [step, setStep] = useState(0);
  const [preferredDays, setPreferredDays] = useState<number[]>([]);
  const [doesEndurance, setDoesEndurance] = useState(false);
  const totalSteps = 4;

  function togglePreferredDay(day: number) {
    setPreferredDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  return (
    <form action={formAction} className="w-full max-w-lg">
      <ProgressBar value={((step + 1) / totalSteps) * 100} className="mb-8" />

      {state.error ? (
        <p className="mb-4 rounded-[var(--radius-md)] bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      {/* Step 0 — name */}
      <section hidden={step !== 0} className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-tight">Como podemos te chamar?</h2>
        <div>
          <Label htmlFor="displayName">Nome de exibição</Label>
          <Input id="displayName" name="displayName" placeholder="Ex.: Guilherme" required className="mt-1.5" maxLength={60} />
          {state.fieldErrors?.displayName ? (
            <p className="mt-1 text-xs text-danger">{state.fieldErrors.displayName}</p>
          ) : null}
        </div>
      </section>

      {/* Step 1 — goal */}
      <section hidden={step !== 1} className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-tight">Qual é o seu principal objetivo?</h2>
        <RadioCardGroup name="goal" options={GOALS} defaultValue="HYPERTROPHY" />
      </section>

      {/* Step 2 — experience + frequency */}
      <section hidden={step !== 2} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold tracking-tight">Qual sua experiência com treino?</h2>
          <RadioCardGroup name="experience" options={EXPERIENCE} defaultValue="BEGINNER" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="daysPerWeek">Dias por semana</Label>
            <Select id="daysPerWeek" name="daysPerWeek" defaultValue={3} className="mt-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {d}x por semana
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sessionMinutes">Duração da sessão</Label>
            <Select id="sessionMinutes" name="sessionMinutes" defaultValue={60} className="mt-1.5">
              {SESSION_MINUTES.map((m) => (
                <option key={m} value={m}>
                  ~{m} min
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>Dias preferidos (opcional)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((label, i) => (
              <button
                type="button"
                key={label}
                onClick={() => togglePreferredDay(i)}
                className={cn(
                  "h-10 w-12 rounded-[var(--radius-sm)] border text-sm font-medium",
                  preferredDays.includes(i)
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-muted hover:bg-surface-2",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {preferredDays.map((d) => (
            <input key={d} type="hidden" name="preferredDays" value={d} />
          ))}
        </div>
      </section>

      {/* Step 3 — equipment + optional */}
      <section hidden={step !== 3} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold tracking-tight">Onde você vai treinar?</h2>
          <RadioCardGroup name="equipmentAccess" options={EQUIPMENT} defaultValue="FULL_GYM" />
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            name="doesEndurance"
            checked={doesEndurance}
            onChange={(e) => setDoesEndurance(e.target.checked)}
            className="size-4 accent-accent"
          />
          Também treino resistência/endurance (corrida, ciclismo etc.)
        </label>
        {doesEndurance ? (
          <Textarea
            name="enduranceNotes"
            placeholder="Ex.: corro 3x por semana, treinando para uma meia-maratona"
            maxLength={300}
          />
        ) : null}

        <div>
          <Label htmlFor="limitations">Limitações ou exercícios a evitar (opcional)</Label>
          <Textarea
            id="limitations"
            name="limitations"
            placeholder="Ex.: evitar agachamento profundo por causa do joelho"
            maxLength={500}
            className="mt-1.5"
          />
          <p className="mt-1.5 text-xs text-muted">
            A FGPOWER não é um serviço de diagnóstico médico. Para lesões, consulte um profissional de saúde.
          </p>
        </div>
      </section>

      <div className="mt-8 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={step === 0 ? "invisible" : ""}
        >
          Voltar
        </Button>
        {step < totalSteps - 1 ? (
          // key differs from the submit button below so React always mounts
          // a fresh DOM node when switching — reusing the same <button> node
          // while patching type="button" -> type="submit" mid-click can make
          // the browser apply the new type's default action (form submit)
          // to the very click that triggered the swap.
          <Button key="continue" type="button" onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}>
            Continuar
          </Button>
        ) : (
          <Button key="submit" type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Concluir"}
          </Button>
        )}
      </div>
    </form>
  );
}

function RadioCardGroup({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: { value: string; label: string; desc: string }[];
  defaultValue: string;
}) {
  const [selected, setSelected] = useState(defaultValue);
  return (
    <div className="grid gap-2.5">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            "flex cursor-pointer items-center justify-between rounded-[var(--radius-md)] border px-4 py-3.5 text-sm transition-colors",
            selected === opt.value ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2",
          )}
        >
          <span>
            <span className="block font-semibold">{opt.label}</span>
            <span className="block text-xs text-muted">{opt.desc}</span>
          </span>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={selected === opt.value}
            onChange={() => setSelected(opt.value)}
            className="size-4 accent-accent"
          />
        </label>
      ))}
    </div>
  );
}
