import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import {
  CONTROLLER_ADDRESS,
  CONTROLLER_NAME,
  CONTROLLER_REGISTRATION,
  DPO_CONTACT,
  HEALTH_DATA_RETENTION,
  MINIMUM_AGE,
  POLICY_DISPLAY_VERSION,
  POLICY_LAST_UPDATED,
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_RESPONSE_TIME,
} from "@/lib/legal/policy";

export const metadata: Metadata = { title: "Privacidade" };

/** Static: no request data, so it's prerendered (like /terms). */
export default function PrivacyPage() {
  // The policy ships with owner/legal fields still empty (lib/legal/policy.ts).
  // While any required one is blank, a review banner shows and each affected
  // line degrades gracefully — we never print the raw [OWNER/LEGAL] markers.
  const underReview =
    !CONTROLLER_NAME ||
    !CONTROLLER_REGISTRATION ||
    !CONTROLLER_ADDRESS ||
    !DPO_CONTACT ||
    !PRIVACY_CONTACT_EMAIL ||
    !PRIVACY_RESPONSE_TIME ||
    !MINIMUM_AGE ||
    !HEALTH_DATA_RETENTION;

  return (
    <MarketingShell>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted">Última atualização: {POLICY_LAST_UPDATED} · Versão {POLICY_DISPLAY_VERSION}</p>

      {underReview ? (
        <div className="mt-6 border-l-2 border-l-warning bg-warning-soft px-3.5 py-2.5 text-sm text-foreground/90">
          <strong>Política em revisão jurídica.</strong> Alguns itens — a identificação do controlador, o contato
          de privacidade, as bases legais e os prazos de retenção — ainda estão sendo finalizados. Para exercer
          seus direitos enquanto isso, use{" "}
          <a href="/privacidade/solicitar" className="underline">Solicitar meus dados</a>.
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-6 text-sm text-foreground/90">
        <section>
          <h2 className="font-semibold">Quem é o controlador</h2>
          {CONTROLLER_NAME ? (
            <p className="mt-1.5">
              O controlador dos seus dados pessoais, nos termos da LGPD (Lei nº 13.709/2018), é {CONTROLLER_NAME}
              {CONTROLLER_REGISTRATION ? `, inscrito em ${CONTROLLER_REGISTRATION}` : ""}
              {CONTROLLER_ADDRESS ? `, com sede em ${CONTROLLER_ADDRESS}` : ""}.
              {DPO_CONTACT ? ` Encarregado pelo Tratamento de Dados Pessoais (DPO): ${DPO_CONTACT}.` : ""}
            </p>
          ) : (
            <p className="mt-1.5">
              O controlador dos seus dados pessoais, nos termos da LGPD (Lei nº 13.709/2018), está sendo
              identificado nesta revisão da política (veja o aviso acima). Enquanto isso, você pode exercer seus
              direitos pelo canal{" "}
              <a href="/privacidade/solicitar" className="underline">Solicitar meus dados</a>.
            </p>
          )}
        </section>
        <section>
          <h2 className="font-semibold">Fale com a gente</h2>
          <p className="mt-1.5">
            Para exercer seus direitos, tirar dúvidas ou registrar uma reclamação sobre seus dados, use o canal{" "}
            <a href="/privacidade/solicitar" className="underline">Solicitar meus dados</a>
            {PRIVACY_CONTACT_EMAIL ? (
              <>
                {" "}ou escreva para{" "}
                <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="underline">{PRIVACY_CONTACT_EMAIL}</a>
              </>
            ) : null}
            .{PRIVACY_RESPONSE_TIME ? ` Responderemos no prazo de ${PRIVACY_RESPONSE_TIME}.` : ""} Esse canal
            funciona mesmo que sua conta esteja suspensa.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">O que coletamos</h2>
          <p className="mt-1.5">
            Ao entrar com sua conta Google, coletamos seu nome, e-mail e foto de perfil; ao entrar por e-mail, apenas o
            endereço. Você fornece voluntariamente dados de treino: objetivo, experiência, programas, séries,
            repetições, carga, RIR e, se você optar por informar, medidas corporais (peso e circunferências) e um
            check-in depois do treino (esforço, dores de entrada, sono, dor persistente e estresse). Você também pode
            escrever, em campos de texto livre, suas limitações ou lesões (“evitar agachamento profundo por causa do
            joelho”), detalhes do seu treino de resistência/endurance e uma observação em cada treino — esses textos
            são opcionais e ficam visíveis só para você.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Registros de acesso e de lembretes</h2>
          <p className="mt-1.5">
            A cada vez que você entra, registramos, junto da sua sessão, o endereço IP e o navegador/dispositivo
            (user agent) usados — informação de segurança exigida para manter sua conta conectada. Esses registros de
            sessão são mantidos por até 90 dias após a última atividade e removidos depois disso. Quando você toca em um lembrete (notificação ou link do e-mail), registramos
            esse toque para não repetir lembretes e para saber se vale a pena continuar enviando.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Base legal</h2>
          <p className="mt-1.5">
            Tratamos seus dados de cadastro e de treino para executar o aplicativo que você solicitou e para o
            legítimo interesse de operá-lo e mantê-lo seguro (LGPD art. 7º). Os dados de saúde — peso, medidas,
            esforço, dores, sono, estresse e os textos sobre lesões/limitações — recebem proteção especial
            (art. 11). A base legal específica para os dados de saúde — consentimento específico e destacado do
            titular (art. 11, I) ou outra hipótese aplicável — está em revisão jurídica. Enquanto o consentimento
            for a base, você poderá retirá-lo a qualquer momento (ver “Seus direitos”).
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Corpo e check-in: só você vê</h2>
          <p className="mt-1.5">
            Peso, medidas, esforço, dores, sono, dor persistente e estresse são dados de saúde. Só você vê: eles nunca
            aparecem no feed, no seu perfil, em links de compartilhamento ou em imagens de prévia. O mesmo vale para os
            textos de limitações/lesões, de endurance e a observação do treino. Servem apenas para mostrar a você seu
            progresso e quando vale a pena aliviar o treino. Você apaga cada medida quando quiser; o check-in pode ser
            corrigido por 24 horas e é apagado junto com o treino.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Como usamos seus dados</h2>
          <p className="mt-1.5">
            Usamos seus dados para operar a FGPOWER: manter seu perfil, registrar seu histórico de treino, calcular
            sua progressão, mostrar sinais de fadiga e, quando você optar por compartilhar, exibir sua atividade para
            outros usuários conforme as configurações de privacidade que você escolher.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Quem vê seus treinos</h2>
          <p className="mt-1.5">
            Cada treino finalizado aparece para quem você escolheu — Privado, Seguidores ou Público — em Configurações →
            Privacidade, e você muda isso em cada treino, a qualquer momento. Em contas novas o padrão é Seguidores, sem
            as cargas. A legenda que você escreve ao compartilhar um treino fica visível para quem vê aquele treino,
            inclusive na imagem de prévia do link. Com a conta pública, qualquer pessoa — mesmo sem conta — vê seus treinos públicos e pode te
            seguir sem pedir; desligada, você aprova cada seguidor. Nos dois casos, quem abrir o link do seu perfil vê
            seu nome, @usuário, foto, bio e, a menos que você o esconda, o programa atual. Seu perfil só aparece na
            busca e nas sugestões de Descobrir (por nome, @usuário e programa) se você ligar “Permitir que sua conta
            seja descoberta” em Configurações → Privacidade — em contas novas essa opção vem desligada. Quando você dá
            um “FG” no treino de outra pessoa, seu nome e sua foto aparecem para quem abrir a lista de quem deu FG
            naquele treino, mesmo que sua conta não seja pública.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Links de compartilhamento</h2>
          <p className="mt-1.5">
            Ao compartilhar um treino, criamos um link que abre só aquele treino, para quem tiver o link — mesmo sem
            conta e mesmo que o treino não seja público — e uma imagem com o resumo dele (sem as cargas, se você as
            ocultou). Você desativa o link a qualquer momento em “Desativar link”; excluir o treino também o desativa.
            Todo perfil também tem uma imagem de prévia com o que ele mostra: nome, @usuário, foto, bio, seguidores e,
            se estiver visível, o programa atual.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Seguidores, bloqueios e denúncias</h2>
          <p className="mt-1.5">
            Guardamos quem você segue, quem te segue, os pedidos para seguir e as notificações que eles geram. Quem você
            bloqueia deixa de ver seu perfil e seus treinos, e você os dele. Quando alguém denuncia um treino ou um
            perfil, guardamos uma cópia do que foi denunciado para a moderação analisar, mesmo que o conteúdo seja
            apagado depois.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Lembretes e e-mails</h2>
          <p className="mt-1.5">
            Com a sua permissão, enviamos lembretes nos seus dias de treino (notificações do navegador ou do app
            instalado) e um resumo semanal por e-mail — no máximo 1 por dia e 3 por semana. Você desativa em
            Configurações → Lembretes ou pelo link em cada e-mail. Os e-mails são enviados pela Resend (EUA) e as
            notificações passam pelos serviços de push do seu navegador (Google, Apple, Mozilla ou Microsoft). Para
            respeitar esses limites, registramos cada lembrete — quando saiu e o texto da notificação ou o assunto do
            e-mail — por 180 dias, e cada e-mail enviado, com o assunto e sem o corpo da mensagem, por 30 dias. O código
            de acesso por e-mail vale 10 minutos e não é guardado em texto aberto.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Quem processa seus dados</h2>
          <p className="mt-1.5">
            Para operar a FGPOWER, usamos prestadores de serviço que tratam seus dados em nosso nome, fora do Brasil.
            A base legal da transferência internacional (p. ex. cláusulas contratuais ou outras garantias adequadas,
            LGPD art. 33) está em revisão jurídica. São eles:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Railway</strong> (hospedagem e banco de dados) — Estados Unidos ou União Europeia ou Singapura
              (sem região no Brasil). Armazena todos os seus dados, inclusive os de saúde.
            </li>
            <li><strong>Google</strong> (login com conta Google) — Estados Unidos. Autenticação e sua foto de perfil.</li>
            <li><strong>Resend</strong> (envio de e-mails) — Estados Unidos. Códigos de acesso, lembretes e resumos.</li>
            <li>
              <strong>Serviços de push do navegador</strong> (Google, Apple, Mozilla, Microsoft) — Estados Unidos e
              outros. Entrega das notificações.
            </li>
          </ul>
          <p className="mt-2">
            Observação: quando alguém abre um perfil público, a foto do perfil vinda do Google é carregada direto dos
            servidores do Google, o que envia o endereço IP de quem visita ao Google.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">O que nunca fica público por padrão</h2>
          <p className="mt-1.5">
            Seu e-mail nunca é exibido publicamente. Cargas de treino ficam ocultas mesmo em treinos públicos, a menos
            que você ative essa opção nas configurações. Medidas corporais e check-ins nunca são públicos.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Não vendemos seus dados</h2>
          <p className="mt-1.5">
            A FGPOWER não vende nem aluga seus dados pessoais ou de treino a terceiros.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Idade mínima e menores</h2>
          <p className="mt-1.5">
            {MINIMUM_AGE
              ? `A FGPOWER não é destinada a menores de ${MINIMUM_AGE}. `
              : "A idade mínima para usar a FGPOWER está sendo definida nesta revisão da política. "}
            O tratamento de dados de crianças e adolescentes observa o art. 14 da LGPD (melhor interesse; consentimento
            de um dos pais ou responsável para menores de 12 anos).
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Por quanto tempo guardamos</h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            <li>Conta, perfil, treinos, medidas e check-ins: enquanto sua conta existir.</li>
            <li>Registros de sessão (IP e dispositivo): até 90 dias após a última atividade.</li>
            <li>Registro de lembretes enviados: 180 dias. Registro de e-mails enviados: 30 dias.</li>
            <li>Código de acesso por e-mail: 10 minutos.</li>
            <li>Cópia de conteúdo denunciado: mantida para a moderação mesmo após a exclusão do original.</li>
            <li>
              Dados de saúde e prazo após inatividade/exclusão:{" "}
              {HEALTH_DATA_RETENTION || "em definição nesta revisão da política"}.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="font-semibold">Seus direitos</h2>
          <p className="mt-1.5">
            Pela LGPD (art. 18), você pode pedir, a qualquer momento: confirmação de que tratamos seus dados; acesso
            aos dados; correção de dados incompletos, inexatos ou desatualizados; anonimização, bloqueio ou eliminação
            de dados desnecessários ou tratados fora da lei; portabilidade; eliminação dos dados tratados com base em
            consentimento; informação sobre com quem compartilhamos seus dados; informação sobre a possibilidade de não
            consentir e as consequências; e a revogação do consentimento.
          </p>
          <p className="mt-1.5">
            Você mesmo já faz muito disso no app: em Configurações você exporta seus dados — histórico de treino,
            medidas, check-ins, links de compartilhamento e lembretes (os registros de sessão, com IP e dispositivo,
            agora também entram nessa exportação) — e exclui sua conta e todos os dados associados, de forma permanente.
            Para os demais direitos, ou se não conseguir fazer algo sozinho, use{" "}
            <a href="/privacidade/solicitar" className="underline">Solicitar meus dados</a>. Enquanto o consentimento
            for a base de algum tratamento, você pode retirá-lo; isso interrompe aquele tratamento e pode exigir a
            exclusão dos dados correspondentes.
          </p>
          <p className="mt-1.5">
            Você também pode peticionar à Autoridade Nacional de Proteção de Dados (ANPD) a respeito dos seus dados
            (art. 18, §1º).
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Mudanças nesta política</h2>
          <p className="mt-1.5">
            Esta é a versão {POLICY_DISPLAY_VERSION}. Quando houver mudanças relevantes, avisamos no aplicativo e, quando
            o tratamento se apoiar em consentimento, pedimos seu consentimento novamente. Usuários já cadastrados são
            notificados desta atualização.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Não somos um serviço médico</h2>
          <p className="mt-1.5">
            A FGPOWER fornece orientação de treinamento baseada em evidência, não diagnóstico ou tratamento médico.
            Consulte um profissional de saúde para questões médicas, lesões ou condições pré-existentes.
          </p>
        </section>
      </div>
    </div>
    </MarketingShell>
  );
}
