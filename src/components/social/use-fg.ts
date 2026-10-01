"use client";

import { useState, useTransition } from "react";
import { giveFg, removeFg } from "@/lib/actions/social";
import { runAction } from "./run-action";

/** The FG button's tooltip: what the two letters mean (W-147). */
export const FG_TITLE = "FG — reconhecimento pelo treino";

/**
 * The first FG, explained where it's given, until the viewer gives one
 * (W-147): plain text under the heart, never a second FG button.
 */
export const FG_HINT = "FG é o reconhecimento pelo treino: toque no ♥ para dar o seu.";

/**
 * One FG toggle (feed card, activity page, Today's team strip): optimistic —
 * the heart and count change on tap, the server's count wins, and a refusal
 * or a failed call rolls both back with its message (offline, or an expired
 * session, which ActionErrorText turns into "Entrar").
 */
export function useFgToggle({
  activityId,
  initialGiven,
  initialCount,
}: {
  activityId: string;
  initialGiven: boolean;
  initialCount: number;
}) {
  const [given, setGiven] = useState(initialGiven);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const before = { given, count };
    const next = !given;
    setGiven(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
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

  return { given, count, error, pending, toggle };
}
