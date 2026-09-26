"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { followUser, unfollowUser } from "@/lib/actions/social";
import { runAction } from "@/components/social/run-action";

type FollowState = "NONE" | "REQUESTED" | "FOLLOWING";

export function FollowButton({
  targetUserId,
  initialFollowing,
  initialPending,
  isPrivate,
}: {
  targetUserId: string;
  initialFollowing: boolean;
  initialPending: boolean;
  isPrivate: boolean;
}) {
  const [state, setState] = useState<FollowState>(
    initialFollowing ? "FOLLOWING" : initialPending ? "REQUESTED" : "NONE",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  function run(optimistic: FollowState, call: () => Promise<{ ok: true; status?: FollowState } | { ok: false; error: string }>) {
    const before = state;
    setState(optimistic);
    setError(null);
    startTransition(async () => {
      const result = await runAction(call);
      if (result.ok) {
        if (result.status) setState(result.status);
      } else {
        setState(before);
        setError(result.error);
      }
    });
  }

  let button: React.ReactNode;
  if (state === "FOLLOWING") {
    button = (
      <Button variant="secondary" disabled={loading} onClick={() => run("NONE", () => unfollowUser(targetUserId))}>
        Seguindo
      </Button>
    );
  } else if (state === "REQUESTED") {
    button = (
      <Button variant="outline" disabled={loading} onClick={() => run("NONE", () => unfollowUser(targetUserId))}>
        Solicitação enviada
      </Button>
    );
  } else {
    button = (
      <Button disabled={loading} onClick={() => run(isPrivate ? "REQUESTED" : "FOLLOWING", () => followUser(targetUserId))}>
        {isPrivate ? "Solicitar seguir" : "Seguir"}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {button}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
