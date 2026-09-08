import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidade" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted">Última atualização: setembro de 2026</p>

      <div className="mt-8 flex flex-col gap-6 text-sm text-foreground/90">
        <section>
          <h2 className="font-semibold">O que coletamos</h2>
          <p className="mt-1.5">
            Ao entrar com sua conta Google, coletamos seu nome, e-mail e foto de perfil. Você fornece
            voluntariamente dados de treino: objetivo, experiência, programas, séries, repetições, carga, RIR e,
            se você optar por informar, medidas corporais.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Como usamos seus dados</h2>
          <p className="mt-1.5">
            Usamos seus dados para operar a FGPOWER: manter seu perfil, registrar seu histórico de treino, calcular
            sua progressão e, quando você optar por compartilhar, exibir sua atividade para outros usuários conforme
            as configurações de privacidade que você escolher.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">O que nunca fica público por padrão</h2>
          <p className="mt-1.5">
            Seu e-mail nunca é exibido publicamente. Cargas de treino e medidas corporais ficam ocultas mesmo em
            treinos públicos, a menos que você ative essas opções explicitamente nas configurações.
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
            Você pode exportar todo o seu histórico de treino a qualquer momento em Configurações, e pode excluir
            sua conta e todos os dados associados permanentemente, também em Configurações.
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
  );
}
