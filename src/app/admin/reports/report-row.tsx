"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmSheet } from "@/components/ui/action-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moderateReport, unbanUser, type ModerationAction } from "@/lib/actions/admin";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";

/** What each decision asks before it happens (the reversible ones don't ask). */
const CONFIRM: Partial<Record<ModerationAction, { title: string; subtitle: string; confirm: string; pending: string }>> = {
  HIDE: {
    title: "Ocultar este treino?",
    subtitle: "O treino fica privado e o link de compartilhamento para de funcionar. O dono não consegue publicar de novo.",
    confirm: "Ocultar treino",
    pending: "Ocultando…",
  },
  DELETE: {
    title: "Excluir a publicação?",
    subtitle: "A publicação e os FGs dela somem. O treino continua no histórico do dono, privado.",
    confirm: "Excluir publicação",
    pending: "Excluindo…",
  },
};

/**
 * The decisions on an open report. A done decision reloads the queue with a
 * one-time notice (?resolvida=…): the report — and every other open one about
 * the same target — leaves "Abertas". Two decisions in a row can land on the
 * same address (same status, same count), where navigating alone may keep the
 * queue as it was: the refresh re-reads it.
 */
export function ReportActions({
  reportId,
  canHide,
  canDelete,
  banTarget,
}: {
  reportId: string;
  canHide: boolean;
  canDelete: boolean;
  /** "@ana" when the person can be banned (known, not banned yet, not you or another admin). */
  banTarget: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState<ModerationAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = pending || decided;

  function run(action: ModerationAction) {
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => moderateReport(reportId, action, note));
      if (result.ok) {
        // Until the queue comes back without this card, nothing here can be tapped twice.
        setDecided(true);
        router.replace(`/admin/reports?resolvida=${result.status}&n=${result.resolved}`, { scroll: false });
        router.refresh();
        return;
      }
      setConfirming(null);
      setError(result.error);
    });
  }

  const noteId = `nota-${reportId}`;
  const confirm = confirming && confirming !== "BAN" ? CONFIRM[confirming] : null;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <label htmlFor={noteId} className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        Nota (opcional)
      </label>
      <Input id={noteId} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run("REVIEW")}>
          Marcar revisado
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run("DISMISS")}>
          Descartar
        </Button>
        {canHide ? (
          <Button size="sm" variant="outline" disabled={busy} aria-haspopup="dialog" onClick={() => setConfirming("HIDE")}>
            Ocultar treino
          </Button>
        ) : null}
        {canDelete ? (
          <Button size="sm" variant="outline" disabled={busy} aria-haspopup="dialog" onClick={() => setConfirming("DELETE")}>
            Excluir publicação
          </Button>
        ) : null}
        {banTarget ? (
          <Button size="sm" variant="danger" disabled={busy} aria-haspopup="dialog" onClick={() => setConfirming("BAN")}>
            Banir {banTarget}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}

      {confirm ? (
        <ConfirmSheet
          title={confirm.title}
          subtitle={confirm.subtitle}
          confirmLabel={confirm.confirm}
          danger
          pending={busy}
          pendingLabel={confirm.pending}
          onConfirm={() => run(confirming!)}
          onClose={() => setConfirming(null)}
        />
      ) : null}
      {confirming === "BAN" && banTarget ? (
        <ConfirmSheet
          title={`Banir ${banTarget}?`}
          subtitle={
            <span className="flex flex-col gap-2">
              <span>
                A conta sai do app agora: as sessões terminam, e o perfil e os treinos somem para todo mundo. Dá para desfazer em
                &quot;Resolvidas&quot;.
              </span>
              <label className="flex flex-col gap-1 text-foreground">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Motivo (fica registrado)</span>
                <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
              </label>
            </span>
          }
          confirmLabel={`Banir ${banTarget}`}
          danger
          pending={busy}
          pendingLabel="Banindo…"
          onConfirm={() => run("BAN")}
          onClose={() => setConfirming(null)}
        />
      ) : null}
    </div>
  );
}

/** "Desbanir @x" on a resolved report whose person is banned. */
export function ResolvedActions({ userId, handle }: { userId: string; handle: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-3">
      <Button
        size="sm"
        variant="outline"
        disabled={pending || done}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await runAction(() => unbanUser(userId));
            if (result.ok) {
              setDone(true);
              // A second lift in a row lands on this same address: the refresh re-reads the list.
              router.replace("/admin/reports?status=resolvidas&desbanido=1", { scroll: false });
              router.refresh();
            } else {
              setError(result.error);
            }
          })
        }
      >
        {pending || done ? "Desbanindo…" : `Desbanir ${handle}`}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}
    </div>
  );
}

/**
 * The one-time outcome line after a decision; it takes the focus (the card
 * that was acted on is gone) so it is read out. `stamp` changes with every
 * decision (the queue's counts), so the same line after a second, identical
 * decision takes the focus again.
 */
export function ResultNotice({ text, stamp }: { text: string; stamp: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [text, stamp]);
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role="status"
      className="mt-6 border-l-2 border-l-accent bg-surface-2 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] outline-none"
    >
      {text}
    </p>
  );
}
