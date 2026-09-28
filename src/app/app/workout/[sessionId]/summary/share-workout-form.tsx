"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { GArrow, GCheck } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { VisibilityControl, type Visibility } from "@/components/social/visibility-control";
import { shareWorkoutSession } from "@/lib/actions/activities";

interface Published {
  id: string;
  visibility: Visibility;
  showDetailedLoads: boolean;
  caption: string | null;
}

/**
 * The summary's compact share row. The workout is already saved — this only
 * decides who else sees it, so no button here says "Salvar": Privado needs no
 * button at all ("Só você vê este treino"), the others say what they do
 * ("Publicar para seguidores" / "Publicar" / "Atualizar"), and once it is out
 * the row turns into "Publicado · Ver no feed · Copiar link". The caption
 * opens on demand.
 */
export function ShareWorkoutForm({
  sessionId,
  initial,
  published: initialPublished,
}: {
  sessionId: string;
  /** What the controls start on: the published state, else the profile's defaults. */
  initial: { visibility: Visibility; showDetailedLoads: boolean; caption: string };
  published: Published | null;
}) {
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility);
  const [showDetailedLoads, setShowDetailedLoads] = useState(initial.showDetailedLoads);
  const [caption, setCaption] = useState(initial.caption);
  const [captionOpen, setCaptionOpen] = useState(initial.caption.length > 0);
  const [published, setPublished] = useState<Published | null>(initialPublished);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  const [pending, startTransition] = useTransition();
  /** What the last save did, for screen readers (W-172): the visible row changes shape instead of saying it. */
  const [announced, setAnnounced] = useState("");

  const isOut = published != null && published.visibility !== "PRIVATE";
  const unchanged =
    published != null &&
    published.visibility === visibility &&
    published.showDetailedLoads === showDetailedLoads &&
    (published.caption ?? "") === caption.trim();

  function save(next: Visibility) {
    setError(null);
    setCopied(null);
    setAnnounced("");
    startTransition(async () => {
      try {
        const { activityId } = await shareWorkoutSession({ sessionId, visibility: next, showDetailedLoads, caption });
        setPublished({ id: activityId, visibility: next, showDetailedLoads, caption: caption.trim() || null });
        setVisibility(next);
        setAnnounced(
          next === "PRIVATE" ? "Salvo como privado." : next === "PUBLIC" ? "Publicado para todos." : "Publicado para seguidores.",
        );
      } catch {
        // Keep the choices on screen; a failed publish must not replace the page.
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        setError(
          next === "PRIVATE"
            ? offline
              ? "Sem conexão — continua publicado. Tente de novo quando voltar o sinal."
              : "Não foi possível tornar privado agora. Tente de novo."
            : offline
              ? "Sem conexão — não publicou. Tente de novo quando voltar o sinal."
              : "Não foi possível publicar agora. Tente de novo.",
        );
      }
    });
  }

  async function copyLink() {
    if (!published) return;
    const url = `${window.location.origin}/app/activity/${published.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
  }

  const actionLabel = isOut ? "Atualizar" : visibility === "FOLLOWERS" ? "Publicar para seguidores" : "Publicar";

  function choose(value: Visibility) {
    setVisibility(value);
    setError(null);
  }

  return (
    // A container: the label sits beside the three options only where they all
    // fit with room to spare ("Seguidores" in semibold is ~76px of text; at a
    // 21rem row each segment has ~6px more, so a wider fallback font before
    // the webfont loads doesn't clip it either). Narrower (a 320–360px phone)
    // the label goes above them and the options take the full width.
    <div className="@container flex flex-col gap-2.5">
      <div className="flex flex-col items-stretch gap-1.5 @min-[21rem]:flex-row @min-[21rem]:items-center @min-[21rem]:gap-3">
        <span
          id={`share-${sessionId}`}
          className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted"
        >
          Quem vê
        </span>
        <VisibilityControl
          value={visibility}
          onChange={choose}
          labelledBy={`share-${sessionId}`}
          className="@min-[21rem]:flex-1"
        />
      </div>

      {visibility === "PRIVATE" ? (
        isOut ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Publicado para {published?.visibility === "PUBLIC" ? "todos" : "seguidores"}. Tornar privado tira do feed.
            </p>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => save("PRIVATE")}>
              {pending ? "Salvando…" : "Tornar privado"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted">Só você vê este treino.</p>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <label className="flex min-h-9 items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={showDetailedLoads}
                onChange={(e) => setShowDetailedLoads(e.target.checked)}
                className="size-4 accent-accent"
              />
              Mostrar cargas
            </label>
            {!captionOpen ? (
              <button
                type="button"
                onClick={() => setCaptionOpen(true)}
                className="min-h-9 text-[13px] font-semibold text-accent hover:underline"
              >
                + Legenda
              </button>
            ) : null}
          </div>
          {captionOpen ? (
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Como foi o treino? (opcional)"
              aria-label="Legenda"
              maxLength={280}
              rows={2}
              autoFocus={initial.caption.length === 0}
            />
          ) : null}

          {isOut && unchanged ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
              <span className="inline-flex items-center gap-1 text-success">
                <GCheck className="size-3.5" />
                Publicado
              </span>
              <Link href="/app/feed" className="inline-flex min-h-9 items-center gap-1 text-accent hover:underline">
                Ver no feed
                <GArrow className="size-3" />
              </Link>
              <button
                type="button"
                onClick={copyLink}
                className="min-h-9 uppercase tracking-[0.14em] text-accent hover:underline"
              >
                {copied === "ok" ? "Link copiado" : "Copiar link"}
              </button>
            </div>
          ) : (
            <Button type="button" size="sm" className="self-start" disabled={pending} onClick={() => save(visibility)}>
              {pending ? "Publicando…" : actionLabel}
            </Button>
          )}
          {copied === "failed" && published ? (
            <p className="text-xs text-muted">
              Não deu para copiar. Link: <span className="select-all break-all font-mono">/app/activity/{published.id}</span>
            </p>
          ) : null}
        </>
      )}

      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
      {/* Always in the page, so a change is announced (a status region added with its text may not be). */}
      <p role="status" className="sr-only">
        {pending ? "Salvando…" : copied === "ok" ? "Link copiado." : announced}
      </p>
    </div>
  );
}
