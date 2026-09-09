import Link from "next/link";
import Image from "next/image";
import { GArrow, GProgram, GExecution, GProgress, GCohort } from "@/components/ui/glyph";
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
    n: "01",
    glyph: GProgram,
    title: "Programação",
    description:
      "Monte seu próprio programa a partir de uma biblioteca completa de exercícios, ou comece com um plano pronto e baseado em evidência.",
  },
  {
    n: "02",
    glyph: GExecution,
    title: "Execução",
    description:
      "Saiba exatamente como executar cada exercício, com dicas de técnica, erros comuns e a ciência por trás de cada escolha.",
  },
  {
    n: "03",
    glyph: GProgress,
    title: "Progressão",
    description:
      "Todo treino fica registrado: séries, repetições, carga e RIR. A FGPOWER mostra sua evolução automaticamente.",
  },
  {
    n: "04",
    glyph: GCohort,
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
              <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-accent-strong">
                <span className="inline-block size-1.5 bg-accent-strong" aria-hidden />
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
                    <GArrow className="size-4" />
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
                  className="flex h-full flex-col gap-3 border-t-2 border-t-white/70 bg-white/[0.02] p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-bold tabular-nums text-white/25">{p.n}</span>
                    <p.glyph className="size-5 text-accent-strong" />
                  </div>
                  <h2 className="font-semibold text-white">{p.title}</h2>
                  <p className="text-sm text-white/55">{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MANIFESTO BANNER — full art, never cropped. On mobile a crisp hairline-framed
            band (not a strip dissolving into black); on larger screens the edges blend. */}
        <section className="relative border-y border-white/10">
          <Image
            src="/brand/fg-banner-evolucao.webp"
            alt="Evolução é um hábito — força, disciplina, evolução, liberdade"
            width={1920}
            height={641}
            className="h-auto w-full select-none"
            sizes="100vw"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-24 bg-gradient-to-b from-[#0a0a0b] to-transparent sm:block" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-24 bg-gradient-to-t from-[#0a0a0b] to-transparent sm:block" />
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
                <GArrow className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* CTA — text and athlete read as one grounded unit: on mobile the copy
            sits on top and the figure "stands" flush on the section's base line;
            on desktop they sit side by side, bottom-aligned. */}
        <section className="relative overflow-hidden border-t border-white/10 bg-white/[0.02]">
          <div className="pointer-events-none absolute bottom-0 left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-accent-strong/12 blur-[110px] lg:left-[14%] lg:translate-x-0" />
          <div className="relative mx-auto flex max-w-6xl flex-col px-4 pt-14 sm:px-6 lg:grid lg:grid-cols-[0.8fr_1fr] lg:items-end lg:gap-10 lg:pt-20">
            {/* Copy */}
            <div className="order-1 flex flex-col items-center text-center lg:order-2 lg:items-start lg:pb-24 lg:text-left">
              <h2 className="text-display max-w-md text-3xl font-bold sm:text-5xl">Pronto para começar?</h2>
              <p className="mt-5 max-w-md text-white/55">
                Entre com sua conta Google e monte seu perfil de treino em menos de um minuto.
              </p>
              <Button size="lg" variant="strong" className="mt-8" asChild>
                <Link href="/login">
                  Continuar com Google
                  <GArrow className="size-4" />
                </Link>
              </Button>
            </div>

            {/* Athlete — full figure, never cropped; stands flush on the section base */}
            <div className="order-2 mt-8 flex justify-center lg:order-1 lg:mt-0 lg:justify-start">
              <Image
                src="/brand/fg-athlete.webp"
                alt="Atleta FGPOWER"
                width={1000}
                height={1000}
                className="h-auto w-full max-w-[260px] select-none object-contain object-bottom drop-shadow-2xl sm:max-w-xs lg:max-w-sm"
                sizes="(max-width: 1024px) 260px, 384px"
              />
            </div>
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
