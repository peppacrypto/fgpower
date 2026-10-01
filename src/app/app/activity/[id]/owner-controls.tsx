"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmSheet } from "@/components/ui/action-sheet";
import { SectionHead } from "@/components/ui/section-head";
import { VisibilityControl, type Visibility } from "@/components/social/visibility-control";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { deleteActivity, setActivityVisibility } from "@/lib/actions/activity-owner";
import { workoutSummaryHref } from "@/lib/social/links";

const STATUS: Record<Visibility, string> = {
  PRIVATE: "Só você vê este treino.",
  FOLLOWERS: "Seus seguidores veem este treino.",
  PUBLIC: "Qualquer pessoa pode ver este treino — mesmo sem conta.",
};

const LINK =
  "inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline";

/**
 * The owner's "Quem vê" on their published workout (W-143): Privado ·
 * Seguidores · Público saved on change (rolled back with its message when it
 * fails), a way to the caption and loads (the summary), and "Excluir
 * publicação" behind a confirm — the workout itself stays in the history.
 * A post hidden by moderation shows why, and nothing to change.
 */
export function OwnerControls({
  activityId,
  sessionId,
  initialVisibility,
  moderated,
  linkShared,
}: {
  activityId: string;
  sessionId: string | null;
  initialVisibility: Visibility;
  /** Hidden by an admin: the owner can't publish it again. */
  moderated: boolean;
  /** A share link (/t/…) is on: whoever holds it sees the workout whatever this says. */
  linkShared: boolean;
}) {
  const router = useRouter();
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const sectionRef = useRef<HTMLElement>(null);

  // The feed chip (W-144) links here: /app/activity/<id>#quem-ve. Next scrolls
  // to a hash only when its target is on screen at the navigation's first
  // commit — here the loading skeleton's — so the section brings itself into
  // view once the page is in.
  useEffect(() => {
    if (window.location.hash === "#quem-ve") sectionRef.current?.scrollIntoView();
  }, []);

  function change(next: Visibility) {
    if (next === visibility) return;
    const before = visibility;
    setVisibility(next);
    setError(null);
    setSaved("");
    startSaving(async () => {
      const result = await runAction(() => setActivityVisibility(activityId, next));
      if (result.ok) {
        setVisibility(result.visibility);
        setSaved("Salvo");
      } else {
        setVisibility(before);
        setError(result.error);
      }
    });
  }

  function remove() {
    setError(null);
    startDeleting(async () => {
      const result = await runAction(() => deleteActivity(activityId));
      if (result.ok) {
        router.replace("/app/feed?excluida=1");
      } else {
        setConfirming(false);
        setError(result.error);
      }
    });
  }

  return (
    <section ref={sectionRef} id="quem-ve" aria-labelledby="quem-ve-titulo" className="mt-8 scroll-mt-6">
      <SectionHead id="quem-ve-titulo" label="Quem vê" />
      {moderated ? (
        <p className="mt-3 border-l-2 border-l-danger bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          Esta publicação foi ocultada pela moderação.
        </p>
      ) : (
        <>
          <VisibilityControl
            value={visibility}
            onChange={change}
            labelledBy="quem-ve-titulo"
            disabled={saving || deleting}
            className="mt-3"
          />
          <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted">
            <span>{STATUS[visibility]}</span>
            <span role="status" className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-success">
              {saving ? "" : saved}
            </span>
          </p>
          {linkShared ? (
            <p className="mt-1 text-xs text-muted">O link de compartilhamento está ativo: quem tiver o link também vê.</p>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4">
        {sessionId ? (
          <Link href={workoutSummaryHref(sessionId)} className={LINK}>
            Editar legenda e cargas
          </Link>
        ) : (
          <span />
        )}
        {!moderated ? (
          <button
            type="button"
            aria-haspopup="dialog"
            disabled={deleting}
            onClick={() => setConfirming(true)}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-danger hover:underline disabled:opacity-40"
          >
            <Trash2 className="size-4" aria-hidden />
            Excluir publicação
          </button>
        ) : null}
      </div>

      {confirming ? (
        <ConfirmSheet
          title="Excluir publicação?"
          subtitle="O treino continua no seu histórico. Os FGs desta publicação são apagados."
          confirmLabel="Excluir"
          danger
          pending={deleting}
          pendingLabel="Excluindo…"
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </section>
  );
}
