import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import {
  CONTROLLER_NAME,
  CONTROLLER_REGISTRATION,
  MINIMUM_AGE,
  POLICY_DISPLAY_VERSION,
  POLICY_LAST_UPDATED,
  PRIVACY_CONTACT_EMAIL,
} from "@/lib/legal/policy";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function TermsPage() {
  // While the controller identity, contact or minimum age are still unset
  // (lib/legal/policy.ts), a review banner shows and those lines degrade
  // gracefully — never printing the raw [OWNER/LEGAL] markers.
  const underReview = !CONTROLLER_NAME || !PRIVACY_CONTACT_EMAIL || !MINIMUM_AGE;

  return (
    <MarketingShell>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Termos de Uso</h1>
      <p className="mt-2 text-sm text-muted">Última atualização: {POLICY_LAST_UPDATED} · Versão {POLICY_DISPLAY_VERSION}</p>

      {underReview ? (
        <div className="mt-6 border-l-2 border-l-warning bg-warning-soft px-3.5 py-2.5 text-sm text-foreground/90">
          <strong>Em revisão jurídica.</strong> A identificação do responsável, o contato e a idade mínima ainda
          estão sendo finalizados. Para falar sobre estes Termos ou seus dados, use{" "}
          <a href="/privacidade/solicitar" className="underline">Solicitar meus dados</a>.
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-6 text-sm text-foreground/90">
        <section>
          <h2 className="font-semibold">Quem oferece a FGPOWER</h2>
          {CONTROLLER_NAME ? (
            <p className="mt-1.5">
              A FGPOWER é oferecida por {CONTROLLER_NAME}{CONTROLLER_REGISTRATION ? `, ${CONTROLLER_REGISTRATION}` : ""}.{" "}
              {PRIVACY_CONTACT_EMAIL ? (
                <>
                  Para falar sobre estes Termos ou sobre seus dados, escreva para{" "}
                  <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="underline">{PRIVACY_CONTACT_EMAIL}</a>.
                </>
              ) : (
                <>
                  Para falar sobre estes Termos ou sobre seus dados, use{" "}
                  <a href="/privacidade/solicitar" className="underline">Solicitar meus dados</a>.
                </>
              )}{" "}
              O tratamento de dados pessoais é descrito na{" "}
              <a href="/privacy" className="underline">Política de Privacidade</a>.
            </p>
          ) : (
            <p className="mt-1.5">
              O responsável pela FGPOWER está sendo identificado nesta revisão (veja o aviso acima). Para falar sobre
              estes Termos ou sobre seus dados, use{" "}
              <a href="/privacidade/solicitar" className="underline">Solicitar meus dados</a>. O tratamento de dados
              pessoais é descrito na <a href="/privacy" className="underline">Política de Privacidade</a>.
            </p>
          )}
        </section>
        <section>
          <h2 className="font-semibold">Idade mínima</h2>
          <p className="mt-1.5">
            {MINIMUM_AGE
              ? `Você declara ter pelo menos ${MINIMUM_AGE} para usar a FGPOWER. `
              : "A idade mínima para usar a FGPOWER está sendo definida nesta revisão. "}
            O uso por menores observa o art. 14 da LGPD.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Aviso educacional, não médico</h2>
          <p className="mt-1.5">
            A FGPOWER é uma ferramenta educacional de planejamento e registro de treino de força. O conteúdo
            científico apresentado descreve princípios de treinamento e biomecânica com base em literatura
            publicada — não constitui diagnóstico, tratamento ou aconselhamento médico individualizado. Consulte um
            profissional de saúde qualificado antes de iniciar qualquer programa de exercícios, especialmente se
            você tiver uma condição de saúde preexistente.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Risco do exercício físico</h2>
          <p className="mt-1.5">
            Todo exercício físico envolve algum risco de lesão. Você é responsável por executar os exercícios com
            técnica adequada e dentro dos seus próprios limites. A FGPOWER não se responsabiliza por lesões
            decorrentes do uso do aplicativo.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Sua conta</h2>
          <p className="mt-1.5">
            Você é responsável por manter a segurança da sua conta. Não compartilhe suas credenciais de acesso.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Conteúdo do usuário</h2>
          <p className="mt-1.5">
            Você mantém a propriedade dos dados de treino que registra. Ao compartilhar um treino publicamente ou
            com seguidores, você concede à FGPOWER permissão para exibir esse conteúdo dentro do aplicativo,
            conforme as configurações de visibilidade que você escolher.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Comportamento na comunidade</h2>
          <p className="mt-1.5">
            Spam, assédio e dados de treino fabricados são proibidos. Contas que violarem estas regras podem ter
            conteúdo removido ou ser suspensas.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Alterações</h2>
          <p className="mt-1.5">
            Podemos atualizar estes termos. Mudanças significativas serão comunicadas no aplicativo, e usuários já
            cadastrados são notificados. Esta é a versão {POLICY_DISPLAY_VERSION}.
          </p>
        </section>
      </div>
    </div>
    </MarketingShell>
  );
}
