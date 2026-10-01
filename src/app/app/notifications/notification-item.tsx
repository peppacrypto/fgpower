"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/misc";
import { Lettermark } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/social/follow-button";
import { respondToFollowRequest } from "@/lib/actions/social";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import type { NotificationLine } from "@/lib/data/social";
import { notificationText, type RequestStatus } from "@/lib/social/notification-text";
import { cn } from "@/lib/utils/cn";

/**
 * One line of the notifications timeline (W-042, W-138): who, what, when, and
 * where it leads. A follow request answers in place — its line says what
 * happened ("Ana agora segue você") — and someone who follows you gets
 * "Seguir de volta". Buttons sit under the linked text, never inside it. Each
 * line is a single bordered block (e2e finds a line by its text).
 *
 * What this visit showed stays through a server re-render (a refresh, the
 * session cookie refreshed inside an action, the app resuming): a line that
 * was new keeps its marker after the page marked it seen, and a "Seguir de
 * volta" offered stays (reading "Seguindo" once tapped) after the server says
 * FOLLOWING. An answered request is the server's own state.
 */
export function NotificationItem({ line }: { line: NotificationLine }) {
  const [status, setStatus] = useState<RequestStatus | null>(line.followRequest?.status ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // New when this visit showed it: MarkSeen marks it read right away.
  const [shownNew] = useState(line.unread);
  const isNew = shownNew || line.unread;
  const rowRef = useRef<HTMLDivElement>(null);

  const actor = line.actors[0] ?? null;
  const text = notificationText({
    type: line.type,
    data: line.data,
    actorNames: line.actors.map((a) => a.name),
    workoutName: line.workoutName,
    requestStatus: status,
  });
  const request = line.type === "FOLLOW_REQUEST" ? line.followRequest : null;
  // "Seguir de volta" is offered for someone you don't follow: decided when the
  // line is shown or the request accepted, not again on a later server render.
  const [offerFollowBack, setOfferFollowBack] = useState(
    () => line.followBack?.relation === "NONE" && (line.type === "NEW_FOLLOWER" || status === "ACCEPTED"),
  );
  const followBack = actor && offerFollowBack ? line.followBack : null;

  // Answered here: the buttons are gone, so the focus stays on this line (its link).
  const [answeredHere, setAnsweredHere] = useState(false);
  useEffect(() => {
    if (answeredHere) rowRef.current?.querySelector<HTMLElement>("a[href], [data-line-status]")?.focus();
  }, [answeredHere]);

  function respond(accept: boolean) {
    if (!request) return;
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => respondToFollowRequest(request.id, accept));
      if (result.ok) {
        setStatus(result.status);
        if (result.status === "ACCEPTED" && line.followBack?.relation === "NONE") setOfferFollowBack(true);
        setAnsweredHere(true);
      } else {
        setError(result.error);
      }
    });
  }

  const content = (
    <div className="flex items-center gap-3 py-3.5">
      <Faces line={line} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm [overflow-wrap:anywhere]", isNew && "font-semibold")}>{text}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted">
          <time dateTime={line.at} title={line.fullTime}>
            {line.timeLabel}
          </time>
        </p>
      </div>
      {isNew ? (
        <span className="size-2 shrink-0 bg-accent" data-unread-marker>
          <span className="sr-only">Nova</span>
        </span>
      ) : null}
    </div>
  );

  return (
    <div ref={rowRef} className="border-b border-border px-1" data-notification={line.type} data-unread={isNew ? "true" : undefined}>
      {line.href ? (
        <Link href={line.href} className="block hover:bg-surface-2/60">
          {content}
        </Link>
      ) : (
        content
      )}

      {request ? (
        <div className="pb-3">
          {status === "PENDING" ? (
            <div className="flex gap-2">
              <Button size="sm" disabled={pending} onClick={() => respond(true)}>
                Aceitar
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => respond(false)}>
                Recusar
              </Button>
            </div>
          ) : null}
          <div role="status" tabIndex={-1} data-line-status className="flex flex-wrap items-center gap-2 outline-none">
            {status === "ACCEPTED" ? <span className="tag tag--status tag--ok">Solicitação aceita</span> : null}
            {status === "DECLINED" ? <span className="tag tag--status tag--info">Solicitação recusada</span> : null}
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-xs text-danger">
              <ActionErrorText error={error} />
            </p>
          ) : null}
        </div>
      ) : null}

      {followBack && actor ? (
        <div className="pb-3">
          <FollowButton
            targetUserId={actor.id}
            username={actor.username}
            name={actor.name}
            initialRelation="NONE"
            isPrivate={followBack.isPrivate}
            size="sm"
            followLabel="Seguir de volta"
          />
        </div>
      ) : null}
    </div>
  );
}

/** The person (or, for several FGs, up to three stacked), or the app's mark for your own achievements. */
function Faces({ line }: { line: NotificationLine }) {
  if (line.actors.length === 0) {
    return <Lettermark code="FG" className="size-9 shrink-0 text-[10px]" />;
  }
  if (line.actors.length === 1) {
    const a = line.actors[0];
    return (
      <span aria-hidden className="shrink-0">
        <Avatar src={a.image} name={a.name} size={36} />
      </span>
    );
  }
  const shown = line.actors.slice(0, 3);
  return (
    <span aria-hidden className="flex w-[4.25rem] shrink-0 items-center">
      {shown.map((a, i) => (
        <Avatar
          key={a.id}
          src={a.image}
          // One initial each: on overlapping faces a second letter is cut in half.
          name={a.name.trim().split(/\s+/)[0] ?? a.name}
          size={28}
          className={cn("ring-2 ring-background", i > 0 && "-ml-2")}
        />
      ))}
    </span>
  );
}
