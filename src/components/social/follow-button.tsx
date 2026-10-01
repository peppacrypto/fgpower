"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/action-sheet";
import { GCheck } from "@/components/ui/glyph";
import { followUser, unfollowUser } from "@/lib/actions/social";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { formatNumber, pluralWord } from "@/lib/utils/format";

/** The viewer's relation to a person: following, a request waiting, or neither. */
export type FollowRelation = "NONE" | "REQUESTED" | "FOLLOWING";

/**
 * What the viewer did with a person's FollowButton on this page, for a
 * follower count elsewhere on it (/u) — null until a tap. The count moves
 * with the tap: the page's own re-render (FollowButton's settle) comes after
 * the server answered.
 */
const FollowTaps = createContext<{
  userId: string;
  relation: FollowRelation | null;
  report: (relation: FollowRelation) => void;
} | null>(null);

/** Wraps a page part that shows `userId`'s FollowButton and their LiveFollowerCount. */
export function FollowCountScope({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [relation, setRelation] = useState<FollowRelation | null>(null);
  const value = useMemo(() => ({ userId, relation, report: setRelation }), [userId, relation]);
  return <FollowTaps.Provider value={value}>{children}</FollowTaps.Provider>;
}

/**
 * "12 seguidores" as the server counted them, moved by the viewer's own taps
 * on the FollowButton in the same FollowCountScope. It stays right through a
 * server re-render (a later action, better-auth's session refresh): a newer
 * render's count already includes the viewer or not, as its `relation` says,
 * so only the difference to what the button shows is added.
 */
export function LiveFollowerCount({ userId, count, relation }: { userId: string; count: number; relation: FollowRelation }) {
  const taps = useContext(FollowTaps);
  const shown = taps?.userId === userId && taps.relation !== null ? taps.relation : relation;
  const n = Math.max(0, count - (relation === "FOLLOWING" ? 1 : 0) + (shown === "FOLLOWING" ? 1 : 0));
  return (
    <>
      <strong className="text-foreground">{formatNumber(n, 0)}</strong> {pluralWord(n, "seguidor", "seguidores")}
    </>
  );
}

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

type Result = { ok: true; status?: FollowRelation } | { ok: false; error: string };

/**
 * Follow / request / unfollow one person — shared by /u, Descobrir,
 * notifications, follower lists and Today. Following is one optimistic tap
 * (the server's answer wins, a failure rolls back with its message; an
 * expired session offers "Entrar"). Undoing is not: "Seguindo" and
 * "Solicitação enviada" open a confirm sheet first — on a private account an
 * unfollow takes the workouts away until a new request is approved. The
 * exact labels are asserted by e2e.
 */
export function FollowButton({
  targetUserId,
  username,
  name,
  isPrivate,
  initialRelation,
  size = "default",
  followLabel,
  onRelationChange,
}: FollowButtonProps) {
  // Client state on purpose: a server re-render (new props) never resets what the tap settled.
  const [state, setRelationState] = useState<FollowRelation>(initialRelation);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [loading, startTransition] = useTransition();
  const taps = useContext(FollowTaps);
  const router = useRouter();
  const buttonSize = size === "sm" ? "sm" : undefined;
  const who = username ? `@${username}` : name;

  /** Shows `relation`, and tells a follower count of this person on the page (LiveFollowerCount). */
  function setState(relation: FollowRelation) {
    setRelationState(relation);
    if (taps?.userId === targetUserId) taps.report(relation);
  }

  /**
   * After a settled change, re-renders the page from the server. The follow
   * actions don't revalidate anything, and back/forward reuses a page's last
   * render: without this, opening a workout and coming back ("‹ Voltar", the
   * system back) showed "Seguir" and the old count again for someone just
   * followed. What the tap settled survives the re-render (client state, as
   * with any server re-render — recovery R5).
   */
  function settle(relation: FollowRelation) {
    setState(relation);
    onRelationChange?.(relation);
    router.refresh();
  }

  function follow() {
    const before = state;
    const optimistic: FollowRelation = isPrivate ? "REQUESTED" : "FOLLOWING";
    setState(optimistic);
    setError(null);
    setAnnouncement("");
    startTransition(async () => {
      const result: Result = await runAction(() => followUser(targetUserId));
      if (result.ok) {
        settle(result.status ?? optimistic);
      } else {
        setState(before);
        setError(result.error);
      }
    });
  }

  /** Unfollow or cancel the request, from the confirm sheet: it stays open (pending) until the server answers. */
  function undo() {
    const wasRequest = state === "REQUESTED";
    setError(null);
    startTransition(async () => {
      const result: Result = await runAction(() => unfollowUser(targetUserId));
      setConfirming(false);
      if (result.ok) {
        settle("NONE");
        setAnnouncement(wasRequest ? `Solicitação para ${who} cancelada.` : `Você deixou de seguir ${who}.`);
      } else {
        setError(result.error);
      }
    });
  }

  let button: React.ReactNode;
  if (state === "FOLLOWING") {
    button = (
      <Button
        variant="secondary"
        size={buttonSize}
        disabled={loading}
        aria-haspopup="dialog"
        onClick={() => setConfirming(true)}
      >
        <GCheck aria-hidden />
        Seguindo
      </Button>
    );
  } else if (state === "REQUESTED") {
    button = (
      <Button variant="outline" size={buttonSize} disabled={loading} aria-haspopup="dialog" onClick={() => setConfirming(true)}>
        Solicitação enviada
      </Button>
    );
  } else {
    button = (
      <Button size={buttonSize} disabled={loading} onClick={follow}>
        {followLabel ?? (isPrivate ? "Solicitar seguir" : "Seguir")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {button}
      {confirming && state === "FOLLOWING" ? (
        <ConfirmSheet
          title={`Deixar de seguir ${who}?`}
          subtitle={
            isPrivate
              ? "A conta é privada: para ver os treinos de novo, você vai precisar pedir e esperar a aprovação."
              : `Os treinos de ${who} saem do seu feed. Dá para seguir de novo quando quiser.`
          }
          confirmLabel="Deixar de seguir"
          danger
          pending={loading}
          pendingLabel="Saindo…"
          onConfirm={undo}
          onClose={() => setConfirming(false)}
        />
      ) : null}
      {confirming && state === "REQUESTED" ? (
        <ConfirmSheet
          title={`Cancelar a solicitação para ${who}?`}
          subtitle={`${who} não recebe aviso.`}
          confirmLabel="Cancelar solicitação"
          cancelLabel="Manter"
          danger
          pending={loading}
          pendingLabel="Cancelando…"
          onConfirm={undo}
          onClose={() => setConfirming(false)}
        />
      ) : null}
      <span role="status" className="sr-only">
        {announcement}
      </span>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}
    </div>
  );
}
