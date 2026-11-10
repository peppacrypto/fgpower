"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { BellRing, X } from "lucide-react";
import { pushSupport, subscribePushSupport } from "@/components/reminders/push-client";
import { readWorkoutPref, writeWorkoutPref } from "@/components/workout/local-workout";
import { restSoundUnreliable } from "./rest-audio";
import { restAlertHintKind, type AlertDevice } from "./rest-notification";

/** Closed once on this device, it stays closed (an installed app keeps its own storage, so it may say it there again). */
export const REST_ALERT_HINT_PREF = "rest-alert-hint";

const noSubscribe = () => () => {};
const soundUnreliable = () => restSoundUnreliable();
const readClosed = () => readWorkoutPref(REST_ALERT_HINT_PREF) === "closed";
const SETTINGS_HREF = "/app/settings#lembretes";

/**
 * Over the rest bar, on an iPhone whose browser can't sound the end of a rest
 * and whose notifications aren't on: how to get the alert (rest-notification
 * restAlertHintKind). Short, and closed for good with its ×.
 */
export function RestAlertHint({
  device,
  firstWorkout,
}: {
  device: AlertDevice;
  /** Notifications turn on after the first finished workout (decision 8): until then it says so. */
  firstWorkout: boolean;
}) {
  const unreliable = useSyncExternalStore(noSubscribe, soundUnreliable, () => false);
  const support = useSyncExternalStore(subscribePushSupport, pushSupport, () => null);
  const storedClosed = useSyncExternalStore(noSubscribe, readClosed, () => true);
  const [closed, setClosed] = useState(false);
  const kind = restAlertHintKind({ soundUnreliable: unreliable, support, device });
  if (!kind || closed || storedClosed) return null;

  const later = firstWorkout ? "depois deste treino, " : "";
  let text: string;
  let link: string | null = null;
  if (kind === "install") {
    text = `no iPhone ele chega como notificação, e o iPhone só as entrega ao app na Tela de Início. Toque em Compartilhar › Adicionar à Tela de Início, abra a FGPOWER por lá e, ${later}ative as notificações em Configurações › Lembretes.`;
    link = firstWorkout ? null : "Ver em Configurações";
  } else if (kind === "enable") {
    text = `com a tela bloqueada, o iPhone só avisa por notificação. ${firstWorkout ? "Depois deste treino, ative" : "Ative"} as notificações neste aparelho.`;
    link = firstWorkout ? null : "Ativar em Configurações";
  } else {
    text = "as notificações da FGPOWER estão bloqueadas neste aparelho. Libere em Ajustes › Notificações › FGPOWER.";
  }

  return (
    <div
      role="note"
      data-rest-alert-hint={kind}
      className="pointer-events-auto mx-auto mb-2 flex max-w-[46rem] items-start gap-2.5 rounded-[var(--radius-lg)] border border-border bg-surface py-2.5 pl-3.5 pr-1.5 text-[13px] leading-snug text-foreground shadow-[var(--shadow-md)]"
    >
      <BellRing aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Aviso no fim do descanso:</span> {text}
        {link ? (
          <>
            {" "}
            <Link href={SETTINGS_HREF} className="font-semibold text-accent underline underline-offset-2">
              {link}
            </Link>
          </>
        ) : null}
      </p>
      <button
        type="button"
        onClick={() => {
          writeWorkoutPref(REST_ALERT_HINT_PREF, "closed");
          setClosed(true);
        }}
        aria-label="Fechar dica do aviso no fim do descanso"
        className="-my-2 flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-muted hover:bg-surface-2 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
