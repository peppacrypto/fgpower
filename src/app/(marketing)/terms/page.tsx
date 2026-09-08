import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Termos de Uso</h1>
      <p className="mt-2 text-sm text-muted">Última atualização: setembro de 2026</p>

      <div className="mt-8 flex flex-col gap-6 text-sm text-foreground/90">
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
          <p className="mt-1.5">Podemos atualizar estes termos. Mudanças significativas serão comunicadas no aplicativo.</p>
        </section>
      </div>
    </div>
  );
}
