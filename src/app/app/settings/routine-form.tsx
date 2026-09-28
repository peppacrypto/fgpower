"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { formatDuration } from "@/lib/utils/format";
import { DaysMatchNote, WeekdayChips } from "@/app/onboarding/weekday-chips";
import { FieldError, FormError, useProfileSave } from "./profile-form";
import { INVALID_FIELD, SaveStatus } from "@/components/ui/save-status";

const SESSION_MINUTES = [30, 45, 60, 75, 90, 120];

interface Props {
  initial: {
    daysPerWeek: number;
    sessionMinutes: number;
    preferredDays: number[];
    doesEndurance: boolean;
    enduranceNotes: string;
    limitations: string;
  };
}

/** The onboarding answers about when and how the user trains. */
export function RoutineForm({ initial }: Props) {
  const { state, pending, onSubmit, onChange, field, formError, saveError } = useProfileSave();
  const [preferredDays, setPreferredDays] = useState<number[]>(initial.preferredDays);
  const [doesEndurance, setDoesEndurance] = useState(initial.doesEndurance);
  const [daysPerWeekValue, setDaysPerWeekValue] = useState(initial.daysPerWeek);
  const daysPerWeek = field("daysPerWeek");
  const sessionMinutes = field("sessionMinutes");
  const preferred = field("preferredDays");
  const enduranceNotes = field("enduranceNotes");
  const limitations = field("limitations");

  const minuteOptions = SESSION_MINUTES.includes(initial.sessionMinutes)
    ? SESSION_MINUTES
    : [...SESSION_MINUTES, initial.sessionMinutes].sort((a, b) => a - b);

  function toggleDay(day: number) {
    setPreferredDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)));
  }

  return (
    <form onSubmit={onSubmit} onChange={onChange} noValidate className="flex flex-col gap-4">
      <FormError error={formError} />

      <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
        <div>
          <Label htmlFor="daysPerWeek">Dias por semana</Label>
          <Select
            {...daysPerWeek.props}
            value={daysPerWeekValue}
            onChange={(e) => setDaysPerWeekValue(Number(e.target.value))}
            className={cn("mt-1.5", INVALID_FIELD)}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {d}x/semana
              </option>
            ))}
          </Select>
          <FieldError name="daysPerWeek" error={daysPerWeek.error} />
        </div>
        <div>
          <Label htmlFor="sessionMinutes">Duração da sessão</Label>
          <Select {...sessionMinutes.props} defaultValue={initial.sessionMinutes} className={cn("mt-1.5", INVALID_FIELD)}>
            {minuteOptions.map((m) => (
              <option key={m} value={m}>
                ~{formatDuration(m * 60)}
              </option>
            ))}
          </Select>
          <FieldError name="sessionMinutes" error={sessionMinutes.error} />
        </div>
      </div>

      <fieldset aria-describedby={preferred.error ? "preferredDays-error" : undefined}>
        <legend className="text-sm font-medium">Dias preferidos (opcional)</legend>
        <div className="mt-2">
          <WeekdayChips value={preferredDays} onToggle={toggleDay} />
        </div>
        <DaysMatchNote
          daysPerWeek={daysPerWeekValue}
          preferredCount={preferredDays.length}
          onUseCount={() => setDaysPerWeekValue(preferredDays.length)}
        />
        {/* Sentinel: tells the server this form owns preferredDays even when none are picked. */}
        <input type="hidden" name="preferredDays" value="" />
        {preferredDays.map((d) => (
          <input key={d} type="hidden" name="preferredDays" value={d} />
        ))}
        <FieldError name="preferredDays" error={preferred.error} />
      </fieldset>

      <div>
        <label className="flex items-center gap-2.5 text-sm font-medium">
          {/* Sentinel: an unticked checkbox sends nothing, "off" makes the untick explicit. */}
          <input type="hidden" name="doesEndurance" value="off" />
          <input
            type="checkbox"
            name="doesEndurance"
            checked={doesEndurance}
            onChange={(e) => setDoesEndurance(e.target.checked)}
            className="size-4 shrink-0 accent-accent"
          />
          Também treino resistência/endurance (corrida, ciclismo etc.)
        </label>
        {doesEndurance ? (
          <>
            <Textarea
              {...enduranceNotes.props}
              aria-label="Detalhes do treino de endurance"
              defaultValue={initial.enduranceNotes}
              placeholder="Ex.: corro 3x por semana, treinando para uma meia-maratona"
              maxLength={300}
              rows={2}
              className={cn("mt-2", INVALID_FIELD)}
            />
            <FieldError name="enduranceNotes" error={enduranceNotes.error} />
          </>
        ) : null}
      </div>

      <div>
        <Label htmlFor="limitations">Limitações ou exercícios a evitar (opcional)</Label>
        <Textarea
          {...limitations.props}
          defaultValue={initial.limitations}
          placeholder="Ex.: evitar agachamento profundo por causa do joelho"
          maxLength={500}
          rows={3}
          className={cn("mt-1.5", INVALID_FIELD)}
        />
        <FieldError name="limitations" error={limitations.error} />
        <p className="mt-1.5 text-xs text-muted">
          A FGPOWER não é um serviço de diagnóstico médico. Para lesões, consulte um profissional de saúde.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Salvando…" : "Salvar rotina"}
        </Button>
        <SaveStatus pending={false} savedAt={pending ? null : state.savedAt} error={saveError} />
      </div>
    </form>
  );
}
