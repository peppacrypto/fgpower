"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { followUser, unfollowUser } from "@/lib/actions/social";

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
  const [following, setFollowing] = useState(initialFollowing);
  const [requestPending, setRequestPending] = useState(initialPending);
  const [loading, startTransition] = useTransition();

  if (following) {
    return (
      <Button
        variant="secondary"
        disabled={loading}
        onClick={() =>
          startTransition(async () => {
            await unfollowUser(targetUserId);
            setFollowing(false);
          })
        }
      >
        Seguindo
      </Button>
    );
  }

  if (requestPending) {
    return (
      <Button
        variant="outline"
        disabled={loading}
        onClick={() =>
          startTransition(async () => {
            await unfollowUser(targetUserId);
            setRequestPending(false);
          })
        }
      >
        Solicitação enviada
      </Button>
    );
  }

  return (
    <Button
      disabled={loading}
      onClick={() =>
        startTransition(async () => {
          await followUser(targetUserId);
          if (isPrivate) setRequestPending(true);
          else setFollowing(true);
        })
      }
    >
      {isPrivate ? "Solicitar seguir" : "Seguir"}
    </Button>
  );
}
