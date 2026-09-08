"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { respondToFollowRequest } from "@/lib/actions/social";

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
  const [pending, startTransition] = useTransition();

  const text = TYPE_TEXT[notification.type]?.(notification.actor?.name ?? "Alguém") ?? "Nova notificação";
  const href = notification.activity ? `/app/activity/${notification.activity.id}` : notification.actor?.username ? `/u/${notification.actor.username}` : undefined;

  const content = (
    <div className="flex items-center gap-3 py-3.5">
      <Avatar src={notification.actor?.image} name={notification.actor?.name ?? "?"} size={36} />
      <div className="flex-1">
        <p className="text-sm">{text}</p>
        <p className="text-xs text-muted">{new Date(notification.createdAt).toLocaleDateString("pt-BR")}</p>
      </div>
      {!notification.readAt ? <span className="size-2 rounded-full bg-accent" aria-label="Não lida" /> : null}
    </div>
  );

  return (
    <div className="border-b border-border px-1">
      {href ? <Link href={href}>{content}</Link> : content}
      {notification.type === "FOLLOW_REQUEST" && notification.followRequest && status === "PENDING" ? (
        <div className="flex gap-2 pb-3">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await respondToFollowRequest(notification.followRequest!.id, true);
                setStatus("ACCEPTED");
              })
            }
          >
            Aceitar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await respondToFollowRequest(notification.followRequest!.id, false);
                setStatus("DECLINED");
              })
            }
          >
            Recusar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
