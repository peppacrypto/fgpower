import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = { title: "Privacidade" };

/** Static: no request data, so it's prerendered (like /terms). */
export default function PrivacyPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted">Última atualização: setembro de 2026</p>

      <div className="mt-8 flex flex-col gap-6 text-sm text-foreground/90">
        <section>
          <h2 className="font-semibold">O que coletamos</h2>
          <p className="mt-1.5">
            Ao entrar com sua conta Google, coletamos seu nome, e-mail e foto de perfil; ao entrar por e-mail, apenas o
            endereço. Você fornece voluntariamente dados de treino: objetivo, experiência, programas, séries,
            repetições, carga, RIR e, se você optar por informar, medidas corporais (peso e circunferências) e um
            check-in depois do treino (esforço, dores, sono e estresse).
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
          <h2 className="font-semibold">Corpo e check-in: só você vê</h2>
          <p className="mt-1.5">
            Peso, medidas, esforço, dores, sono e estresse são dados de saúde. Só você vê: eles nunca aparecem no feed,
            no seu perfil, em links de compartilhamento ou em imagens de prévia. Servem apenas para mostrar a você seu
            progresso e quando vale a pena aliviar o treino. Você apaga cada medida quando quiser; o check-in pode ser
            corrigido por 24 horas e é apagado junto com o treino.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Quem vê seus treinos</h2>
          <p className="mt-1.5">
            Cada treino finalizado aparece para quem você escolheu — Privado, Seguidores ou Público — em Configurações →
            Privacidade, e você muda isso em cada treino, a qualquer momento. Em contas novas o padrão é Seguidores, sem
            as cargas. Com a conta pública, qualquer pessoa — mesmo sem conta — vê seus treinos públicos e pode te
            seguir sem pedir; desligada, você aprova cada seguidor. Nos dois casos, quem abrir o link do seu perfil vê
            seu nome, @usuário, foto, bio e, a menos que você o esconda, o programa atual. Seu perfil também aparece na
            busca e nas sugestões de Descobrir (por nome, @usuário e programa) enquanto “Permitir que sua conta seja
            descoberta” estiver ligado — e ele vem ligado; você desliga em Configurações → Privacidade.
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
          <h2 className="font-semibold">Seus direitos</h2>
          <p className="mt-1.5">
            Você pode exportar todos os seus dados a qualquer momento em Configurações — histórico de treino, medidas,
            check-ins, links de compartilhamento e lembretes — e pode excluir sua conta e todos os dados associados
            permanentemente, também em Configurações.
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
