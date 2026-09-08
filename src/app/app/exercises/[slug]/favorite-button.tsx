"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleFavoriteExercise } from "@/lib/actions/favorites";

export function FavoriteButton({
  exerciseId,
  initialFavorited,
}: {
  exerciseId: string;
  initialFavorited: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={favorited ? "secondary" : "outline"}
      size="icon"
      disabled={pending}
      aria-pressed={favorited}
      aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      onClick={() => {
        setFavorited((f) => !f);
        startTransition(async () => {
          const result = await toggleFavoriteExercise(exerciseId);
          setFavorited(result.favorited);
        });
      }}
    >
      <Heart className="size-[18px]" fill={favorited ? "currentColor" : "none"} />
    </Button>
  );
}
