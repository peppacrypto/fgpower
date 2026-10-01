"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { resumeReminders, updateReminderSettings } from "@/lib/actions/reminders";
import { PUSH_HOURS } from "@/lib/reminders/rules";
import { hourLabel, type ReminderSettings } from "@/lib/reminders/settings";
import { formatAppDate } from "@/lib/training/week";
import { plural } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  disablePush,
  enableErrorText,
  enablePush,
  isThisDeviceSubscribed,
  pushSupport,
  subscribePushSupport,
  type PushSupport,
} from "@/components/reminders/push-client";
import { runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { Button } from "@/components/ui/button";
import { SaveStatus } from "@/components/ui/save-status";
import { Toggle } from "@/components/ui/toggle";
import { useAutosave } from "@/components/ui/use-autosave";
import { SESSION_EXPIRED_ERROR } from "@/lib/auth/session-expired";

const FAILED = "Não foi possível concluir agora. Tente de novo.";
const OFFLINE = "Sem conexão. Tente de novo quando o sinal voltar.";

function pushDescription(support: PushSupport | null, unlocked: boolean, scheduleLabel: string | null): string {
  if (!unlocked) return "Disponível depois do seu primeiro treino.";
  switch (support) {
    case "ios-needs-install":
      return "No iPhone, as notificações só funcionam com a FGPOWER instalada na tela de início (iOS 16.4 ou mais novo).";
    case "unsupported":
      return "Este navegador não recebe notificações.";
    case "denied":
      return "As notificações estão bloqueadas para a FGPOWER neste navegador. Libere nas configurações do site e volte aqui.";
    default:
      return `${scheduleLabel ? `Nos seus dias de treino (${scheduleLabel})` : "Nos dias de treino do seu programa"}, se você ainda não treinou até o horário escolhido — e um aviso se um treino ficar aberto por mais de 3 h.`;
  }
}

/**
 * Settings → Lembretes (W-017, decision 8): the push switch for this device
 * (enabled after the first finished workout — D-B), the hour, the weekly
 * e-mail digest (opt-in — D-C), the pause. The hour and the digest autosave
 * as one block; the device switch talks to the browser and
 * /api/push/subscriptions.
 */
export function RemindersForm({
  push,
  email,
  initial,
  pausedAt,
  scheduleLabel,
}: {
  /** `deviceKeys`: the account's devices (lib/push/device-key), to find this browser among them. */
  push: { vapidPublicKey: string; devices: number; deviceKeys: string[]; unlocked: boolean } | null;
  email: { address: string; bounced: boolean } | null;
  initial: ReminderSettings;
  pausedAt: string | null;
  scheduleLabel: string | null;
}) {
  const { value, pending, savedAt, update, errorFor } = useAutosave(initial, updateReminderSettings);
  const support = useSyncExternalStore(subscribePushSupport, pushSupport, () => null);
  const [devices, setDevices] = useState(push?.devices ?? 0);
  // Whether this browser's own subscription is one of the account's devices (null until checked).
  const [thisDevice, setThisDevice] = useState<boolean | null>(push ? null : false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [paused, setPaused] = useState(pausedAt);
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const hourId = useId();

  // Checked once, against the devices the page was served with: from then on the switch
  // follows what is done here (a server re-render mustn't flip it back).
  const servedKeys = useRef(push?.deviceKeys ?? []);
  const hasPush = push != null;
  useEffect(() => {
    if (!hasPush) return;
    let live = true;
    void isThisDeviceSubscribed(servedKeys.current).then((mine) => {
      if (live) setThisDevice(mine);
    });
    return () => {
      live = false;
    };
  }, [hasPush]);

  const blocked = support === "unsupported" || support === "ios-needs-install" || support === "denied";

  async function togglePush(on: boolean) {
    if (!push) return;
    setPushBusy(true);
    setPushError(null);
    setNotice("");
    if (on) {
      const result = await enablePush(push.vapidPublicKey);
      if (result.ok) {
        setThisDevice(true);
        setDevices(result.devices);
        setPaused(null);
        setNotice("Notificações ativadas neste aparelho.");
      } else setPushError(enableErrorText(result));
    } else {
      const result = await disablePush("device");
      if (result.ok) {
        setThisDevice(false);
        setDevices(result.devices);
        setNotice("Notificações desativadas neste aparelho.");
      } else setPushError(result.reason === "session" ? SESSION_EXPIRED_ERROR : result.reason === "offline" ? OFFLINE : FAILED);
    }
    setPushBusy(false);
  }

  async function disableEverywhere() {
    setPushBusy(true);
    setPushError(null);
    const result = await disablePush("all");
    setPushBusy(false);
    if (result.ok) {
      setThisDevice(false);
      setDevices(0);
      setNotice("Notificações desativadas em todos os aparelhos.");
    } else setPushError(result.reason === "session" ? SESSION_EXPIRED_ERROR : result.reason === "offline" ? OFFLINE : FAILED);
  }

  async function resume() {
    setResuming(true);
    setResumeError(null);
    const result = await runAction(resumeReminders);
    setResuming(false);
    if (result.ok) {
      setPaused(null);
      setNotice("Lembretes retomados.");
    } else setResumeError(result.error);
  }

  const others = devices - (thisDevice ? 1 : 0);

  return (
    <div className="divide-y divide-border">
      {paused ? (
        <div className="pb-4">
          <div className="border-l-2 border-l-accent bg-surface-2 px-3.5 py-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Lembretes pausados</p>
            <p className="mt-1 text-sm">
              Pausamos em {formatAppDate(paused, { day: "2-digit", month: "2-digit" })} depois de 2 lembretes seguidos sem
              resposta. Eles voltam sozinhos no seu próximo treino.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={resume} disabled={resuming}>
              {resuming ? "Retomando…" : "Retomar agora"}
            </Button>
            {resumeError ? (
              <p role="alert" className="mt-2 text-sm font-medium text-danger">
                <ActionErrorText error={resumeError} />
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {push ? (
        <div>
          <Toggle
            label="Notificações neste aparelho"
            description={pushDescription(support, push.unlocked, scheduleLabel)}
            // Blocked here, nothing reaches this browser whatever the server still lists
            // (its row goes on the next push: the push service answers 404/410).
            checked={thisDevice === true && !blocked}
            onChange={togglePush}
            disabled={!push.unlocked || blocked || pushBusy || thisDevice === null || support === null}
            error={pushError}
          />
          {others > 0 ? (
            <p className="-mt-1 flex flex-wrap items-center gap-x-3 pb-3 text-xs text-muted">
              <span>Ativo em {plural(others, "outro aparelho", "outros aparelhos")}.</span>
              <button
                type="button"
                onClick={disableEverywhere}
                disabled={pushBusy}
                className="hit font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent underline decoration-2 underline-offset-[3px] disabled:opacity-40"
              >
                Desativar em todos
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      {push && devices > 0 ? (
        <fieldset className="py-3" aria-describedby={`${hourId}-hint`}>
          <legend className="text-sm font-medium">Horário</legend>
          <p id={`${hourId}-hint`} className="text-xs text-muted">
            Nos dias de treino, se você ainda não treinou até lá.
          </p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {PUSH_HOURS.map((h) => (
              <label key={h} className="relative">
                <input
                  type="radio"
                  name={`${hourId}-hour`}
                  value={h}
                  checked={value.hour === h}
                  onChange={() => update({ hour: h })}
                  className="peer absolute inset-0 size-full cursor-pointer appearance-none"
                />
                <span
                  className={cn(
                    "pointer-events-none flex h-11 items-center justify-center rounded-[3px] border font-mono text-[13px] font-bold tabular-nums transition-colors",
                    "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                    value.hour === h ? "border-accent bg-accent-soft text-accent" : "border-border text-muted",
                  )}
                >
                  {hourLabel(h)}
                </span>
              </label>
            ))}
          </div>
          {errorFor("hour") ? (
            <p role="alert" className="mt-2 text-xs font-medium text-danger">
              <ActionErrorText error={errorFor("hour")!} />
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {email ? (
        // The label balances its two lines on a 320px phone ("Resumo semanal" / "por e-mail")
        // instead of breaking "e-mail" at its hyphen. Done by layout: the label is the switch's
        // name, and a non-breaking hyphen (U+2011) would change what it says.
        <div className="[&_label>span:first-child>span:first-child]:text-balance">
          <Toggle
            label="Resumo semanal por e-mail"
            description={`Toda semana, no seu primeiro dia de treino, às 7h: como foi a semana passada e o que vem nesta. Para ${email.address}.${email.bounced ? " O último e-mail voltou — confira o endereço da sua conta." : ""}`}
            checked={value.emailDigest}
            onChange={(v) => update({ emailDigest: v })}
            error={errorFor("emailDigest")}
          />
        </div>
      ) : null}

      <div className="pt-3">
        <p className="text-xs text-muted">
          No máximo 1 lembrete por dia e 3 por semana. Nunca em dia de descanso ou semana de deload. Se 2 seguidos ficarem
          sem resposta, pausamos até o seu próximo treino.
        </p>
        <p role="status" className={notice ? "mt-2 text-xs font-medium" : "sr-only"}>
          {notice}
        </p>
        <SaveStatus pending={pending} savedAt={savedAt} idleText="Salvo automaticamente" className="pt-2" />
      </div>
    </div>
  );
}
