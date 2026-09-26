"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { GLoad } from "@/components/ui/glyph";
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
      className="m-0 h-dvh max-h-dvh w-dvw max-w-dvw bg-transparent p-0 backdrop:bg-black/50 sm:m-auto sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:rounded-[3px]"
    >
      <div className="flex h-dvh flex-col bg-surface sm:h-auto sm:max-h-[85vh] sm:rounded-[3px] sm:border-t-2 sm:border-t-[var(--rule-heavy)]">
        {/* Full screen on phones: clear the status bar / notch (installed PWA
            draws under it) and keep the search at 16px so iOS doesn't zoom. */}
        <div className="flex items-center gap-2 border-b border-border p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              autoFocus
              type="search"
              enterKeyHint="search"
              aria-label="Buscar exercício"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // A search box eats the first Escape to clear itself; one Escape
              // should close the picker, as it does with the box empty.
              onKeyDown={(e) => {
                if (e.key === "Escape" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  onClose();
                }
              }}
              placeholder="Buscar exercício…"
              className="pl-9 text-base sm:text-sm [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-11 shrink-0 items-center justify-center rounded-[3px] hover:bg-surface-2 sm:size-9"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
          {pending ? (
            <p className="p-4 text-center text-sm text-muted">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted">Nenhum exercício encontrado.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {results.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => {
                    onSelect(ex);
                    onClose();
                  }}
                  className="reg-frame is-link flex flex-col text-left"
                >
                  <div className="relative aspect-square w-full bg-surface-2">
                    {ex.imageUrl ? (
                      <Image src={ex.imageUrl} alt={ex.namePt} fill className="object-cover" sizes="150px" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted">
                        <GLoad className="size-6" />
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
