"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { giveFg, removeFg } from "@/lib/actions/social";

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
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={given ? "secondary" : "outline"}
      disabled={pending || isOwn}
      onClick={() => {
        const next = !given;
        setGiven(next);
        setCount((c) => c + (next ? 1 : -1));
        startTransition(async () => {
          if (next) await giveFg(activityId);
          else await removeFg(activityId);
        });
      }}
    >
      <Heart className="size-4" fill={given ? "currentColor" : "none"} />
      {count} {count === 1 ? "FG" : "FGs"}
    </Button>
  );
}
