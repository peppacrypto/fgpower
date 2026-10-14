"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { GLoad } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { Bone } from "@/components/ui/skeleton";
import { useRestoreFocus } from "@/components/ui/use-restore-focus";
import { YouTubeEmbed } from "@/components/exercises/youtube-embed";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";
import type { TechniqueSheet as TechniqueData } from "@/lib/data/workout-session";
import { WorkoutActionError, WorkoutLoggedOutError } from "./action-error";
import { SheetGrip } from "@/components/workout/sheet-grip";

/** Fetched once per exercise for the life of the page (the content rarely changes). */
const cache = new Map<string, Promise<TechniqueData | null>>();

/** The exercise's sheet; null when the server has none for it (404) — no connection problem, nothing to retry. */
function loadTechnique(exerciseId: string): Promise<TechniqueData | null> {
  let p = cache.get(exerciseId);
  if (!p) {
    p = fetch(`/api/workout/technique?exercise=${encodeURIComponent(exerciseId)}`).then((res) => {
      if (res.status === 404) return null;
      if (res.status === 401) throw new WorkoutLoggedOutError();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<TechniqueData>;
    });
    // A failure (no signal at the gym, the login gone) is tried again on the next open.
    p.catch(() => cache.delete(exerciseId));
    cache.set(exerciseId, p);
  }
  return p;
}

/**
 * "Ver técnica" without leaving the workout (W-025): the start and end frames,
 * the three cues to keep in mind and the way to the full page — as a native
 * modal <dialog> over the workout, so the rest timer keeps running and what
 * was typed stays on screen. "Ver página completa" leaves; the workout screen
 * keeps its place (?ex=) to come back to.
 */
export function TechniqueSheet({
  exercise,
  fullHref,
  loginHref,
  onLoggedOut,
  onClose,
}: {
  exercise: { exerciseId: string; name: string; imageUrl: string | null };
  fullHref: string;
  /** Where "Entrar" goes when the login is gone (back to this exercise). */
  loginHref: string;
  /** The request found the login gone (401): the screen holds its sends too. */
  onLoggedOut?: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  /** "missing": the server has no sheet for this exercise. */
  const [data, setData] = useState<TechniqueData | "missing" | null>(null);
  const [failed, setFailed] = useState(false);
  /** 401: nothing to retry until the user signs in again. */
  const [loggedOut, setLoggedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onLoggedOutRef = useRef(onLoggedOut);
  useEffect(() => {
    onLoggedOutRef.current = onLoggedOut;
  });
  useRestoreFocus();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus();
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, []);

  useEffect(() => {
    let live = true;
    loadTechnique(exercise.exerciseId)
      .then((d) => {
        if (!live) return;
        setData(d ?? "missing");
        setFailed(false);
      })
      .catch((err) => {
        if (!live) return;
        if (err instanceof WorkoutLoggedOutError) {
          setLoggedOut(true);
          onLoggedOutRef.current?.();
        } else {
          setFailed(true);
        }
      });
    return () => {
      live = false;
    };
  }, [exercise.exerciseId, attempt]);

  const sheet = data === "missing" ? null : data;
  const start = sheet?.images.start ?? exercise.imageUrl;
  const end = sheet?.images.end ?? null;
  const frame = (url: string | null, label: string) => (
    <figure className="min-w-0 flex-1">
      <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-md)] bg-surface">
        {url ? (
          <Image src={url} alt={`${exercise.name} — ${label.toLowerCase()} do movimento`} fill sizes="(max-width: 640px) 45vw, 240px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <GLoad className="size-6" />
          </div>
        )}
      </div>
      <figcaption className="mt-1.5 text-[13px] font-medium text-muted">{label}</figcaption>
    </figure>
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="technique-kicker technique-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-dvw max-w-dvw bg-transparent p-0 text-foreground backdrop:bg-black/45"
      data-technique-sheet
    >
      <div className="flex h-full w-full items-end justify-center sm:items-center" onClick={onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="sheet max-h-[calc(100dvh-env(safe-area-inset-top,0px))] w-full max-w-lg overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:pt-5"
        >
          <SheetGrip />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pt-1">
              <span id="technique-kicker" className="eyebrow text-accent">
                Técnica
              </span>
              <h2 id="technique-title" className="text-display mt-0.5 text-xl font-semibold leading-tight wrap-break-word">
                {exercise.name}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Fechar técnica"
              className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          {sheet?.videoUrl ? (
            <div className="mt-3">
              <YouTubeEmbed url={sheet.videoUrl} title={exercise.name} credit={sheet.videoCredit} />
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              {frame(start, "Início")}
              {frame(end, "Fim")}
            </div>
          )}

          <div className="mt-4" aria-live="polite">
            <p className="text-[15px] font-semibold">
              {sheet?.source === "instructions" ? "Passo a passo" : "Pontos-chave"}
            </p>
            {data === "missing" ? (
              <p className="mt-2 text-sm text-muted">Sem instruções para este exercício.</p>
            ) : data ? (
              data.cues.length > 0 ? (
                <ol className="mt-2 flex flex-col gap-2.5">
                  {data.cues.map((cue, i) => (
                    <li key={i} className="flex gap-3 text-[15px] leading-snug">
                      {/* The step's place in the movement, as a list counts it (no decorative "01"). */}
                      <span
                        aria-hidden
                        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold tabular-nums text-accent"
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 wrap-break-word">{cue}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-muted">Sem instruções escritas para este exercício ainda.</p>
              )
            ) : loggedOut ? (
              <p role="alert" className="mt-2 rounded-[var(--radius-md)] bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
                <WorkoutActionError error={SESSION_EXPIRED_ERROR} loginHref={loginHref} />
              </p>
            ) : failed ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 rounded-[var(--radius-md)] bg-warning-soft px-3 py-1 text-[13px] text-foreground">
                <span className="min-w-0 flex-1">Sem conexão — as instruções não carregaram.</span>
                <button
                  type="button"
                  onClick={() => {
                    setFailed(false);
                    setAttempt((a) => a + 1);
                  }}
                  className="-my-2 min-h-11 font-semibold text-accent underline underline-offset-2"
                >
                  Tentar de novo
                </button>
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <span className="sr-only">Carregando…</span>
                <Bone className="h-4 w-11/12" />
                <Bone className="h-4 w-10/12" />
                <Bone className="h-4 w-9/12" />
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Button size="lg" className="w-full" onClick={onClose}>
              Voltar ao treino
            </Button>
            <Button size="lg" variant="ghost" className="w-full" asChild>
              <Link href={fullHref}>
                Ver página completa
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
