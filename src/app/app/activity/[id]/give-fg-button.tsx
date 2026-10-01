"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { ActionErrorText } from "@/components/social/session-expired";
import { FG_HINT, FG_TITLE, useFgToggle } from "@/components/social/use-fg";

/** The activity page's FG: the same toggle as the feed card, with the count spelled out. */
export function GiveFgButton({
  activityId,
  initialCount,
  initialGiven,
  isOwn,
  hint = false,
  className,
}: {
  activityId: string;
  initialCount: number;
  initialGiven: boolean;
  isOwn: boolean;
  /** The viewer never gave an FG: say what it is under the button (W-147). */
  hint?: boolean;
  className?: string;
}) {
  const fg = useFgToggle({ activityId, initialGiven, initialCount });

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Button
        variant={fg.given ? "secondary" : "outline"}
        disabled={fg.pending || isOwn}
        aria-pressed={fg.given}
        title={FG_TITLE}
        aria-label={`${isOwn ? "FGs no seu treino" : fg.given ? "Remover seu FG" : "Dar FG neste treino"} (${fg.count})`}
        onClick={fg.toggle}
        className="self-start"
      >
        <Heart className="size-4" fill={fg.given ? "currentColor" : "none"} />
        {fg.count} {fg.count === 1 ? "FG" : "FGs"}
      </Button>
      {hint && !isOwn && !fg.given ? <p className="text-xs text-muted">{FG_HINT}</p> : null}
      {fg.error ? (
        <p role="alert" className="text-xs text-danger">
          <ActionErrorText error={fg.error} />
        </p>
      ) : null}
    </div>
  );
}
