"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { giveFg, removeFg } from "@/lib/actions/social";
import { runAction } from "@/components/social/run-action";

export function GiveFgButton({
  activityId,
  initialCount,
  initialGiven,
  isOwn,
}: {
  activityId: string;
  initialCount: number;
  initialGiven: boolean;
  isOwn: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [given, setGiven] = useState(initialGiven);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const before = { given, count };
    const next = !given;
    // Optimistic; rolled back if the server refuses or the call fails.
    setGiven(next);
    setCount((c) => c + (next ? 1 : -1));
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => (next ? giveFg(activityId) : removeFg(activityId)));
      if (result.ok) {
        setCount(result.fgCount);
      } else {
        setGiven(before.given);
        setCount(before.count);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant={given ? "secondary" : "outline"}
        disabled={pending || isOwn}
        aria-pressed={given}
        aria-label={`${isOwn ? "FGs no seu treino" : given ? "Remover seu FG" : "Dar FG neste treino"} (${count})`}
        onClick={toggle}
      >
        <Heart className="size-4" fill={given ? "currentColor" : "none"} />
        {count} {count === 1 ? "FG" : "FGs"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
