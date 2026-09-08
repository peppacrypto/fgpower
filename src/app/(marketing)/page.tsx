import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Dumbbell, LineChart, Microscope, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/logo";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { ExerciseShowcase, type ShowcaseItem } from "@/components/marketing/exercise-showcase";
import { prisma } from "@/lib/db";

// Live counters + a real seeded-program preview mean this page must render
// per-request, not be statically pre-rendered at build time (when the
// database — reachable only over Railway's private network at runtime —
// isn't available yet).
export const dynamic = "force-dynamic";

const HERO_SLUGS = [
  "barbell-squat",
  "barbell-bench-press-medium-grip",
  "barbell-deadlift",
  "wide-grip-lat-pulldown",
  "barbell-hip-thrust",
  "dumbbell-shoulder-press",
];

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

async function getStats() {
  const [exercises, evidence, principles] = await Promise.all([
    prisma.exercise.count({ where: { isPublished: true } }),
    prisma.evidenceSource.count(),
    prisma.trainingPrinciple.count(),
  ]);
  return { exercises, evidence, principles };
}

async function getShowcase(): Promise<ShowcaseItem[]> {
  const rows = await prisma.exercise.findMany({
    where: { slug: { in: HERO_SLUGS } },
    select: {
      slug: true,
      namePt: true,
      media: { where: { kind: "IMAGE_START" }, take: 1 },
      muscles: { where: { role: "PRIMARY" }, take: 1, include: { muscle: { select: { namePt: true } } } },
    },
  });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return HERO_SLUGS.map((slug) => bySlug.get(slug))
    .filter((r): r is NonNullable<typeof r> => Boolean(r?.media[0]))
    .map((r) => ({
      slug: r.slug,
      namePt: r.namePt,
      imageUrl: r.media[0].url,
      muscle: r.muscles[0]?.muscle.namePt ?? null,
    }));
}

export default async function LandingPage() {
  const [stats, showcase] = await Promise.all([getStats(), getShowcase()]);

  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0a0b] text-white">
      <MarketingHeader onDark />

      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-accent-strong/10 blur-[120px]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent-strong">
                Musculação orientada por ciência
              </span>
              <h1 className="text-display mt-6 text-5xl font-extrabold leading-[0.95] sm:text-7xl">
                TREINE COM
                <br />
                UM <span className="text-accent-strong">MOTIVO.</span>
              </h1>
              <p className="mt-6 max-w-md text-lg text-white/60">
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
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="border-white/20 text-white hover:bg-white/10 hover:border-white/30"
                >
                  <Link href="/programs">Explorar programas</Link>
                </Button>
              </div>

              <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6">
                <Stat value={stats.exercises} label="Exercícios" />
                <Stat value={stats.evidence} label="Fontes científicas" />
                <Stat value={stats.principles} label="Princípios" />
              </dl>
            </div>

            <ExerciseShowcase items={showcase} />
          </div>
        </section>

        {/* PILLARS */}
        <section className="border-t border-white/10 bg-white/[0.02] py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PILLARS.map((p) => (
                <div
                  key={p.title}
                  className="flex h-full flex-col gap-3 rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.03] p-6"
                >
                  <div className="flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-accent-strong/15 text-accent-strong">
                    <p.icon className="size-5" />
                  </div>
                  <h2 className="font-semibold text-white">{p.title}</h2>
                  <p className="text-sm text-white/55">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SCIENCE STRIP */}
        <section className="py-24">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-strong">Sem promessas vazias</p>
            <h2 className="text-display mx-auto mt-3 max-w-2xl text-3xl font-bold sm:text-5xl">
              Cada princípio de treino cita a{" "}
              <span className="text-accent-strong">evidência real</span> por trás.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-white/55">
              {stats.evidence} estudos e diretrizes verificados um por um. Volume, RIR, frequência, amplitude —
              nada de achismo, tudo com a fonte ao lado.
            </p>
            <Button variant="outline" className="mt-8 border-white/20 text-white hover:bg-white/10" asChild>
              <Link href="/science">
                Ver a metodologia
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent py-20">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 text-center sm:px-6">
            <Image src="/brand/fgpower-mark.png" alt="" width={72} height={72} className="opacity-90" />
            <h2 className="text-display max-w-md text-3xl font-bold sm:text-5xl">Pronto para começar?</h2>
            <p className="max-w-lg text-white/55">
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
      </main>

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Wordmark iconSize={22} onDark />
          <div className="flex flex-wrap gap-4">
            <Link href="/programs" className="hover:text-white">
              Programas
            </Link>
            <Link href="/exercises" className="hover:text-white">
              Exercícios
            </Link>
            <Link href="/science" className="hover:text-white">
              Ciência
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacidade
            </Link>
            <Link href="/terms" className="hover:text-white">
              Termos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="text-xs text-white/50">{label}</dt>
      <dd className="font-mono text-3xl font-bold tabular-nums text-white">{value}</dd>
    </div>
  );
}
