"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ShareProfileButton } from "@/components/share/share-profile-button";
import { cn } from "@/lib/utils/cn";
import { activityHref } from "@/lib/social/links";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { FG_TITLE, useFgToggle } from "@/components/social/use-fg";
import type { ActionResult } from "@/lib/actions/result";

/** One workout in "Da sua equipe": who, what and when opens it; the heart gives FG in place. */
export function TeamActivityRow({
  activityId,
  name,
  image,
  workoutName,
  timeLabel,
  fgCount,
  hasGivenFg,
}: {
  activityId: string;
  name: string;
  image: string | null;
  workoutName: string;
  /** "há 2 h", "ontem" (computed on the server, São Paulo time). */
  timeLabel: string;
  fgCount: number;
  hasGivenFg: boolean;
}) {
  const fg = useFgToggle({ activityId, initialGiven: hasGivenFg, initialCount: fgCount });
  return (
    <li className="relative">
      <div className="flex items-center gap-3 py-2.5">
        <span aria-hidden className="shrink-0">
          <Avatar src={image} name={name} size={32} />
        </span>
        <Link
          href={activityHref(activityId)}
          className="min-w-0 flex-1 after:absolute after:inset-0 after:content-[''] hover:[&_.name]:underline"
        >
          <span className="name block truncate text-sm font-semibold">{name}</span>
          {/* When first: a long workout name truncates, never the time. */}
          <span className="block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {timeLabel} · {workoutName}
          </span>
        </Link>
        <button
          type="button"
          disabled={fg.pending}
          aria-pressed={fg.given}
          title={FG_TITLE}
          aria-label={
            fg.given
              ? `Remover FG do treino ${workoutName} de ${name} (${fg.count})`
              : `Dar FG no treino ${workoutName} de ${name} (${fg.count})`
          }
          onClick={fg.toggle}
          className={cn(
            "relative z-10 flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-[2px] px-2 text-sm font-semibold transition-colors",
            fg.given ? "text-accent" : "text-muted hover:bg-surface-2",
          )}
        >
          <Heart className="size-4" fill={fg.given ? "currentColor" : "none"} aria-hidden />
          {fg.count > 0 ? <span className="font-mono text-xs tabular-nums">{fg.count}</span> : null}
        </button>
      </div>
      {fg.error ? (
        <p role="alert" className="relative z-10 pb-2 text-xs text-danger">
          <ActionErrorText error={fg.error} />
        </p>
      ) : null}
    </li>
  );
}

/**
 * "Treine com amigos" (W-139): following nobody after a first workout, find
 * people or send your profile. "Agora não" hides it at once for 30 days (on
 * every device); a failure brings it back with the reason. Today keeps
 * rendering this once it's dismissed — as an empty live region — so the
 * page's re-render right after (the action revalidates Today) keeps
 * "Convite fechado" being said, and never shows the panel again (recovery R5).
 */
export function TeamInvite({
  dismissed,
  dismiss,
  username,
  name,
}: {
  /** Dismissed less than 30 days ago (read on the server). */
  dismissed: boolean;
  dismiss: () => Promise<ActionResult>;
  /** The viewer's handle and name, for "Compartilhar perfil" (none: no button). */
  username: string | null;
  name: string;
}) {
  const [hidden, setHidden] = useState(dismissed);
  const [closedHere, setClosedHere] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // The same node open or closed (first in both fragments), so the closing is said out loud.
  const status = (
    <p role="status" className="sr-only">
      {hidden && closedHere ? "Convite fechado. Ele volta em 30 dias." : ""}
    </p>
  );
  if (hidden) return <>{status}</>;

  function close() {
    setError(null);
    setHidden(true);
    setClosedHere(true);
    startTransition(async () => {
      const result = await runAction(dismiss);
      if (!result.ok) {
        setHidden(false);
        setClosedHere(false);
        setError(result.error);
      }
    });
  }

  return (
    <>
      {status}
      <section className="mt-10" aria-labelledby="treine-com-amigos">
        <div className="border-l-2 border-l-accent bg-surface-2 px-4 py-3.5">
          <h2 id="treine-com-amigos" className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
            Treine com amigos
          </h2>
          <p className="mt-1 text-sm">Siga quem treina com você: os treinos e FGs deles aparecem aqui.</p>
          <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/discover">Encontrar pessoas</Link>
            </Button>
            {username ? <ShareProfileButton username={username} name={name} /> : null}
            <button
              type="button"
              onClick={close}
              className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
            >
              Agora não
            </button>
            {error ? (
              <p role="alert" className="basis-full text-xs text-danger">
                <ActionErrorText error={error} />
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
