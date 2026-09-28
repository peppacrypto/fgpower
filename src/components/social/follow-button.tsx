"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { followUser, unfollowUser } from "@/lib/actions/social";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";

/** The viewer's relation to a person: following, a request waiting, or neither. */
export type FollowRelation = "NONE" | "REQUESTED" | "FOLLOWING";

export interface FollowButtonProps {
  targetUserId: string;
  /** The person's @handle (confirm copy: "Deixar de seguir @ana?"); null when they have none. */
  username: string | null;
  /** Their display name. */
  name: string;
  initialRelation: FollowRelation;
  /** A private account: following is a request ("Solicitar seguir" → "Solicitação enviada"). */
  isPrivate: boolean;
  /** "sm" in rows (Descobrir, notifications, follower lists, Today). */
  size?: "default" | "sm";
  /** Replaces the NONE state's label, e.g. "Seguir de volta". */
  followLabel?: string;
  /** Called with the relation the server settled on after a tap. */
  onRelationChange?: (relation: FollowRelation) => void;
}

/**
 * Follow / request / unfollow one person — shared by /u, Descobrir,
 * notifications, follower lists and Today. Optimistic: one tap acts, the
 * server's answer wins, and a failure rolls back with its message (an
 * expired session offers "Entrar"). The exact labels are asserted by e2e.
 */
export function FollowButton({
  targetUserId,
  isPrivate,
  initialRelation,
  size = "default",
  followLabel,
  onRelationChange,
}: FollowButtonProps) {
  const [state, setState] = useState<FollowRelation>(initialRelation);
  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();
  const buttonSize = size === "sm" ? "sm" : undefined;

  function run(optimistic: FollowRelation, call: () => Promise<{ ok: true; status?: FollowRelation } | { ok: false; error: string }>) {
    const before = state;
    setState(optimistic);
    setError(null);
    startTransition(async () => {
      const result = await runAction(call);
      if (result.ok) {
        const settled = result.status ?? optimistic;
        setState(settled);
        onRelationChange?.(settled);
      } else {
        setState(before);
        setError(result.error);
      }
    });
  }

  let button: React.ReactNode;
  if (state === "FOLLOWING") {
    button = (
      <Button variant="secondary" size={buttonSize} disabled={loading} onClick={() => run("NONE", () => unfollowUser(targetUserId))}>
        Seguindo
      </Button>
    );
  } else if (state === "REQUESTED") {
    button = (
      <Button variant="outline" size={buttonSize} disabled={loading} onClick={() => run("NONE", () => unfollowUser(targetUserId))}>
        Solicitação enviada
      </Button>
    );
  } else {
    button = (
      <Button
        size={buttonSize}
        disabled={loading}
        onClick={() => run(isPrivate ? "REQUESTED" : "FOLLOWING", () => followUser(targetUserId))}
      >
        {followLabel ?? (isPrivate ? "Solicitar seguir" : "Seguir")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {button}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}
    </div>
  );
}
