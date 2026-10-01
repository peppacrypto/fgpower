"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Flag, MoreHorizontal, UserMinus } from "lucide-react";
import { ActionSheet, ConfirmSheet, SheetItem } from "@/components/ui/action-sheet";
import { Button } from "@/components/ui/button";
import { blockUser, removeFollower } from "@/lib/actions/social";
import { cn } from "@/lib/utils/cn";
import { ReportSheet } from "./report-sheet";
import { runAction } from "./run-action";
import { ActionErrorText } from "./session-expired";

/**
 * The "⋯" menu on someone else's profile (/u, signed in, not the owner; W-141
 * B): "Remover dos seguidores" (when they follow the viewer), "Denunciar
 * perfil" (ReportSheet), "Bloquear @x" (ConfirmSheet → blockUser, then
 * /app/settings?bloqueado=1#bloqueados). Rendered by /u (C2) next to the
 * FollowButton. No item may contain the text "FG" (e2e 09 finds the only /FG/
 * button on /u).
 */
export interface ProfileMenuProps {
  user: { id: string; username: string | null; name: string };
  /** They follow the viewer: offer "Remover dos seguidores". */
  followsViewer: boolean;
  className?: string;
}

type Sheet = "menu" | "remove" | "report" | "block";

export function ProfileMenu({ user, followsViewer, className }: ProfileMenuProps) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [follows, setFollows] = useState(followsViewer);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const trigger = useRef<HTMLButtonElement>(null);
  const handle = user.username ? `@${user.username}` : user.name;

  function close() {
    setSheet(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => removeFollower(user.id));
      if (result.ok) {
        setFollows(false);
        setDone(`${handle} não segue mais você.`);
      } else {
        setError(result.error);
      }
      close();
    });
  }

  function block() {
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => blockUser(user.id));
      if (result.ok) {
        router.replace("/app/settings?bloqueado=1#bloqueados");
        return;
      }
      setError(result.error);
      close();
    });
  }

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <Button
        ref={trigger}
        variant="outline"
        size="icon"
        aria-label="Mais opções"
        aria-haspopup="dialog"
        onClick={() => {
          setDone(null);
          setError(null);
          setSheet("menu");
        }}
      >
        <MoreHorizontal aria-hidden />
      </Button>
      <p role="status" className={done ? "max-w-56 text-right text-xs text-muted" : "sr-only"}>
        {done ?? ""}
      </p>
      {error ? (
        <p role="alert" className="max-w-56 text-right text-xs text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}

      {sheet === "menu" ? (
        <ActionSheet title={handle} onClose={close} labelledBy="profile-menu-title">
          {follows ? (
            <SheetItem icon={<UserMinus />} onClick={() => setSheet("remove")}>
              Remover dos seguidores
            </SheetItem>
          ) : null}
          <SheetItem icon={<Flag />} onClick={() => setSheet("report")}>
            Denunciar perfil
          </SheetItem>
          <SheetItem icon={<Ban />} danger onClick={() => setSheet("block")}>
            Bloquear {handle}
          </SheetItem>
          <SheetItem onClick={close}>Cancelar</SheetItem>
        </ActionSheet>
      ) : null}
      {sheet === "remove" ? (
        <ConfirmSheet
          title={`Remover ${handle} dos seguidores?`}
          subtitle={`${handle} não é avisado. Com a conta privada, ${handle} vai precisar pedir para seguir de novo.`}
          confirmLabel="Remover"
          danger
          pending={pending}
          pendingLabel="Removendo…"
          onConfirm={remove}
          onClose={close}
        />
      ) : null}
      {sheet === "block" ? (
        <ConfirmSheet
          title={`Bloquear ${handle}?`}
          subtitle={`Vocês deixam de se seguir e nenhum dos dois vê o perfil ou os treinos do outro. ${handle} não é avisado. Dá para desbloquear em Configurações.`}
          confirmLabel="Bloquear"
          danger
          pending={pending}
          pendingLabel="Bloqueando…"
          onConfirm={block}
          onClose={close}
        />
      ) : null}
      {sheet === "report" ? <ReportSheet target={{ kind: "user", user }} onClose={close} /> : null}
    </div>
  );
}
