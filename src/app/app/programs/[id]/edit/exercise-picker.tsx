"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Dumbbell, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchExercisesForPicker } from "@/lib/actions/exercise-search";

export interface PickerExercise {
  id: string;
  namePt: string;
  imageUrl: string | null;
  primaryMuscle: string | null;
  equipment: string | null;
}

export function ExercisePicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: PickerExercise) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerExercise[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchExercisesForPicker(query));
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      className="m-0 h-dvh max-h-dvh w-dvw max-w-dvw bg-transparent p-0 backdrop:bg-black/50 sm:m-auto sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:rounded-[var(--radius-lg)]"
    >
      <div className="flex h-dvh flex-col bg-surface sm:h-auto sm:max-h-[85vh] sm:rounded-[var(--radius-lg)] sm:border sm:border-border">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar exercício…"
              className="pl-9"
            />
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-surface-2"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {pending ? (
            <p className="p-4 text-center text-sm text-muted">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted">Nenhum exercício encontrado.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {results.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => {
                    onSelect(ex);
                    onClose();
                  }}
                  className="flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-border text-left hover:border-accent/50"
                >
                  <div className="relative aspect-square w-full bg-surface-2">
                    {ex.imageUrl ? (
                      <Image src={ex.imageUrl} alt={ex.namePt} fill className="object-cover" sizes="150px" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted">
                        <Dumbbell className="size-6" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 text-xs font-semibold leading-tight">{ex.namePt}</p>
                    <p className="mt-0.5 text-[10px] text-muted">{ex.primaryMuscle}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
