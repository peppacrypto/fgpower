"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/auth-client";
import { OFFLINE_ERROR } from "@/components/social/run-action";
import { SESSION_EXPIRED_ERROR, loginAgainHref } from "@/lib/auth/session-expired";
import { WORKOUT_PREFS_COOKIE } from "@/components/workout/local-workout";
import { signOutAction } from "./actions";
import { SignOutRow } from "./sign-out-row";
import { ExportLinks } from "./export-links";

/** Where "Entrar de novo para excluir" comes back to: this panel, open. */
const DELETE_RETURN = "/app/settings?excluir=1";

/** A long label wraps inside its button on a 320px phone instead of spilling out of the red band. */
const WRAPS = "h-auto min-h-9 max-w-full whitespace-normal py-2";

/**
 * Settings → Dados e conta (W-151): the export, "Sair da conta" and, last on
 * its red band, deleting the account. Deleting needs a sign-in from the last
 * 24 h (better-auth freshAge): the page already knows whether this one is
 * (`freshLogin`), so an older login is offered "Entrar de novo para excluir"
 * up front — never a delete that fails first. Coming back from that login
 * (`?excluir=1`) opens the panel with focus on its heading, which names the
 * account: Google's account picker can sign in a different one.
 */
export function DangerZone({
  account,
  freshLogin,
  openDelete = false,
}: {
  account: { email: string; name: string };
  /** The session was created within the last 24 h: the delete can go through. */
  freshLogin: boolean;
  /** Back from "Entrar de novo para excluir" (?excluir=1). */
  openDelete?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(openDelete);
  const [fresh, setFresh] = useState(freshLogin);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(openDelete);

  // Back from the login: the panel in view, focus on its heading (never on
  // the delete button), and ?excluir=1 gone so a reload doesn't reopen it.
  // Through the router, not history.replaceState: Next writes its own URL
  // back on the page's next server re-render, which brought ?excluir=1 back.
  // The panel is state, kept through that re-render (R5).
  useEffect(() => {
    if (!openDelete) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("excluir")) {
      url.searchParams.delete("excluir");
      router.replace(url.pathname + url.search + url.hash, { scroll: false });
    }
  }, [openDelete, router]);

  useEffect(() => {
    if (!confirming || !focusHeading.current) return;
    focusHeading.current = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    headingRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }, [confirming]);

  function reLogin() {
    // Offline, signing out would only strand the user on the offline page, still signed in.
    if (navigator.onLine === false) {
      setError(OFFLINE_ERROR);
      return;
    }
    setError(null);
    setLeaving(true);
    signOutAction()
      .catch(() => null)
      .then(() => window.location.replace(`/login?next=${encodeURIComponent(DELETE_RETURN)}`));
  }

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    let result: Awaited<ReturnType<typeof authClient.deleteUser>>;
    try {
      result = await authClient.deleteUser({});
    } catch {
      setError(navigator.onLine === false ? OFFLINE_ERROR : "Não foi possível excluir a conta agora. Tente de novo.");
      setDeleting(false);
      return;
    }
    const deleteError = result.error;
    if (deleteError) {
      setDeleting(false);
      if (deleteError.code === "SESSION_EXPIRED") {
        // Older than the server allows (a clock between us and it): the same way through.
        setFresh(false);
      } else if (deleteError.status === 401) {
        setError(SESSION_EXPIRED_ERROR);
      } else if (deleteError.status === 0 || navigator.onLine === false) {
        setError(OFFLINE_ERROR);
      } else {
        setError("Não foi possível excluir a conta agora. Tente de novo.");
      }
      return;
    }
    forgetThisDevice();
    window.location.replace("/?conta=excluida");
  }

  return (
    // Rows on the section's own panel (no panel inside the panel), the
    // irreversible one last, on its red band.
    <div className="flex flex-col">
      <div className="border-b border-border pb-4">
        <p className="text-sm font-medium">Exportar meus dados</p>
        <p className="text-xs text-muted">
          Seus treinos em planilha (uma linha por série) ou tudo o que a conta guarda, em JSON.
        </p>
        <ExportLinks className="mt-2.5" />
      </div>

      <div className="border-b border-border py-3">
        <SignOutRow />
      </div>

      <div id="excluir-conta" className="mt-4 scroll-mt-4 border-y-2 border-y-danger bg-danger-soft p-4">
        <p className="text-sm font-semibold text-danger">Excluir conta</p>
        <p className="mt-0.5 text-xs text-foreground/85">
          Remove permanentemente sua conta e todo o seu histórico de treino. Não pode ser desfeito.
        </p>

        {!confirming ? (
          <Button
            variant="danger"
            size="sm"
            className="mt-3"
            onClick={() => {
              focusHeading.current = true;
              setError(null);
              setConfirming(true);
            }}
          >
            <Trash2 className="size-4" />
            Excluir minha conta
          </Button>
        ) : (
          <div role="group" aria-labelledby="excluir-conta-titulo" className="mt-3 flex flex-col gap-2.5 border-l-2 border-l-danger pl-3">
            <h3 id="excluir-conta-titulo" ref={headingRef} tabIndex={-1} className="text-sm font-semibold outline-none wrap-break-word">
              Excluir a conta <span className="font-mono text-[13px]">{account.email}</span>?
            </h3>
            <p className="text-xs text-foreground/85">
              Isso apaga para sempre seus programas, treinos, recordes e publicações. Não dá para desfazer.
            </p>
            <ExportLinks variant="inline" />
            {!fresh ? (
              <p className="text-xs font-medium text-foreground">
                Por segurança, excluir a conta pede um login feito nas últimas 24 horas.
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-xs font-medium text-danger">
                {error}
                {error === SESSION_EXPIRED_ERROR ? (
                  <>
                    {" "}
                    <Link href={loginAgainHref(DELETE_RETURN)} className="font-semibold underline underline-offset-2">
                      Entrar
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {fresh ? (
                <Button variant="danger" size="sm" disabled={deleting} onClick={deleteAccount} className={WRAPS}>
                  <Trash2 className="size-4" />
                  {deleting ? "Excluindo…" : "Sim, excluir permanentemente"}
                </Button>
              ) : (
                <Button variant="strong" size="sm" disabled={leaving} onClick={reLogin} className={WRAPS}>
                  <LogIn className="size-4" />
                  {leaving ? "Saindo…" : "Entrar de novo para excluir"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
                disabled={deleting || leaving}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The deleted account leaves nothing on this phone: workout drafts, rest
 * timers, builder drafts and screen prefs (every "fg:" key) and the
 * workout-prefs cookie. The theme cookie (fg-theme) is the device's, not the
 * account's: it stays.
 */
function forgetThisDevice() {
  for (const storage of [safeStorage("localStorage"), safeStorage("sessionStorage")]) {
    if (!storage) continue;
    try {
      const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
        (k): k is string => k !== null && k.startsWith("fg:"),
      );
      for (const key of keys) storage.removeItem(key);
    } catch {
      /* storage unavailable — nothing kept there */
    }
  }
  try {
    document.cookie = `${WORKOUT_PREFS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    /* cookies blocked */
  }
}

function safeStorage(name: "localStorage" | "sessionStorage"): Storage | null {
  try {
    return window[name];
  } catch {
    return null;
  }
}
