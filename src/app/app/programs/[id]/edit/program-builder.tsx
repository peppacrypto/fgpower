"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { saveProgramDays, renameProgram, type BuilderDay, type BuilderExercise } from "@/lib/actions/program-builder";
import { ExercisePicker, type PickerExercise } from "./exercise-picker";
import { ExerciseRow } from "./exercise-row";

let uid = 0;
function nextId() {
  uid += 1;
  return `row-${uid}`;
}

interface EditableExercise extends BuilderExercise {
  rowId: string;
}
interface EditableDay extends Omit<BuilderDay, "exercises"> {
  exercises: EditableExercise[];
}

function toEditable(days: BuilderDay[]): EditableDay[] {
  return days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, rowId: nextId() })) }));
}

export function ProgramBuilder({
  programId,
  programName,
  programDescription,
  initialDays,
}: {
  programId: string;
  programName: string;
  programDescription: string;
  initialDays: BuilderDay[];
}) {
  const router = useRouter();
  const [name, setName] = useState(programName);
  const [description, setDescription] = useState(programDescription);
  const [days, setDays] = useState<EditableDay[]>(
    toEditable(initialDays.length ? initialDays : [{ name: "Dia 1", focus: null, exercises: [] }]),
  );
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeDay = days[activeDayIndex];

  function updateDay(index: number, patch: Partial<EditableDay>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    setSaved(false);
  }

  function addDay() {
    setDays((prev) => [...prev, { name: `Dia ${prev.length + 1}`, focus: null, exercises: [] }]);
    setActiveDayIndex(days.length);
    setSaved(false);
  }

  function removeDay(index: number) {
    setDays((prev) => prev.filter((_, i) => i !== index));
    setActiveDayIndex((i) => Math.max(0, Math.min(days.length - 2, i)));
    setSaved(false);
  }

  function moveDay(index: number, delta: number) {
    setDays((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setActiveDayIndex((i) => (i === index ? i + delta : i));
    setSaved(false);
  }

  function addExercise(picked: PickerExercise) {
    const newEx: EditableExercise = {
      rowId: nextId(),
      exerciseId: picked.id,
      exerciseName: picked.namePt,
      groupKey: null,
      sets: 3,
      repMin: 8,
      repMax: 12,
      rirTarget: 2,
      restSeconds: 120,
      warmupSets: 0,
      loadTargetKg: null,
      notes: null,
    };
    updateDay(activeDayIndex, { exercises: [...activeDay.exercises, newEx] });
  }

  function updateExercise(rowId: string, patch: Partial<BuilderExercise>) {
    updateDay(activeDayIndex, {
      exercises: activeDay.exercises.map((e) => (e.rowId === rowId ? { ...e, ...patch } : e)),
    });
  }

  function removeExercise(rowId: string) {
    updateDay(activeDayIndex, { exercises: activeDay.exercises.filter((e) => e.rowId !== rowId) });
  }

  function duplicateExercise(rowId: string) {
    const idx = activeDay.exercises.findIndex((e) => e.rowId === rowId);
    if (idx === -1) return;
    const copy = { ...activeDay.exercises[idx], rowId: nextId() };
    const next = [...activeDay.exercises];
    next.splice(idx + 1, 0, copy);
    updateDay(activeDayIndex, { exercises: next });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = activeDay.exercises.findIndex((e) => e.rowId === active.id);
    const newIndex = activeDay.exercises.findIndex((e) => e.rowId === over.id);
    updateDay(activeDayIndex, { exercises: arrayMove(activeDay.exercises, oldIndex, newIndex) });
  }

  function handleSave() {
    startSaving(async () => {
      await renameProgram(programId, name, description);
      await saveProgramDays(
        programId,
        days.map((d) => ({
          name: d.name,
          focus: d.focus,
          exercises: d.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            groupKey: e.groupKey,
            sets: e.sets,
            repMin: e.repMin,
            repMax: e.repMax,
            rirTarget: e.rirTarget,
            restSeconds: e.restSeconds,
            warmupSets: e.warmupSets,
            loadTargetKg: e.loadTargetKg,
            notes: e.notes,
          })),
        })),
      );
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSaved(false);
        }}
        placeholder="Nome do programa"
        className="border-none px-0 text-2xl font-bold tracking-tight shadow-none focus-visible:outline-none"
      />
      <Textarea
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          setSaved(false);
        }}
        placeholder="Descrição (opcional)"
        rows={2}
        className="mt-1 border-none px-0 text-sm text-muted shadow-none focus-visible:outline-none"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {days.map((day, i) => (
          <div key={i} className="flex items-center">
            <button
              onClick={() => setActiveDayIndex(i)}
              className={
                i === activeDayIndex
                  ? "rounded-[2px] border border-accent bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent"
                  : "rounded-[2px] border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface-2"
              }
            >
              {day.name}
            </button>
          </div>
        ))}
        <button
          onClick={addDay}
          className="flex items-center gap-1 rounded-[2px] border border-dashed border-border px-3 py-1.5 text-sm text-muted hover:bg-surface-2"
        >
          <Plus className="size-3.5" />
          Dia
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-md)] bg-surface-2 px-3.5 py-2.5">
        <Input
          value={activeDay.name}
          onChange={(e) => updateDay(activeDayIndex, { name: e.target.value })}
          className="h-8 flex-1 bg-transparent"
        />
        <button
          onClick={() => moveDay(activeDayIndex, -1)}
          disabled={activeDayIndex === 0}
          className="flex size-8 items-center justify-center rounded-[3px] text-muted hover:bg-surface disabled:opacity-30"
          aria-label="Mover dia para cima"
        >
          <ArrowUp className="size-4" />
        </button>
        <button
          onClick={() => moveDay(activeDayIndex, 1)}
          disabled={activeDayIndex === days.length - 1}
          className="flex size-8 items-center justify-center rounded-[3px] text-muted hover:bg-surface disabled:opacity-30"
          aria-label="Mover dia para baixo"
        >
          <ArrowDown className="size-4" />
        </button>
        {days.length > 1 ? (
          <button
            onClick={() => removeDay(activeDayIndex)}
            className="flex size-8 items-center justify-center rounded-[3px] text-muted hover:bg-surface hover:text-danger"
            aria-label="Remover dia"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        {activeDay.exercises.length === 0 ? (
          <p className="border-y-2 border-y-[var(--rule-heavy)] bg-surface-2 p-6 text-center text-sm text-muted">
            Nenhum exercício neste dia ainda.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={activeDay.exercises.map((e) => e.rowId)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2.5">
                {activeDay.exercises.map((ex) => (
                  <ExerciseRow
                    key={ex.rowId}
                    id={ex.rowId}
                    exercise={ex}
                    onChange={(patch) => updateExercise(ex.rowId, patch)}
                    onRemove={() => removeExercise(ex.rowId)}
                    onDuplicate={() => duplicateExercise(ex.rowId)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <Button variant="outline" className="mt-3 w-full" onClick={() => setPickerOpen(true)}>
          <Plus className="size-4" />
          Adicionar exercício
        </Button>
      </div>

      <div className="sticky bottom-16 mt-8 flex justify-end gap-2 border-t border-border bg-background py-4 sm:bottom-0">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Salvando…" : saved ? "Salvo" : "Salvar programa"}
        </Button>
      </div>

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addExercise} />
    </div>
  );
}
