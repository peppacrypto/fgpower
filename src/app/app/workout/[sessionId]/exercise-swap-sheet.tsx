"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { Search, X } from "lucide-react";
import { GLoad } from "@/components/ui/glyph";
import { Input } from "@/components/ui/input";
import { Bone } from "@/components/ui/skeleton";
import { useRestoreFocus } from "@/components/ui/use-restore-focus";
import { cn } from "@/lib/utils/cn";
import { SESSION_EXPIRED_ERROR, isSessionExpiredError } from "@/lib/auth/session-expired";
import { markGearMissing } from "@/lib/actions/gym";
import { describeActionFailure, OFFLINE_ERROR } from "@/components/social/run-action";
import type { ExerciseOption, ExerciseOptions } from "@/lib/data/workout-session";
import type { ExecutionExerciseLog } from "./types";
import { WorkoutActionError, WorkoutLoggedOutError } from "./action-error";
import { lackedList } from "./gear-words";
import { SheetGrip } from "@/components/workout/sheet-grip";

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
 * right after it (the exercise already has sets), or add it at the end. A
 * swap carries the exercise's gear (Minha academia): "Não tenho este
 * aparelho" lives here, and a pick for a machine the gym doesn't have
 * replaces the exercise in the plan.
 */
export type SwapSheetMode =
  | {
      kind: "swap";
      exerciseLogId: string;
      exerciseName: string;
      hasLocalData: boolean;
      gear: ExecutionExerciseLog["gear"];
      /** A program slot: a pick for a missing machine replaces it in the plan too. */
      inPlan: boolean;
    }
  | { kind: "add" };

/**
 * "Trocar" / "Adicionar exercício" mid-workout (W-006): the stand-ins for the
 * exercise (curated alternatives first, then the same muscle and movement on
 * the gear the user's gym has) or a search of the library, as a native modal
 * <dialog> — full screen on phones, like the builder's picker. The pick is
 * saved by the parent (a server action); `error` and `busyId` come back from
 * it, so a failure at the gym (no signal) stays here with the list.
 *
 * The gym's gear is the one thing saved from here: "Não tenho este aparelho"
 * notes the exercise's apparatus as missing (Settings → Minha academia →
 * Aparelhos, markGearMissing), the list comes back without what needs it, and
 * "Desfazer" takes it back. An exercise with more than one apparatus offers
 * each on its own — lacking a lat pulldown station says nothing about the
 * crossover the same pulldown can be done on. Once the gym has none of them
 * (marked here or before), the sheet is in "missing" mode: the pick is
 * "Trocar no plano" — the parent swaps today and then the plan's coming weeks
 * (applySwapToPlan) — while a plain "Trocar" (the machine is only taken)
 * stays today's.
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
  /** The list's request (or a gear note) found the login gone: the screen holds its sends too. */
  onLoggedOut?: () => void;
  /**
   * `after`: add the pick after the exercise instead of swapping it (it
   * already has sets). `plan`: the gym lacks the exercise's gear — the pick
   * replaces it in the plan too, not only today.
   */
  onPick: (option: ExerciseOption, how: "swap" | "after" | "end", plan: boolean) => void;
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
  const gear = mode.kind === "swap" ? mode.gear : [];
  /** The exercise's gear the gym lacks, as the last answer from the server has it. */
  const [missing, setMissing] = useState<ReadonlySet<string>>(() => new Set(gear.filter((g) => g.missing).map((g) => g.id)));
  /** Gear noted as missing from this sheet: what "Desfazer" takes back. */
  const [markedHere, setMarkedHere] = useState<string[]>([]);
  const [gearError, setGearError] = useState<string | null>(null);
  /**
   * What a gear note just did, for screen readers. The sheet's own live
   * region: behind a modal dialog the workout's announcer is inert.
   */
  const [gearNews, setGearNews] = useState("");
  const [gearPending, startGear] = useTransition();
  const busy = busyId !== null;
  const onLoggedOutRef = useRef(onLoggedOut);
  useEffect(() => {
    onLoggedOutRef.current = onLoggedOut;
  });
  const logId = mode.kind === "swap" ? mode.exerciseLogId : null;
  useRestoreFocus();

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

  /**
   * Notes gear as missing in the user's gym (`isMissing`) — or as there after
   * all — then lists the stand-ins again: the server leaves out what the gym
   * can't do. Nothing changes in the workout itself. Offline it says so here.
   */
  function noteGear(ids: string[], isMissing: boolean) {
    if (ids.length === 0 || gearPending || busy) return;
    setGearError(null);
    startGear(async () => {
      try {
        const r = await markGearMissing(ids, isMissing);
        if (!r.ok) {
          if (isSessionExpiredError(r.error)) onLoggedOutRef.current?.();
          setGearError(r.error);
          return;
        }
        setMissing(new Set(r.missingGear));
        setMarkedHere((m) => (isMissing ? [...new Set([...m, ...ids])] : m.filter((id) => !ids.includes(id))));
        const names = gear.filter((g) => ids.includes(g.id)).map((g) => g.namePt);
        setGearNews(
          isMissing
            ? `Anotado: sua academia não tem ${lackedList(names)}. A lista mostra o que dá para fazer nela.`
            : `${names.join(", ")} de volta na sua academia.`,
        );
        setAttempt((a) => a + 1);
      } catch (err) {
        // A new build was deployed mid-workout: reload to pick it up (the sets are mirrored locally).
        if (unstable_isUnrecognizedActionError(err)) {
          window.location.reload();
          return;
        }
        const { error: why } = await describeActionFailure();
        if (isSessionExpiredError(why)) onLoggedOutRef.current?.();
        setGearError(
          isSessionExpiredError(why)
            ? SESSION_EXPIRED_ERROR
            : why === OFFLINE_ERROR
              ? "Sem conexão — nada foi anotado. Tente de novo quando o sinal voltar."
              : "Não foi possível anotar agora. Tente de novo.",
        );
      }
    });
  }

  const hasData = mode.kind === "swap" && (mode.hasLocalData || result?.hasData === true);
  const searching = query.trim().length >= 2;
  const how: "swap" | "after" | "end" = mode.kind === "add" ? "end" : hasData ? "after" : "swap";
  const options = result?.options ?? [];
  /** The gym has none of the exercise's gear: the pick is a stand-in for good. */
  const blocked = gear.length > 0 && gear.every((g) => missing.has(g.id));
  const plan = blocked && mode.kind === "swap" && mode.inPlan;
  /** What each pick says it does — its words, while it is saved, and its accessible name. */
  const verb = plan ? "Trocar no plano" : how === "swap" ? "Trocar" : "Adicionar";
  const doing = plan || how === "swap" ? "Trocando…" : "Adicionando…";
  const pickLabel = plan ? "Trocar no plano por" : how === "swap" ? "Trocar por" : "Adicionar";
  const available = gear.filter((g) => !missing.has(g.id));
  const markedNames = gear.filter((g) => markedHere.includes(g.id)).map((g) => g.namePt);

  return (
    <dialog
      ref={dialogRef}
      // Named by what it does and for which exercise: "Trocar exercício Puxada Alta…".
      aria-labelledby="swap-kicker swap-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-dvw max-w-dvw bg-transparent p-0 text-foreground backdrop:bg-black/45 sm:m-auto sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg"
      data-swap-sheet
    >
      {/* A tall sheet on phones (the list and the keyboard share the screen), clear of the status bar
          (installed PWA draws under it); a centered panel from sm. */}
      <div className="sheet mt-[max(0.75rem,env(safe-area-inset-top))] flex h-[calc(100dvh-max(0.75rem,env(safe-area-inset-top)))] flex-col overflow-hidden sm:mt-0 sm:h-auto sm:max-h-[85vh]">
        <div className="border-b border-border px-4 pb-3 pt-3 sm:pt-5">
          <SheetGrip className="mb-2" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pt-1">
              <span id="swap-kicker" className="eyebrow text-accent">
                {mode.kind === "add" ? "Adicionar exercício" : "Trocar exercício"}
              </span>
              <h2 id="swap-title" className="text-display mt-0.5 text-xl font-semibold leading-tight wrap-break-word">
                {mode.kind === "add" ? "No fim do treino" : mode.exerciseName}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Fechar"
              className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
            >
              <X className="size-5" />
            </button>
          </div>
          {hasData ? (
            <p className="mt-2 rounded-[var(--radius-md)] bg-warning-soft px-3 py-2.5 text-[13px] text-foreground" data-swap-has-data>
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
          <p role="status" className="sr-only">
            {gearNews}
          </p>
          {gear.length > 0 ? (
            // The exercise's apparatus and the gym's answer about it (Minha academia).
            <div className="mb-4 text-[13px]" data-swap-gear>
              {markedHere.length > 0 ? (
                <div className="flex items-center gap-x-3 rounded-[var(--radius-md)] bg-warning-soft py-1 pl-3 pr-2 text-foreground">
                  <span className="min-w-0 flex-1 py-1.5">
                    <span className="font-semibold">Anotado:</span> sua academia não tem {lackedList(markedNames)}
                  </span>
                  <button
                    type="button"
                    onClick={() => noteGear(markedHere, false)}
                    disabled={gearPending || busy}
                    className="-my-1 min-h-11 shrink-0 px-1 font-semibold text-accent underline underline-offset-2 disabled:opacity-50"
                  >
                    Desfazer
                  </button>
                </div>
              ) : blocked ? (
                <div className="flex items-center gap-x-3 rounded-[var(--radius-md)] bg-warning-soft py-1 pl-3 pr-2 text-foreground">
                  <span className="min-w-0 flex-1 py-1.5">
                    <span className="font-semibold">Sua academia não tem:</span> {gear.map((g) => g.namePt).join(", ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => noteGear(gear.map((g) => g.id), false)}
                    disabled={gearPending || busy}
                    className="-my-1 min-h-11 shrink-0 px-1 font-semibold text-accent underline underline-offset-2 disabled:opacity-50"
                  >
                    {gear.length === 1 ? "Tenho este aparelho" : "Tenho um deles"}
                  </button>
                </div>
              ) : null}
              {blocked ? (
                <p className="mt-1.5 text-muted">
                  {plan
                    ? "O escolhido entra no lugar dele no seu plano — hoje e nas próximas semanas."
                    : "O escolhido entra no lugar dele neste treino."}
                </p>
              ) : (
                <div className={cn("flex flex-wrap items-center gap-x-3", markedHere.length > 0 && "mt-1.5")}>
                  <p className="min-w-0 flex-1 py-1 text-muted">
                    {markedHere.length > 0 ? "Dá para fazer em: " : "Aparelho: "}
                    <span className="text-foreground">{available.map((g) => g.namePt).join(" ou ")}</span>
                  </p>
                  {available.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => noteGear([g.id], true)}
                      disabled={gearPending || busy}
                      className="-my-1 min-h-11 shrink-0 font-semibold text-accent disabled:opacity-50"
                    >
                      {/* One apparatus: "este aparelho" is the one named; several: each by its name. */}
                      {available.length === 1 ? "Não tenho este aparelho" : `Não tenho ${g.namePt}`}
                    </button>
                  ))}
                </div>
              )}
              {gearError ? (
                <p role="alert" className="mt-1.5 font-medium text-danger">
                  <WorkoutActionError error={gearError} loginHref={loginHref} />
                </p>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="mb-3 rounded-[var(--radius-md)] bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger">
              <WorkoutActionError error={error} loginHref={loginHref} />
            </p>
          ) : null}
          <p className="eyebrow">
            {searching ? "Resultados" : mode.kind === "add" ? "Mais usados" : "Sugestões para trocar"}
          </p>
          {loggedOut ? (
            <p role="alert" className="mt-2 rounded-[var(--radius-md)] bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger">
              <WorkoutActionError error={SESSION_EXPIRED_ERROR} loginHref={loginHref} />
            </p>
          ) : failed ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 rounded-[var(--radius-md)] bg-warning-soft px-3 py-1 text-[13px] text-foreground">
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
            <ul className={cn("mt-1 flex flex-col divide-y divide-border", (loading || gearPending) && "opacity-60")}>
              {options.map((o) => {
                const tag = REASON[o.reason];
                const saving = busyId === o.id;
                // The apparatus it is done on ("Leg press") says more than the catalog's tag ("Máquina").
                const where = o.gearPt ?? o.equipment;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      disabled={busy || gearPending}
                      onClick={() => onPick(o, how, plan)}
                      aria-label={`${pickLabel} ${o.namePt}`}
                      className="-mx-2 flex min-h-16 w-[calc(100%+1rem)] items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 text-left hover:bg-surface-2 disabled:opacity-60"
                    >
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-surface-2">
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
                          {where ? <span>{where}</span> : null}
                          {tag ? <span className="tag tag--spec text-xs">{tag}</span> : null}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold text-accent">{saving ? doing : verb}</span>
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
