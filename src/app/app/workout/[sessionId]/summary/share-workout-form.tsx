"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Download, Link2, Share2 } from "lucide-react";
import { GArrow, GCheck } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { VisibilityControl, type Visibility } from "@/components/social/visibility-control";
import { GENERIC_ACTION_ERROR, OFFLINE_ERROR, runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import {
  canShareFiles,
  copyTextKeepingActivation,
  downloadBlob,
  prefetchStory,
  shareImageAndLink,
  type ShareOutcome,
} from "@/components/share/share-sheet";
import {
  ensureWorkoutShareLink,
  revokeWorkoutShareLink,
  shareWorkoutSession,
  showWorkoutsToFollowers,
  type SharedState,
} from "@/lib/actions/activities";
import { keepWorkoutsPrivate } from "@/lib/actions/profile";
import { isSessionExpiredError } from "@/lib/auth/session-expired";
import { sharePath } from "@/lib/social/links";
import { normalizeText } from "@/lib/utils/normalize-text";

interface Published {
  id: string;
  visibility: Visibility;
  showDetailedLoads: boolean;
  caption: string | null;
  /** Hidden by moderation: nothing here can publish or share it again. */
  moderated: boolean;
}

interface ShareLink {
  token: string;
  /** The activity's updatedAt (ms): versions the story image. */
  version: number;
}

const FIELD = "font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted";
const TEXT_ACTION = "inline-flex min-h-11 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] hover:underline";
const OFFLINE_SHARE = "Sem conexão — tente de novo quando o sinal voltar.";
const SHARE_FAILED = "Não foi possível preparar o compartilhamento. Tente de novo.";

/** canShareFiles never changes while the page is open. */
const noSubscription = () => () => {};

/** Where the link opens, on this origin. */
const linkUrl = (token: string) => `${window.location.origin}${sharePath(token)}`;

/** "fgpower-segunda-superior.png" */
function imageName(workoutName: string) {
  const slug = normalizeText(workoutName)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `fgpower-${slug || "treino"}.png`;
}

/** A failure the page shows: the session message as is, else this form's own offline / generic copy. */
function failureText(error: string, offline: string, generic: string) {
  if (isSessionExpiredError(error)) return error;
  if (error === OFFLINE_ERROR) return offline;
  if (error === GENERIC_ACTION_ERROR) return generic;
  return error;
}

/**
 * The summary's share block.
 * - "Quem vê": who sees the workout in the app. It opens on how the workout
 *   is published (new workouts publish on finish with the profile's default,
 *   decision 10); Privado needs no button ("Só você vê este treino"), the
 *   others say what they do ("Publicar para seguidores" / "Publicar" /
 *   "Atualizar"), and once out it reads "Publicado · Ver no feed".
 * - "Fora do app": the story image and a link that opens without an account
 *   (/t/<token>, W-008) — the image and the link show the workout as set
 *   here ("Mostrar kg e reps", the caption), whatever its visibility.
 * - A PRIVATE default is asked once (D-A) whether to show workouts to
 *   followers from now on.
 */
export function ShareWorkoutForm({
  sessionId,
  workoutName,
  initial,
  published: initialPublished,
  link: initialLink,
  followerCount,
  privateNotice,
}: {
  sessionId: string;
  workoutName: string;
  /** What the controls start on: the published state, else the workout's own choices. */
  initial: { visibility: Visibility; showDetailedLoads: boolean; caption: string };
  published: Published | null;
  link: ShareLink | null;
  followerCount: number;
  /** The one-time question to a PRIVATE default (D-A); `loadsHidden` says "sem as cargas". */
  privateNotice: { loadsHidden: boolean } | null;
}) {
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility);
  const [showDetailedLoads, setShowDetailedLoads] = useState(initial.showDetailedLoads);
  const [caption, setCaption] = useState(initial.caption);
  const [captionOpen, setCaptionOpen] = useState(initial.caption.length > 0);
  const [published, setPublished] = useState<Published | null>(initialPublished);
  const [link, setLink] = useState<ShareLink | null>(initialLink);
  const [notice, setNotice] = useState(privateNotice);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /** What the last action did, for screen readers (W-172): the visible row changes shape instead of saying it. */
  const [announced, setAnnounced] = useState("");

  // "Fora do app"
  // Null on the server and during hydration; then whether this browser can share an image file.
  const canShare = useSyncExternalStore(noSubscription, canShareFiles, () => null);
  const [preparing, setPreparing] = useState<"image" | "link" | "update" | null>(null);
  /** The image is ready but Safari refused the share after the wait: a second tap sends it. */
  const [readyFile, setReadyFile] = useState<File | null>(null);
  const [copied, setCopied] = useState<{ ok: true } | { ok: false; url: string } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [revoking, startRevoke] = useTransition();
  const story = useRef<{ key: string; blob: Blob | null } | null>(null);
  const revokeTrigger = useRef<HTMLButtonElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  /** A share, copy or link update under way: a second tap meanwhile (a double tap) is ignored. */
  const outInFlight = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  /** An answer or a save took away the button that had focus: focus goes to the choice now in force. */
  const refocusChoice = useRef(false);

  const isOut = published != null && published.visibility !== "PRIVATE";
  const sameContent =
    published != null &&
    published.showDetailedLoads === showDetailedLoads &&
    (published.caption ?? "") === caption.trim();
  const unchanged = sameContent && published?.visibility === visibility;
  /** The link shows something else than what's on screen: the next share updates it first. */
  const linkStale = link != null && !sameContent;

  // With a live link, fetch its image while the page is idle: a tap can then
  // share it straight away, inside the gesture Safari requires.
  useEffect(() => {
    if (!canShare || !link || linkStale) return;
    const key = `${link.token}:${link.version}`;
    if (story.current?.key === key) return;
    const run = () => {
      void prefetchStory(link.token, link.version).then((blob) => {
        story.current = { key, blob };
      });
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 300);
    return () => window.clearTimeout(id);
  }, [canShare, link, linkStale]);

  // The link is off: its confirm and "Desativar link" are gone with it, so focus
  // lands on the way to a new one (never lost on the page) — once enabled again.
  useEffect(() => {
    if (revoked && !revoking) copyButton.current?.focus();
  }, [revoked, revoking]);

  // "Tornar privado", "Publicar…" or an answer to the question (D-A) replaced the
  // button that was tapped: focus goes to "Quem vê"'s checked option, which says
  // what now holds — unless it already moved somewhere else.
  useEffect(() => {
    if (pending || !refocusChoice.current) return;
    refocusChoice.current = false;
    // Only when the focus went with the button (it's on the page itself now).
    if (document.activeElement && document.activeElement !== document.body) return;
    root.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
  }, [pending]);

  function adopt(state: SharedState) {
    setPublished({
      id: state.activityId,
      visibility: state.visibility,
      showDetailedLoads: state.showDetailedLoads,
      caption: state.caption,
      moderated: false,
    });
    if (link) setLink({ token: link.token, version: state.version });
  }

  function save(next: Visibility) {
    setError(null);
    setAnnounced("");
    startTransition(async () => {
      const result = await runAction(() => shareWorkoutSession({ sessionId, visibility: next, showDetailedLoads, caption }));
      if (result.ok) {
        adopt(result);
        setVisibility(next);
        refocusChoice.current = true;
        if (next !== "PRIVATE") setNotice(null);
        setAnnounced(
          next === "PRIVATE" ? "Salvo como privado." : next === "PUBLIC" ? "Publicado para todos." : "Publicado para seguidores.",
        );
        return;
      }
      // Keep the choices on screen; a failed publish must not replace the page.
      setError(
        failureText(
          result.error,
          next === "PRIVATE"
            ? "Sem conexão — continua publicado. Tente de novo quando voltar o sinal."
            : "Sem conexão — não publicou. Tente de novo quando voltar o sinal.",
          next === "PRIVATE" ? "Não foi possível tornar privado agora. Tente de novo." : "Não foi possível publicar agora. Tente de novo.",
        ),
      );
    });
  }

  function choose(value: Visibility) {
    setVisibility(value);
    setError(null);
  }

  // --- D-A: the one-time question to a PRIVATE default -----------------------

  function answerNotice(show: boolean) {
    setError(null);
    startTransition(async () => {
      if (show) {
        const result = await runAction(() => showWorkoutsToFollowers(sessionId));
        if (!result.ok) {
          setError(failureText(result.error, "Sem conexão — nada mudou. Tente de novo quando voltar o sinal.", "Não foi possível publicar agora. Tente de novo."));
          return;
        }
        adopt(result);
        setVisibility("FOLLOWERS");
        setShowDetailedLoads(result.showDetailedLoads);
        setNotice(null);
        refocusChoice.current = true;
        setAnnounced("Publicado para seguidores. Seus próximos treinos também vão para eles.");
        return;
      }
      const result = await runAction(() => keepWorkoutsPrivate());
      if (!result.ok) {
        setError(failureText(result.error, "Sem conexão — tente de novo quando voltar o sinal.", "Não foi possível salvar agora. Tente de novo."));
        return;
      }
      setNotice(null);
      refocusChoice.current = true;
      setAnnounced("Seus treinos continuam privados.");
    });
  }

  // --- Fora do app ------------------------------------------------------------

  /**
   * Runs one "Fora do app" action at a time. A double tap would otherwise start
   * a second share while the first sheet is still open — which the browser
   * refuses, and the page would say sharing failed right after it worked. Runs
   * `action` synchronously, so a share or a copy stays inside the tap.
   */
  async function once(action: () => Promise<void>) {
    if (outInFlight.current) return;
    outInFlight.current = true;
    try {
      await action();
    } finally {
      outInFlight.current = false;
    }
  }

  function resetShareStatus() {
    setShareError(null);
    setCopied(null);
    setRevoked(false);
    setConfirmRevoke(false);
  }

  /** The link as on screen: minted, or updated to these loads and caption. Null after saying why not. */
  async function ensureLink(): Promise<ShareLink | null> {
    const result = await runAction(() => ensureWorkoutShareLink({ sessionId, showDetailedLoads, caption }));
    if (!result.ok) {
      setShareError(failureText(result.error, OFFLINE_SHARE, SHARE_FAILED));
      return null;
    }
    setPublished({
      id: result.activityId,
      visibility: result.visibility,
      showDetailedLoads: result.showDetailedLoads,
      caption: result.caption,
      moderated: false,
    });
    const next = { token: result.token, version: result.version };
    setLink(next);
    return next;
  }

  function afterShare(outcome: ShareOutcome, file: File, blob: Blob) {
    if (outcome === "shared") {
      setReadyFile(null);
      setAnnounced("Imagem compartilhada.");
    } else if (outcome === "cancelled") {
      setReadyFile(null);
    } else if (outcome === "needs-gesture") {
      setReadyFile(file);
      setAnnounced("Imagem pronta. Toque para enviar.");
    } else if (outcome === "unsupported") {
      downloadBlob(blob, file.name);
      setAnnounced("Imagem baixada.");
    } else {
      setShareError(SHARE_FAILED);
    }
  }

  const shareTitle = `${workoutName} · FGPOWER`;
  // The link goes inside the text: WhatsApp and iOS drop `url` when a file is shared.
  const shareText = (token: string) => `Treino concluído na FGPOWER: ${workoutName}.\n${linkUrl(token)}`;

  async function shareImage() {
    resetShareStatus();
    setAnnounced("");
    // The image was ready and Safari wanted a fresh tap: this is it.
    if (readyFile && link && !linkStale) {
      afterShare(await shareImageAndLink({ file: readyFile, title: shareTitle, text: shareText(link.token) }), readyFile, readyFile);
      return;
    }
    setReadyFile(null);
    // Prefetched: share synchronously within this tap.
    const key = link ? `${link.token}:${link.version}` : null;
    const ready = link && !linkStale && story.current?.key === key ? story.current.blob : null;
    if (ready && link && canShare) {
      const file = new File([ready], imageName(workoutName), { type: "image/png" });
      afterShare(await shareImageAndLink({ file, title: shareTitle, text: shareText(link.token) }), file, ready);
      return;
    }
    setPreparing("image");
    try {
      const target = link && !linkStale ? link : await ensureLink();
      if (!target) return;
      const blob = await prefetchStory(target.token, target.version);
      if (!blob) {
        setShareError(navigator.onLine === false ? OFFLINE_SHARE : SHARE_FAILED);
        return;
      }
      story.current = { key: `${target.token}:${target.version}`, blob };
      const file = new File([blob], imageName(workoutName), { type: "image/png" });
      if (!canShare) {
        downloadBlob(blob, file.name);
        setAnnounced("Imagem baixada.");
        return;
      }
      afterShare(await shareImageAndLink({ file, title: shareTitle, text: shareText(target.token) }), file, blob);
    } finally {
      setPreparing(null);
    }
  }

  async function copyLink() {
    resetShareStatus();
    setAnnounced("");
    if (link && !linkStale) {
      const url = linkUrl(link.token);
      const ok = await copyTextKeepingActivation(url);
      setCopied(ok ? { ok: true } : { ok: false, url });
      if (ok) setAnnounced("Link copiado.");
      return;
    }
    setPreparing("link");
    const got: { link: ShareLink | null } = { link: null };
    // The clipboard write starts inside the tap and waits for the link (Safari keeps the activation).
    const url = ensureLink().then((l) => {
      got.link = l;
      if (!l) throw new Error("no link");
      return linkUrl(l.token);
    });
    const ok = await copyTextKeepingActivation(url);
    setPreparing(null);
    if (ok) {
      setCopied({ ok: true });
      setAnnounced("Link copiado.");
    } else if (got.link) {
      setCopied({ ok: false, url: linkUrl(got.link.token) });
    }
  }

  async function updateLink() {
    resetShareStatus();
    setPreparing("update");
    const next = await ensureLink();
    setPreparing(null);
    if (next) setAnnounced("Link atualizado.");
  }

  function revoke() {
    setShareError(null);
    startRevoke(async () => {
      const result = await runAction(() => revokeWorkoutShareLink(sessionId));
      if (!result.ok) {
        setShareError(failureText(result.error, OFFLINE_SHARE, "Não foi possível desativar o link agora. Tente de novo."));
        return;
      }
      setLink(null);
      setReadyFile(null);
      // The copied link is dead now: the button offers a new one, never "Link copiado" beside "Link desativado".
      setCopied(null);
      story.current = null;
      setConfirmRevoke(false);
      setRevoked(true);
      setAnnounced("Link desativado.");
    });
  }

  if (published?.moderated) {
    return (
      <div className="flex flex-col gap-1">
        <span className={FIELD}>Quem vê</span>
        <p className="text-xs text-muted">Esta publicação foi ocultada pela moderação. Só você vê este treino.</p>
      </div>
    );
  }

  const actionLabel = isOut ? "Atualizar" : visibility === "FOLLOWERS" ? "Publicar para seguidores" : "Publicar";
  const busy = pending || preparing !== null || revoking;
  const imageLabel = readyFile ? "Enviar imagem" : canShare === false ? "Baixar imagem" : "Compartilhar imagem";

  const loadsToggle = (
    <label className="flex min-h-9 items-center gap-2 text-[13px]">
      <input
        type="checkbox"
        checked={showDetailedLoads}
        onChange={(e) => setShowDetailedLoads(e.target.checked)}
        className="size-4 accent-accent"
      />
      Mostrar kg e reps
    </label>
  );

  return (
    // A container: the label sits beside the three options only where they all
    // fit with room to spare ("Seguidores" in semibold is ~76px of text; at a
    // 21rem row each segment has ~6px more, so a wider fallback font before
    // the webfont loads doesn't clip it either). Narrower (a 320–360px phone)
    // the label goes above them and the options take the full width.
    <div ref={root} className="@container flex flex-col gap-2.5">
      {notice ? (
        <div className="border-l-2 border-l-accent bg-surface-2 px-3 py-2.5" data-private-default-notice>
          <p className="text-sm">
            Seus treinos estão privados. Quer mostrar aos seus seguidores{notice.loadsHidden ? ", sem as cargas" : ""}?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="strong" disabled={busy} onClick={() => answerNotice(true)}>
              Mostrar aos seguidores
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => answerNotice(false)}>
              Manter privado
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col items-stretch gap-1.5 @min-[21rem]:flex-row @min-[21rem]:items-center @min-[21rem]:gap-3">
        <span id={`share-${sessionId}`} className={`shrink-0 ${FIELD}`}>
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
        <>
          {isOut ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">
                Publicado para {published?.visibility === "PUBLIC" ? "todos" : "seguidores"}. Tornar privado tira do feed.
              </p>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => save("PRIVATE")}>
                {pending ? "Salvando…" : "Tornar privado"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted">
              {link ? "Fora do feed — só quem tem o link vê este treino." : "Só você vê este treino."}
            </p>
          )}
          {loadsToggle}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {loadsToggle}
            {!captionOpen ? (
              <button
                type="button"
                onClick={() => setCaptionOpen(true)}
                className="hit min-h-9 text-[13px] font-semibold text-accent hover:underline"
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
              <Link href="/app/feed" className="hit inline-flex min-h-9 items-center gap-1 text-accent hover:underline">
                Ver no feed
                <GArrow className="size-3" />
              </Link>
            </div>
          ) : (
            <Button type="button" size="sm" className="self-start" disabled={busy} onClick={() => save(visibility)}>
              {pending ? "Publicando…" : actionLabel}
            </Button>
          )}
          {visibility === "FOLLOWERS" && followerCount === 0 ? (
            <p className="text-xs text-muted">Você ainda não tem seguidores — no feed, por enquanto, só você vê.</p>
          ) : null}
        </>
      )}

      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}

      {/* Out of the app: the story image and a link that opens without an account. */}
      <div className="mt-1 border-t border-border pt-3" role="group" aria-labelledby={`share-out-${sessionId}`}>
        <span id={`share-out-${sessionId}`} className={FIELD}>
          Fora do app
        </span>
        <div className="mt-2 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          <Button type="button" size="sm" variant="strong" disabled={busy} onClick={() => once(shareImage)}>
            {canShare === false && !readyFile ? <Download aria-hidden /> : <Share2 aria-hidden />}
            {preparing === "image" ? "Preparando…" : imageLabel}
          </Button>
          <Button ref={copyButton} type="button" size="sm" variant="outline" disabled={busy} onClick={() => once(copyLink)}>
            <Link2 aria-hidden />
            {preparing === "link" ? "Preparando…" : copied?.ok ? "Link copiado" : "Copiar link"}
          </Button>
        </div>

        {readyFile ? (
          <p className="mt-2 text-xs text-muted">Imagem pronta. Toque para enviar.</p>
        ) : link ? (
          <>
            <p className="mt-2 text-xs text-muted">Link ativo: quem tiver o link vê este treino, sem precisar de conta.</p>
            {linkStale ? (
              <p className="mt-1 text-xs text-muted">
                O link ainda mostra o treino como antes.{" "}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => once(updateLink)}
                  className="hit min-h-9 font-semibold text-accent hover:underline disabled:opacity-40"
                >
                  {preparing === "update" ? "Atualizando…" : "Atualizar link"}
                </button>
              </p>
            ) : null}
            {confirmRevoke ? (
              <div className="mt-2" role="group" aria-label="Desativar o link">
                <p className="text-xs">Desativar o link? Quem abrir o link antigo verá “link desativado”.</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="danger" disabled={revoking} onClick={revoke}>
                    {revoking ? "Desativando…" : "Desativar"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={revoking}
                    // Focus starts on the way out, as in every confirm (ConfirmSheet).
                    autoFocus
                    onClick={() => {
                      setConfirmRevoke(false);
                      revokeTrigger.current?.focus();
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-4">
                <Link href={sharePath(link.token)} className={`${TEXT_ACTION} text-accent`}>
                  Ver página
                </Link>
                <button
                  ref={revokeTrigger}
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmRevoke(true)}
                  className={`${TEXT_ACTION} text-danger disabled:opacity-40`}
                >
                  Desativar link
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="mt-2 text-xs text-muted">
            {revoked
              ? "Link desativado."
              : showDetailedLoads
                ? "Uma imagem para o story e um link que abre sem login — com suas cargas."
                : "Uma imagem para o story e um link que abre sem login. Cargas ficam ocultas."}
          </p>
        )}

        {copied && !copied.ok ? (
          <p className="mt-2 text-xs text-muted">
            Não deu para copiar. Link: <span className="select-all break-all font-mono text-foreground">{copied.url}</span>
          </p>
        ) : null}
        {shareError ? (
          <p role="alert" className="mt-2 text-xs font-medium text-danger">
            <ActionErrorText error={shareError} />
          </p>
        ) : null}
      </div>

      {/* Always in the page, so a change is announced (a status region added with its text may not be). */}
      <p role="status" className="sr-only">
        {pending || preparing ? "Preparando…" : announced}
      </p>
    </div>
  );
}
