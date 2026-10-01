import Link from "next/link";
import Image from "next/image";
import { GArrow, GProgram, GExecution, GProgress, GCohort } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/logo";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { ExerciseShowcase, type ShowcaseItem } from "@/components/marketing/exercise-showcase";
import { AccountDeletedNotice } from "@/components/marketing/account-deleted-notice";
import { getCurrentSession } from "@/lib/auth/require-user";
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

/** Real screens of the app (the install dialog's screenshots, manifest.ts), 780×1688. */
const SCREENS = [
  {
    src: "/icons/screenshots/today.png",
    alt: "Tela Hoje: o próximo treino, os exercícios e a semana",
    caption: "Seu treino de hoje",
  },
  {
    src: "/icons/screenshots/workout.png",
    alt: "Tela de treino: carga, repetições, RIR e o descanso contando",
    caption: "Cada série, carga e descanso",
  },
  {
    src: "/icons/screenshots/summary.png",
    alt: "Resumo do treino: tempo, séries e volume, o check-in, quem vê, como compartilhar e os recordes",
    caption: "O resumo, quem vê e os recordes",
  },
] as const;

/** Mono micro-caps under a CTA (decision 12: free, never "para sempre"). */
const FREE_LINE = "font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white/60";

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
  // The validated session (the one the app's pages check), not the bare
  // cookie: a dead cookie must not offer an app that bounces to /login.
  const [stats, showcase, session] = await Promise.all([getStats(), getShowcase(), getCurrentSession()]);
  const signedIn = Boolean(session);

  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0a0b] text-white">
      <MarketingHeader onDark signedIn={signedIn} />
      <AccountDeletedNotice />

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
                  <Link href={signedIn ? "/app/today" : "/login"}>
                    {signedIn ? "Abrir o app" : "Criar conta grátis"}
                    <GArrow className="size-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="border-white/25 bg-white/[0.04] text-white hover:border-white/45 hover:bg-white/10 active:border-white/45 active:bg-white/10"
                >
                  <Link href={signedIn ? "/app/programs" : "/programs"}>Explorar programas</Link>
                </Button>
              </div>
              {signedIn ? null : <p className={`mt-4 ${FREE_LINE}`}>Grátis · sem cartão · pronto em 1 minuto</p>}

              <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-6">
                <Stat value={stats.exercises} label="Exercícios" />
                <Stat value={stats.evidence} label="Fontes científicas" />
                <Stat value={stats.principles} label="Princípios" />
              </dl>
            </div>

            <ExerciseShowcase items={showcase} />
          </div>
        </section>

        {/* THE APP — three real screens: a scroll-snap row on phones (the next
            screen peeks, the page never scrolls sideways), three columns from sm. */}
        <section aria-labelledby="landing-app" className="border-t border-white/10 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-accent-strong">O app</p>
            <h2 id="landing-app" className="text-display mt-3 text-3xl font-bold sm:text-5xl">
              Abra, treine, registre.
            </h2>
            <p className="mt-4 max-w-xl text-white/55">
              O treino do dia pronto, cada série com carga, reps e descanso — e o resumo diz o que subir da próxima vez.
            </p>
            <ol
              tabIndex={0}
              aria-label="Telas do app"
              className="-mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
            >
              {SCREENS.map((screen, i) => (
                <li key={screen.src} className="w-[72vw] max-w-[260px] shrink-0 snap-center sm:w-auto sm:max-w-none">
                  <figure className="reg-frame bg-transparent p-3 [--reg:rgba(255,255,255,.35)]">
                    <div className="rounded-[30px] border border-white/15 bg-black p-2 shadow-2xl">
                      <Image
                        src={screen.src}
                        alt={screen.alt}
                        width={780}
                        height={1688}
                        className="h-auto w-full rounded-[22px]"
                        sizes="(max-width: 640px) 72vw, 260px"
                      />
                    </div>
                    <figcaption className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
                      <span className="text-accent-strong">Fig. {String(i + 1).padStart(2, "0")}</span> — {screen.caption}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ol>
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
                    {/* Decorative numbering (the order is the reading order): hidden from screen readers. */}
                    <span aria-hidden className="font-mono text-2xl font-bold tabular-nums text-white/25">
                      {p.n}
                    </span>
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
            <Button
              variant="outline"
              className="mt-8 border-white/25 bg-white/[0.04] text-white hover:border-white/45 hover:bg-white/10 active:border-white/45 active:bg-white/10"
              asChild
            >
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
              <h2 className="text-display max-w-md text-3xl font-bold sm:text-5xl">
                {signedIn ? "Seu próximo treino está esperando." : "Pronto para começar?"}
              </h2>
              <p className="mt-5 max-w-md text-white/55">
                {signedIn
                  ? "Continue de onde parou."
                  : "Crie sua conta grátis e monte seu perfil de treino em menos de um minuto."}
              </p>
              <Button size="lg" variant="strong" className="mt-8" asChild>
                <Link href={signedIn ? "/app/today" : "/login"}>
                  {signedIn ? "Abrir o app" : "Criar conta grátis"}
                  <GArrow className="size-4" />
                </Link>
              </Button>
              {signedIn ? null : <p className={`mt-4 ${FREE_LINE}`}>Grátis · sem cartão</p>}
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
