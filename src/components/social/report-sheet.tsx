"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { ActionSheet } from "@/components/ui/action-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { blockUser, reportContent } from "@/lib/actions/social";
import {
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  REPORT_REASON_OPTION,
  type ReportReasonCode,
} from "@/lib/social/notification-reports-core";
import { cn } from "@/lib/utils/cn";
import { runAction } from "./run-action";
import { ActionErrorText } from "./session-expired";

/**
 * Reporting a workout or a person (decision 15, W-141 C): a sheet with the
 * reasons (Spam · Assédio ou ofensa · Conteúdo impróprio · Dados falsos ·
 * Outro), optional details, then "Denúncia enviada…" and "Bloquear @x
 * também". It calls reportContent({ activityId | reportedUserId, reason,
 * details, shareToken }). Rendered by the activity page and /u (C2) and the
 * shared-workout page /t (C3) — for signed-in viewers only.
 */

export type ReportTarget =
  | { kind: "activity"; activityId: string; author: { id: string; username: string | null; name: string } }
  | { kind: "user"; user: { id: string; username: string | null; name: string } };

export interface ReportSheetProps {
  target: ReportTarget;
  /**
   * A viewer who only holds the share link (/t/<token>) reports with it:
   * reportContent accepts `canViewActivity || activity.shareToken === token`.
   */
  shareToken?: string;
  /** Offer "Bloquear @x também" after sending (false when already blocked). */
  canBlock?: boolean;
  onClose: () => void;
}

/** "@ana", or the name for someone without a handle. */
function handleOf(person: { username: string | null; name: string }) {
  return person.username ? `@${person.username}` : person.name;
}

/** The sheet itself, controlled by its parent (e.g. the /u "⋯" menu). */
export function ReportSheet({ target, shareToken, canBlock = true, onClose }: ReportSheetProps) {
  const router = useRouter();
  const person = target.kind === "activity" ? target.author : target.user;
  const handle = handleOf(person);
  const [reason, setReason] = useState<ReportReasonCode | null>(null);
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState<{ blocked: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const firstReason = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);

  // Sent: the confirmation takes the focus, so it is read out and the old form's focus isn't lost.
  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError("Escolha um motivo.");
      firstReason.current?.focus();
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await runAction(() =>
        reportContent(
          target.kind === "activity"
            ? { activityId: target.activityId, reason, details, shareToken }
            : { reportedUserId: target.user.id, reason, details },
        ),
      );
      if (result.ok) setSent({ blocked: result.blocked });
      else setError(result.error);
    });
  }

  function blockToo() {
    setError(null);
    startTransition(async () => {
      const result = await runAction(() => blockUser(person.id));
      if (result.ok) router.replace("/app/settings?bloqueado=1#bloqueados");
      else setError(result.error);
    });
  }

  return (
    <ActionSheet
      title={target.kind === "activity" ? "Denunciar treino" : `Denunciar ${handle}`}
      subtitle={sent ? undefined : "A equipe do FGPOWER analisa cada denúncia. Quem você denunciou não é avisado."}
      onClose={pending ? () => {} : onClose}
      labelledBy="report-sheet-title"
    >
      {sent ? (
        <div className="flex flex-col items-start gap-3 px-5 py-4">
          <p ref={doneRef} tabIndex={-1} className="text-sm font-medium outline-none">
            Denúncia enviada. A equipe do FGPOWER vai analisar.
          </p>
          {canBlock && !sent.blocked ? (
            <Button variant="link" size="sm" className="min-h-11 px-0" disabled={pending} onClick={blockToo}>
              {pending ? "Bloqueando…" : `Bloquear ${handle} também`}
            </Button>
          ) : null}
          {error ? (
            <p role="alert" className="text-xs text-danger">
              <ActionErrorText error={error} />
            </p>
          ) : null}
          <Button variant="outline" size="sm" disabled={pending} onClick={onClose}>
            Fechar
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-4" noValidate>
          <fieldset>
            <legend className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Motivo</legend>
            <div className="mt-2 flex flex-col gap-1.5">
              {REPORT_REASONS.map((code, i) => (
                <label
                  key={code}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-[3px] border px-3.5 py-2 text-[15px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                    reason === code ? "border-accent bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]" : "border-border hover:bg-surface-2",
                  )}
                >
                  <input
                    ref={i === 0 ? firstReason : undefined}
                    type="radio"
                    name="report-reason"
                    value={code}
                    checked={reason === code}
                    onChange={() => {
                      setReason(code);
                      setError(null);
                    }}
                    data-sheet-initial={i === 0 ? "" : undefined}
                    className="size-4 shrink-0 accent-accent"
                  />
                  {REPORT_REASON_OPTION[code]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="report-details" className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              Detalhes (opcional)
            </label>
            <Textarea
              id="report-details"
              value={details}
              maxLength={REPORT_DETAILS_MAX}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="mt-1.5 min-h-20"
              aria-describedby="report-details-count"
            />
            <p id="report-details-count" className="mt-1 text-right font-mono text-[11px] tabular-nums text-muted">
              {details.length}/{REPORT_DETAILS_MAX}
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              <ActionErrorText error={error} />
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : "Enviar denúncia"}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </ActionSheet>
  );
}

/** A "Denunciar" button that opens the sheet (activity page, /t). */
export function ReportButton({
  label = "Denunciar",
  className,
  ...props
}: Omit<ReportSheetProps, "onClose"> & { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button ref={trigger} variant="ghost" size="sm" aria-haspopup="dialog" className={className} onClick={() => setOpen(true)}>
        <Flag aria-hidden />
        {label}
      </Button>
      {open ? (
        <ReportSheet
          {...props}
          onClose={() => {
            setOpen(false);
            requestAnimationFrame(() => trigger.current?.focus());
          }}
        />
      ) : null}
    </>
  );
}
