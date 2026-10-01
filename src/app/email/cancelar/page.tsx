import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { digestStateForToken } from "@/lib/reminders/unsubscribe";
import { resubscribeDigest, unsubscribeDigest } from "./actions";

/**
 * The title names the outcome: after a button the page comes back with
 * `feito`, and a new title is what the route announcer reads out.
 */
export async function generateMetadata({ searchParams }: PageProps<"/email/cancelar">): Promise<Metadata> {
  const { feito } = await searchParams;
  const title = feito === "cancelado" ? "Inscrição cancelada" : feito === "reativado" ? "Resumo reativado" : "Resumo semanal";
  return { title, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

const KICKER = "font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted";

/**
 * The digest's "Parar de receber" link (W-017): a signed token, no sign-in.
 * Opening it changes nothing (mail scanners open links); the button does,
 * and "Reativar resumo" undoes it.
 */
export default async function CancelDigestPage({ searchParams }: PageProps<"/email/cancelar">) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const done = typeof sp.feito === "string" ? sp.feito : null;
  const state = await digestStateForToken(token);

  return (
    <MarketingShell>
      <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
        <div className="reg-frame p-6 sm:p-8">
          <p className={KICKER}>E-mail</p>
          {!state ? (
            <>
              <h1 className="text-display mt-2 text-2xl font-extrabold">Link inválido ou expirado</h1>
              <p className="mt-2 text-sm text-muted">Gerencie seus e-mails em Configurações → Lembretes.</p>
              <Button asChild variant="strong" size="lg" className="mt-6 w-full">
                <Link href="/login?next=%2Fapp%2Fsettings">Entrar</Link>
              </Button>
            </>
          ) : state.subscribed ? (
            <>
              {done === "reativado" ? (
                <p role="status" className="mt-2 border-l-2 border-l-success bg-surface-2 px-3 py-2 text-sm">
                  Resumo reativado. Ele volta na sua próxima semana de treino.
                </p>
              ) : null}
              <h1 className="text-display mt-2 text-2xl font-extrabold">Parar de receber o resumo semanal?</h1>
              <p className="mt-2 text-sm text-muted">
                Você não vai mais receber o resumo das suas semanas de treino por e-mail. Lembretes no celular não mudam.
              </p>
              <form action={unsubscribeDigest} className="mt-6">
                <input type="hidden" name="t" value={token} />
                <SubmitButton variant="strong" size="lg" className="w-full" pendingLabel="Cancelando…">
                  Cancelar inscrição
                </SubmitButton>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-display mt-2 text-2xl font-extrabold">
                Pronto. Você não vai mais receber o resumo semanal.
              </h1>
              {state.canResubscribe ? (
                <form action={resubscribeDigest} className="mt-6">
                  <input type="hidden" name="t" value={token} />
                  <SubmitButton variant="outline" size="lg" className="w-full" pendingLabel="Reativando…">
                    Reativar resumo
                  </SubmitButton>
                </form>
              ) : null}
            </>
          )}
          {done === "erro" ? (
            <p role="alert" className="mt-4 text-sm font-medium text-danger">
              Não foi possível concluir agora. Tente de novo.
            </p>
          ) : null}
          {state ? (
            <p className="mt-6 text-sm">
              <Link href="/app/settings#lembretes" className="font-semibold text-accent underline decoration-2 underline-offset-[3px]">
                Gerenciar lembretes
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </MarketingShell>
  );
}
