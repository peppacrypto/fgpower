import Link from "next/link";
import { ArrowRight, Dumbbell, LineChart, Microscope, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { ProductPreview } from "@/components/marketing/product-preview";
import { prisma } from "@/lib/db";

const PILLARS = [
  {
    icon: Dumbbell,
    title: "Programação",
    description:
      "Monte seu próprio programa a partir de uma biblioteca completa de exercícios, ou comece com um plano pronto e baseado em evidência.",
  },
  {
    icon: Microscope,
    title: "Execução",
    description:
      "Saiba exatamente como executar cada exercício, com dicas de técnica, erros comuns e a ciência por trás de cada escolha.",
  },
  {
    icon: LineChart,
    title: "Progressão",
    description:
      "Todo treino fica registrado: séries, repetições, carga e RIR. A FGPOWER mostra sua evolução automaticamente.",
  },
  {
    icon: Users,
    title: "Comunidade",
    description:
      "Compartilhe treinos, siga outros atletas e receba FGs — o reconhecimento nativo da FGPOWER para treino de verdade.",
  },
];

const FEATURES = [
  {
    title: "Biblioteca de exercícios",
    description: "Centenas de exercícios com músculos trabalhados, equipamento, técnica e alternativas.",
    tag: "purple" as const,
  },
  {
    title: "Modo de execução",
    description: "Tela pensada para o treino: uma mão, letras grandes, cronômetro de descanso automático.",
    tag: "orange" as const,
  },
  {
    title: "Base científica",
    description: "Cada princípio de treino cita a evidência real por trás — sem promessas vazias.",
    tag: "blue" as const,
  },
  {
    title: "Histórico permanente",
    description: "Cada série fica guardada. Veja exatamente o que você fez em qualquer treino passado.",
    tag: "pink" as const,
  },
];

async function getStats() {
  const [exercises, evidence, principles] = await Promise.all([
    prisma.exercise.count({ where: { isPublished: true } }),
    prisma.evidenceSource.count(),
    prisma.trainingPrinciple.count(),
  ]);
  return { exercises, evidence, principles };
}

async function getPreviewDay() {
  const day = await prisma.workoutTemplateDay.findFirst({
    where: { template: { slug: "fgpower-adaptation" } },
    orderBy: { dayIndex: "asc" },
    include: { exercises: { orderBy: { sortOrder: "asc" }, include: { exercise: { select: { namePt: true } } } } },
  });
  return day;
}

export default async function LandingPage() {
  const [stats, day] = await Promise.all([getStats(), getPreviewDay()]);

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-8">
          <div>
            <Badge variant="accent" className="mb-6 tracking-wide uppercase text-[11px] font-semibold">
              Musculação orientada por ciência
            </Badge>
            <h1 className="text-display max-w-xl text-5xl font-semibold sm:text-6xl">
              Treine com<br />um motivo.
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted">
              Programas construídos em torno de progressão, execução correta e evidência científica real —
              não achismo de academia.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" variant="strong" asChild>
                <Link href="/login">
                  Começar a treinar
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/programs">Explorar programas</Link>
              </Button>
            </div>

            <dl className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6">
              <div>
                <dt className="text-xs text-muted">Exercícios</dt>
                <dd className="font-mono text-2xl font-semibold tabular-nums">{stats.exercises}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Fontes científicas</dt>
                <dd className="font-mono text-2xl font-semibold tabular-nums">{stats.evidence}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Princípios</dt>
                <dd className="font-mono text-2xl font-semibold tabular-nums">{stats.principles}</dd>
              </div>
            </dl>
          </div>

          <div className="lg:-mr-8">
            <BrowserFrame title="fgpower.monster">
              <ProductPreview
                dayName={day?.namePt ?? "Sessão A"}
                exercises={(day?.exercises ?? []).map((e) => ({
                  namePt: e.exercise.namePt,
                  sets: e.sets,
                  repMin: e.repMin,
                  repMax: e.repMax,
                }))}
              />
            </BrowserFrame>
          </div>
        </section>

        <section className="border-t border-border bg-surface-2/60 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PILLARS.map((p) => (
                <Card key={p.title} className="h-full">
                  <CardContent className="flex h-full flex-col gap-3 pt-6">
                    <div className="flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-accent-soft text-accent">
                      <p.icon className="size-[18px]" />
                    </div>
                    <h2 className="text-sm font-semibold">{p.title}</h2>
                    <p className="text-sm text-muted">{p.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">O que você recebe</p>
            <h2 className="text-display mt-2 max-w-lg text-3xl font-semibold sm:text-4xl">
              Tudo o que você precisa para treinar sério.
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex flex-col gap-3 border-t border-border pt-5">
                  <Badge variant={f.tag} className="w-fit">
                    {f.title}
                  </Badge>
                  <p className="text-sm text-muted">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-surface-2/60 py-20">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 sm:px-6">
            <h2 className="text-display max-w-md text-3xl font-semibold sm:text-4xl">Pronto para começar?</h2>
            <p className="max-w-lg text-muted">
              Entre com sua conta Google e monte seu perfil de treino em menos de um minuto.
            </p>
            <Button size="lg" variant="strong" asChild>
              <Link href="/login">
                Continuar com Google
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
    </>
  );
}
