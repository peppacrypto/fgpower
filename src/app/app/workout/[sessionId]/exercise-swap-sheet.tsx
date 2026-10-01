"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { GLoad } from "@/components/ui/glyph";
import { Input } from "@/components/ui/input";
import { Bone } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import type { ExerciseOption, ExerciseOptions } from "@/lib/data/workout-session";
import { WorkoutActionError, WorkoutLoggedOutError } from "./action-error";

/** Why an exercise is offered, as its tag says it. */
const REASON: Record<ExerciseOption["reason"], string | null> = {
  ORIGINAL: "Do programa",
  ALTERNATIVE: "Alternativa",
  REGRESSION: "Mais fácil",
  PROGRESSION: "Mais difícil",
  SAME_MUSCLE_PATTERN: "Mesmo movimento",
  SAME_MUSCLE: "Mesmo músculo",
  SEARCH: null,
  POPULAR: null,
};

/**
 * What the sheet does with a pick: swap the exercise in place, add the pick
 * right after it (the exercise already has sets), or add it at the end.
 */
export type SwapSheetMode =
  | { kind: "swap"; exerciseLogId: string; exerciseName: string; hasLocalData: boolean }
  | { kind: "add" };

/**
 * "Trocar" / "Adicionar exercício" mid-workout (W-006): the stand-ins for the
 * exercise (curated alternatives first, then the same muscle and movement on
 * the user's equipment) or a search of the library, as a native modal
 * <dialog> — full screen on phones, like the builder's picker. The pick is
 * saved by the parent (a server action); `error` and `busyId` come back from
 * it, so a failure at the gym (no signal) stays here with the list.
 */
export function ExerciseSwapSheet({
  sessionId,
  mode,
  busyId,
  error,
  loginHref,
  onLoggedOut,
  onPick,
  onClose,
}: {
  sessionId: string;
  mode: SwapSheetMode;
  /** The pick being saved: every row waits, that one says so. */
  busyId: string | null;
  error: string | null;
  /** Where "Entrar" goes when the login is gone (back to this exercise). */
  loginHref: string;
  /** The list's request found the login gone (401): the screen holds its sends too. */
  onLoggedOut?: () => void;
  /** `after`: add the pick after the exercise instead of swapping it (it already has sets). */
  onPick: (option: ExerciseOption, how: "swap" | "after" | "end") => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ExerciseOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  /** The list's request came back 401: nothing to retry until the user signs in again. */
  const [loggedOut, setLoggedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const busy = busyId !== null;
  const onLoggedOutRef = useRef(onLoggedOut);
  useEffect(() => {
    onLoggedOutRef.current = onLoggedOut;
  });
  const logId = mode.kind === "swap" ? mode.exerciseLogId : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const q = query.trim();
    const run = () => {
      setLoading(true);
      const params = new URLSearchParams({ session: sessionId });
      if (logId) params.set("log", logId);
      if (q.length >= 2) params.set("q", q);
      fetch(`/api/workout/exercises?${params}`, { signal: controller.signal })
        .then(async (res) => {
          if (res.status === 401) throw new WorkoutLoggedOutError();
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setResult((await res.json()) as ExerciseOptions);
          setFailed(false);
          setLoggedOut(false);
          setLoading(false);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          if (err instanceof WorkoutLoggedOutError) {
            setLoggedOut(true);
            onLoggedOutRef.current?.();
          } else {
            setFailed(true);
          }
          setLoading(false);
        });
    };
    // The first list comes at once; a search waits for a pause in typing.
    const t = setTimeout(run, q.length >= 2 ? 250 : 0);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [sessionId, logId, query, attempt]);

  const hasData = mode.kind === "swap" && (mode.hasLocalData || result?.hasData === true);
  const searching = query.trim().length >= 2;
  const how: "swap" | "after" | "end" = mode.kind === "add" ? "end" : hasData ? "after" : "swap";
  const options = result?.options ?? [];

  return (
    <dialog
      ref={dialogRef}
      // Named by what it does and for which exercise: "Trocar exercício Puxada Alta…".
      aria-labelledby="swap-kicker swap-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-dvw max-w-dvw bg-transparent p-0 text-foreground backdrop:bg-black/50 sm:m-auto sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg"
      data-swap-sheet
    >
      <div className="flex h-dvh flex-col bg-background sm:h-auto sm:max-h-[85vh] sm:border-t-2 sm:border-t-[var(--rule-heavy)]">
        {/* Full screen on phones: clear the status bar (installed PWA draws under it). */}
        <div className="border-b border-border px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pt-1">
              <span id="swap-kicker" className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">
                {mode.kind === "add" ? "Adicionar exercício" : "Trocar exercício"}
              </span>
              <h2 id="swap-title" className="text-display mt-1 text-xl font-extrabold leading-tight wrap-break-word">
                {mode.kind === "add" ? "No fim do treino" : mode.exerciseName}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Fechar"
              className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted hover:text-foreground disabled:opacity-40"
            >
              <X className="size-5" />
            </button>
          </div>
          {hasData ? (
            <p className="mt-2 border-l-2 border-l-warning bg-warning-soft px-3 py-2 text-xs text-foreground/90" data-swap-has-data>
              <span className="font-semibold">Este exercício já tem séries registradas.</span> O escolhido entra como
              novo exercício logo depois dele — o que você já fez continua salvo.
            </p>
          ) : null}
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              aria-label="Buscar exercício"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // A search box eats the first Escape to clear itself; one Escape closes the sheet.
                if (e.key === "Escape" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (!busy) onClose();
                }
              }}
              placeholder="Buscar pelo nome…"
              className="pl-9 text-base [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {error ? (
            <p role="alert" className="mb-3 border-l-2 border-l-danger! bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
              <WorkoutActionError error={error} loginHref={loginHref} />
            </p>
          ) : null}
          <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-muted">
            {searching ? "Resultados" : mode.kind === "add" ? "Mais usados" : "Sugestões para trocar"}
          </p>
          {loggedOut ? (
            <p role="alert" className="mt-2 border-l-2 border-l-danger! bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
              <WorkoutActionError error={SESSION_EXPIRED_ERROR} loginHref={loginHref} />
            </p>
          ) : failed ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 border-l-2 border-l-warning bg-warning-soft px-3 py-2 text-xs text-foreground/90">
              <span className="min-w-0 flex-1">Sem conexão — a lista não carregou.</span>
              <button
                type="button"
                onClick={() => setAttempt((a) => a + 1)}
                className="-my-2 min-h-11 font-semibold text-accent underline underline-offset-2"
              >
                Tentar de novo
              </button>
            </div>
          ) : loading && !result ? (
            <div className="mt-2 flex flex-col gap-2">
              <span className="sr-only">Carregando…</span>
              {[0, 1, 2, 3].map((i) => (
                <Bone key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : options.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              {searching ? "Nenhum exercício encontrado." : "Nenhuma sugestão para este exercício — busque pelo nome."}
            </p>
          ) : (
            <ul className={cn("mt-2 flex flex-col divide-y divide-border border-y border-border", loading && "opacity-60")}>
              {options.map((o) => {
                const tag = REASON[o.reason];
                const saving = busyId === o.id;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onPick(o, how)}
                      aria-label={`${how === "swap" ? "Trocar por" : "Adicionar"} ${o.namePt}`}
                      className="flex min-h-16 w-full items-center gap-3 py-2 text-left hover:bg-surface-2 disabled:opacity-60"
                    >
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-[3px] bg-surface-2">
                        {o.imageUrl ? (
                          <Image src={o.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-muted">
                            <GLoad className="size-5" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        {/* Whole: variants differ only at the end ("… - Pegada Aberta"). */}
                        <span className="block text-sm font-semibold leading-snug wrap-break-word">{o.namePt}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                          {o.equipment ? <span>{o.equipment}</span> : null}
                          {tag ? <span className="tag tag--mark text-xs">{tag}</span> : null}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent">
                        {saving ? (how === "swap" ? "Trocando…" : "Adicionando…") : how === "swap" ? "Trocar" : "Adicionar"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}
