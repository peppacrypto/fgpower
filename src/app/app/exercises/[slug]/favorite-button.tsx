"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleFavoriteExercise } from "@/lib/actions/favorites";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { isSessionExpiredError } from "@/lib/auth/session-expired";
import { cn } from "@/lib/utils/cn";

export function FavoriteButton({
  exerciseId,
  initialFavorited,
}: {
  exerciseId: string;
  initialFavorited: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const heartRef = useRef<HTMLButtonElement>(null);
  const expired = isSessionExpiredError(error);

  // The message floats over the page below the title, so a passing one can't
  // linger: it goes away after a few seconds, or as soon as the connection
  // comes back. An expired session stays, with its "Entrar" (waiting won't
  // fix it) — and a close button, so it never keeps covering what's under it.
  useEffect(() => {
    if (!error || isSessionExpiredError(error)) return;
    const clear = () => setError(null);
    const timer = setTimeout(clear, 4000);
    window.addEventListener("online", clear);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", clear);
    };
  }, [error]);

  function toggle() {
    const before = favorited;
    const next = !favorited;
    setFavorited(next);
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => toggleFavoriteExercise(exerciseId, next));
      if (result.ok) setFavorited(result.favorited);
      else {
        setFavorited(before);
        // A session gone comes back as SESSION_EXPIRED_ERROR, from the action or from runAction's own
        // check when the call itself was refused; ActionErrorText adds "Entrar" back to this exercise.
        setError(result.error);
      }
    });
  }

  return (
    <div className="relative">
      <Button
        ref={heartRef}
        variant={favorited ? "secondary" : "outline"}
        size="icon"
        disabled={pending}
        aria-pressed={favorited}
        aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        aria-describedby={error ? `favorite-error-${exerciseId}` : undefined}
        onClick={toggle}
      >
        <Heart className="size-[18px]" fill={favorited ? "currentColor" : "none"} />
      </Button>
      {error ? (
        <div
          className={cn(
            "absolute right-0 top-full z-10 mt-1.5 flex items-start bg-surface text-xs shadow-[var(--shadow-sm)]",
            expired ? "w-60" : "w-56",
          )}
        >
          <p id={`favorite-error-${exerciseId}`} role="alert" className="min-w-0 flex-1 px-2 py-1.5 text-right text-danger">
            <ActionErrorText error={error} />
          </p>
          {expired ? (
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => {
                setError(null);
                heartRef.current?.focus();
              }}
              className="flex size-11 shrink-0 items-center justify-center text-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
