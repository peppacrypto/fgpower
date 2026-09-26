"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { respondToFollowRequest } from "@/lib/actions/social";
import { runAction } from "@/components/social/run-action";
import { formatAppDate } from "@/lib/training/week";

const TYPE_TEXT: Record<string, (actor: string) => string> = {
  FG_RECEIVED: (a) => `${a} deu FG no seu treino`,
  NEW_FOLLOWER: (a) => `${a} começou a seguir você`,
  FOLLOW_REQUEST: (a) => `${a} pediu para seguir você`,
  FOLLOW_ACCEPTED: (a) => `${a} aceitou sua solicitação`,
  PERSONAL_RECORD: () => `Você bateu um novo recorde`,
  PROGRAM_WEEK_COMPLETE: () => `Você completou uma semana do programa`,
  PROGRAM_COMPLETED: () => `Você completou um programa`,
};

export interface NotificationData {
  id: string;
  type: string;
  createdAt: Date | string;
  readAt: Date | string | null;
  actor: { name: string; username: string | null; image: string | null } | null;
  activity: { id: string } | null;
  followRequest: { id: string; status: string } | null;
}

export function NotificationItem({ notification }: { notification: NotificationData }) {
  const [status, setStatus] = useState(notification.followRequest?.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const actorName = notification.actor?.name ?? "Alguém";
  const text = TYPE_TEXT[notification.type]?.(actorName) ?? "Nova notificação";
  const href = notification.activity ? `/app/activity/${notification.activity.id}` : notification.actor?.username ? `/u/${notification.actor.username}` : undefined;
  const isFollowRequest = notification.type === "FOLLOW_REQUEST" && notification.followRequest;

  function respond(accept: boolean) {
    const requestId = notification.followRequest!.id;
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => respondToFollowRequest(requestId, accept));
      if (result.ok) setStatus(result.status);
      else setError(result.error);
    });
  }

  const content = (
    <div className="flex items-center gap-3 py-3.5">
      <Avatar src={notification.actor?.image} name={notification.actor?.name ?? "?"} size={36} />
      <div className="flex-1">
        <p className="text-sm">{text}</p>
        <p className="text-xs text-muted">{formatAppDate(notification.createdAt)}</p>
      </div>
      {!notification.readAt ? <span className="size-2 rounded-full bg-accent" aria-label="Não lida" /> : null}
    </div>
  );

  return (
    <div className="border-b border-border px-1">
      {href ? <Link href={href}>{content}</Link> : content}
      {isFollowRequest && status === "PENDING" ? (
        <div className="pb-3">
          <div className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={() => respond(true)}>
              Aceitar
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => respond(false)}>
              Recusar
            </Button>
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      {isFollowRequest && status === "ACCEPTED" ? (
        <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 pb-3 text-xs text-muted">
          <span className="tag tag--status tag--ok">Solicitação aceita</span>
          <span>{actorName} agora segue você.</span>
        </p>
      ) : null}
      {isFollowRequest && status === "DECLINED" ? (
        <p role="status" className="pb-3">
          <span className="tag tag--status tag--info">Solicitação recusada</span>
        </p>
      ) : null}
    </div>
  );
}
