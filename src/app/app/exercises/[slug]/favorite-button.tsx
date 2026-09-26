"use client";

import { useEffect, useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleFavoriteExercise } from "@/lib/actions/favorites";
import { runAction } from "@/components/social/run-action";

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

  // The message floats over the title, so it can't linger: it goes away after
  // a few seconds, or as soon as the connection comes back.
  useEffect(() => {
    if (!error) return;
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
        setError(result.error);
      }
    });
  }

  return (
    <div className="relative">
      <Button
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
        <p
          id={`favorite-error-${exerciseId}`}
          role="alert"
          className="absolute right-0 top-full z-10 mt-1.5 w-56 bg-surface px-2 py-1.5 text-right text-xs text-danger shadow-[var(--shadow-sm)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
