"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { acceptEmailDigest, acceptReminderAsk, dismissReminderAsk } from "@/lib/actions/reminders";
import { InstallAppCard } from "@/components/pwa/install-app-card";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { enableErrorText, enablePush, pushSupport, subscribePushSupport, type PushSupport } from "./push-client";

/** What the server offers after this workout (post-workout-asks.tsx decides whether to ask at all). */
export interface ReminderAskOffer {
  /** Push can be turned on from this server (the key the browser subscribes with). */
  push: { vapidPublicKey: string } | null;
  /** E-mail is on and the digest isn't: offered as a checkbox (D-C), or alone where push can't work. */
  email: { address: string } | null;
  /** "SEG · QUA · SEX", or null without a schedule. */
  scheduleLabel: string | null;
  /** "18h" */
  hour: string;
}

export interface PostWorkoutAskProps {
  /** The reminders ask, or null: the install card, as before. */
  ask: ReminderAskOffer | null;
  /** The workout's ordinal: the install card waits for the first few. */
  finishedWorkouts: number;
  /** Names this summary's ask ("<user>:<ordinal>"): once answered here, Back doesn't offer it again. */
  answerKey: string;
  className?: string;
}

type AskProps = ReminderAskOffer & { className?: string; onAnswered: () => void };

const serverSupport = () => null;

/**
 * Back to a summary whose ask was answered: the router brings back the page
 * as first served — the ask included — and mounts it anew, so the answer is
 * remembered in this tab (a reload asks the server, which no longer offers it).
 */
const ANSWERED_PREFIX = "fg:reminder-ask-answered:";

function wasAnswered(key: string): boolean {
  try {
    return window.sessionStorage.getItem(ANSWERED_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function rememberAnswered(key: string) {
  try {
    window.sessionStorage.setItem(ANSWERED_PREFIX + key, "1");
  } catch {
    // Storage off (private mode): Back may show the ask once more; answering again is harmless.
  }
}

/**
 * The one ask after a fresh workout (decision 8, W-017), chosen on the device:
 * - an iPhone outside the installed app can't get pushes — the install card
 *   (installing is the way to reminders there);
 * - a browser that can: "Lembrar você nos dias de treino?", with the weekly
 *   e-mail as a checkbox when e-mail is on;
 * - one that can't (blocked, unsupported): the e-mail digest alone, when on;
 * - otherwise the install card, as before.
 * Permission is requested only by the "Ativar lembretes" tap.
 *
 * The ask is the one the page was first served. Answering it makes the server
 * say "no ask" from then on, and a server re-render of the summary (a
 * revalidation, or the session cookie refreshed inside any action) must not
 * swap the confirmation — or a half-answered ask and its checkbox — away.
 */
export function PostWorkoutAskSwitch({ ask: served, finishedWorkouts, answerKey, className }: PostWorkoutAskProps) {
  const [ask] = useState(served);
  const live = useSyncExternalStore(subscribePushSupport, pushSupport, serverSupport);
  // Chosen once, on the first client render: the permission answer mustn't swap the card
  // away mid-ask (a "Bloqueadas" message would vanish with it).
  const [mode, setMode] = useState<PushSupport | null>(null);
  const [answeredBefore, setAnsweredBefore] = useState(false);
  if (mode === null && live !== null) {
    setMode(live);
    setAnsweredBefore(ask != null && wasAnswered(answerKey));
  }
  if (!ask) return <InstallAppCard finishedWorkouts={finishedWorkouts} className={className} />;
  if (mode === null) return null;
  if (answeredBefore || mode === "ios-needs-install") {
    return <InstallAppCard finishedWorkouts={finishedWorkouts} className={className} />;
  }
  const onAnswered = () => rememberAnswered(answerKey);
  if (ask.push && (mode === "default" || mode === "granted")) {
    return <ReminderAsk {...ask} push={ask.push} onAnswered={onAnswered} className={className} />;
  }
  if (ask.email) return <EmailDigestAsk {...ask} email={ask.email} onAnswered={onAnswered} className={className} />;
  return <InstallAppCard finishedWorkouts={finishedWorkouts} className={className} />;
}

function AskFrame({
  titleId,
  title,
  children,
  className,
}: {
  titleId: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={titleId} data-reminder-ask className={cn("reg-frame p-5", className)}>
      <span className="tag tag--field text-accent">Lembretes</span>
      <h2 id={titleId} className="text-display mt-2 text-xl font-extrabold leading-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * The answer's line, in place of the ask. The button just tapped is gone
 * with the ask, so the focus moves here (and reads it out) instead of
 * falling back to the top of the page. Only ever mounted by a tap.
 */
function Answered({ text, done, className }: { text: string; done: boolean; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <p
      ref={ref}
      role="status"
      tabIndex={-1}
      className={cn(
        "outline-none",
        done ? "border-l-2 border-l-success bg-surface-2 px-3 py-2 text-sm" : "text-sm text-muted",
        className,
      )}
    >
      {text}
    </p>
  );
}

const NOT_NOW_TEXT = "Tudo bem. Dá para ativar em Configurações → Lembretes.";

function ReminderAsk({
  push,
  email,
  scheduleLabel,
  hour,
  onAnswered,
  className,
}: AskProps & { push: { vapidPublicKey: string } }) {
  const titleId = useId();
  const digestId = useId();
  const [digest, setDigest] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"ask" | "done" | "dismissed">("ask");

  async function activate() {
    setPending(true);
    setError(null);
    const enabled = await enablePush(push.vapidPublicKey);
    if (!enabled.ok) {
      setPending(false);
      setError(enableErrorText(enabled));
      // A no from the browser is a no: don't ask again after the next workout.
      if (enabled.reason === "denied") {
        void runAction(dismissReminderAsk).then((r) => {
          if (r.ok) onAnswered();
        });
      }
      return;
    }
    const saved = await runAction(() => acceptReminderAsk({ emailDigest: digest && email != null }));
    setPending(false);
    if (!saved.ok) {
      // The device is on; only the digest choice failed.
      setError(saved.error);
      return;
    }
    onAnswered();
    setState("done");
  }

  async function notNow() {
    setState("dismissed");
    const result = await runAction(dismissReminderAsk);
    if (!result.ok) {
      setState("ask");
      setError(result.error);
    } else onAnswered();
  }

  if (state === "dismissed") return <Answered done={false} className={className} text={NOT_NOW_TEXT} />;
  if (state === "done") {
    return (
      <Answered
        done
        className={className}
        text={`Lembretes ativados · ${scheduleLabel ? `${scheduleLabel} ` : ""}às ${hour}.${digest && email ? " Resumo semanal por e-mail ativado." : ""} Ajuste em Configurações → Lembretes.`}
      />
    );
  }
  return (
    <AskFrame titleId={titleId} title="Lembrar você nos dias de treino?" className={className}>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
        <span>{scheduleLabel ? `${scheduleLabel} · às ${hour}` : `Nos dias do seu programa · às ${hour}`}</span>
        <Link href="/app/settings#rotina" className="hit text-accent underline decoration-2 underline-offset-[3px]">
          Trocar dias
        </Link>
      </p>
      <p className="mt-1.5 text-sm text-muted">No máximo 3 por semana. Nunca em dia de descanso ou semana de deload.</p>
      {email ? (
        <label htmlFor={digestId} className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
          <input
            id={digestId}
            type="checkbox"
            checked={digest}
            onChange={(e) => setDigest(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
          />
          <span className="min-w-0 text-sm">
            <span className="block font-medium">
              E um resumo semanal por <span className="whitespace-nowrap">e-mail</span>
            </span>
            <span className="block text-xs text-muted [overflow-wrap:anywhere]">No seu primeiro dia de treino, às 7h. Para {email.address}.</span>
          </span>
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-1">
        <Button variant="strong" className="px-4" onClick={activate} disabled={pending}>
          {pending ? "Ativando…" : "Ativar lembretes"}
        </Button>
        <Button variant="ghost" className="px-3" onClick={notNow} disabled={pending}>
          Agora não
        </Button>
      </div>
    </AskFrame>
  );
}

function EmailDigestAsk({ email, onAnswered, className }: AskProps & { email: { address: string } }) {
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"ask" | "done" | "dismissed">("ask");

  async function accept() {
    setPending(true);
    setError(null);
    const result = await runAction(acceptEmailDigest);
    setPending(false);
    if (result.ok) {
      onAnswered();
      setState("done");
    } else setError(result.error);
  }

  async function notNow() {
    setState("dismissed");
    const result = await runAction(dismissReminderAsk);
    if (!result.ok) {
      setState("ask");
      setError(result.error);
    } else onAnswered();
  }

  if (state === "dismissed") return <Answered done={false} className={className} text={NOT_NOW_TEXT} />;
  if (state === "done") {
    return (
      <Answered done className={className} text={`Resumo semanal ativado · para ${email.address}. Ajuste em Configurações → Lembretes.`} />
    );
  }
  return (
    <AskFrame titleId={titleId} title="Receber o resumo da semana por e-mail?" className={className}>
      <p className="mt-1.5 text-sm text-muted [overflow-wrap:anywhere]">
        Toda semana, no seu primeiro dia de treino: a semana passada e a que começa. Para {email.address}.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          <ActionErrorText error={error} />
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-1">
        <Button variant="strong" className="px-4" onClick={accept} disabled={pending}>
          {pending ? "Ativando…" : "Quero o resumo"}
        </Button>
        <Button variant="ghost" className="px-3" onClick={notNow} disabled={pending}>
          Agora não
        </Button>
      </div>
    </AskFrame>
  );
}
