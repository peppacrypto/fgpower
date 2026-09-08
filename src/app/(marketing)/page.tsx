import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PILLARS = [
  {
    title: "Programação",
    description:
      "Monte seu próprio programa a partir de uma biblioteca completa de exercícios, ou comece com um plano pronto e baseado em evidência.",
  },
  {
    title: "Execução",
    description:
      "Saiba exatamente como executar cada exercício, com dicas de técnica, erros comuns e a ciência por trás de cada escolha.",
  },
  {
    title: "Progressão",
    description:
      "Todo treino fica registrado: séries, repetições, carga e RIR. A FGPOWER mostra sua evolução automaticamente.",
  },
  {
    title: "Comunidade",
    description:
      "Compartilhe treinos, siga outros atletas e receba FGs — o reconhecimento nativo da FGPOWER para treino de verdade.",
  },
];

const FEATURES = [
  {
    title: "Biblioteca de exercícios",
    description: "Centenas de exercícios com músculos trabalhados, equipamento, técnica e alternativas.",
  },
  {
    title: "Modo de execução",
    description: "Tela pensada para o treino: uma mão, letras grandes, cronômetro de descanso automático.",
  },
  {
    title: "Base científica",
    description: "Cada princípio de treino cita a evidência real por trás — sem promessas vazias.",
  },
  {
    title: "Histórico permanente",
    description: "Cada série fica guardada. Veja exatamente o que você fez em qualquer treino passado.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Wordmark />
          <nav className="hidden items-center gap-8 text-sm text-muted sm:flex">
            <Link href="/library" className="hover:text-foreground">
              Programas
            </Link>
            <Link href="/exercises" className="hover:text-foreground">
              Exercícios
            </Link>
            <Link href="/science" className="hover:text-foreground">
              Ciência
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/login">Começar</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
          <Badge variant="accent" className="mb-6">
            Musculação orientada por ciência
          </Badge>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Treine com um motivo.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Programas construídos em torno de progressão, execução correta e evidência científica real —
            não achismo de academia.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link href="/login">Começar a treinar</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/library">Explorar programas</Link>
            </Button>
          </div>
        </section>

        <section className="border-t border-border bg-surface/40 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PILLARS.map((p) => (
                <Card key={p.title} className="h-full">
                  <CardContent className="flex h-full flex-col gap-2 pt-5">
                    <h2 className="text-sm font-semibold text-accent">{p.title}</h2>
                    <p className="text-sm text-muted">{p.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Tudo o que você precisa para treinar sério.
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex flex-col gap-2 border-t border-border pt-4">
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border py-20">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Pronto para começar?</h2>
            <p className="max-w-lg text-muted">
              Entre com sua conta Google e monte seu perfil de treino em menos de um minuto.
            </p>
            <Button size="lg" asChild>
              <Link href="/login">Continuar com Google</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Wordmark iconSize={22} />
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacidade
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Termos
            </Link>
            <Link href="/science" className="hover:text-foreground">
              Metodologia científica
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
