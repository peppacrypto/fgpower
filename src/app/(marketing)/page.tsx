import Link from "next/link";
import Image from "next/image";
import { GArrow, GCheck, GProgram, GLoad, GProgress } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { AccountDeletedNotice } from "@/components/marketing/account-deleted-notice";
import { ProtocolCard, type ProtocolCardData } from "@/components/programs/protocol-card";
import { getCurrentSession } from "@/lib/auth/require-user";
import { listTemplates, toCatalogItem } from "@/lib/data/templates";
import { prisma } from "@/lib/db";
import { plural } from "@/lib/utils/format";

// Live counters + real seeded programs mean this page must render
// per-request, not be statically pre-rendered at build time (when the
// database — reachable only over Railway's private network at runtime —
// isn't available yet).
export const dynamic = "force-dynamic";

/** Three programs that show the range: a gym start, a 4-day split, a home plan. */
const FEATURED_SLUGS = ["full-body-beginner", "upper-lower", "home-dumbbells"];

/** Real screens of the app (the install dialog's screenshots, manifest.ts), 780×1688. */
const SCREEN = {
  today: { src: "/icons/screenshots/today.png", alt: "Tela Hoje: o próximo treino, os exercícios e a semana" },
  workout: { src: "/icons/screenshots/workout.png", alt: "Tela de treino: carga, repetições, RIR e o descanso contando" },
  summary: {
    src: "/icons/screenshots/summary.png",
    alt: "Resumo do treino: tempo, séries e volume, o check-in, quem vê, como compartilhar e os recordes",
  },
} as const;

const STEPS = [
  {
    glyph: GProgram,
    title: "Escolha o treino",
    description: "Comece por um programa pronto e baseado em evidência, ou monte o seu com a biblioteca de exercícios.",
  },
  {
    glyph: GLoad,
    title: "Registre cada série",
    description: "Carga, repetições e RIR em campos grandes, com o descanso contando e a técnica a um toque.",
  },
  {
    glyph: GProgress,
    title: "Veja a progressão",
    description: "O resumo mostra volume e recordes, e o próximo treino já sugere o que subir.",
  },
];

const PROGRESSION_POINTS = [
  "A carga da próxima vez sugerida a partir do seu último treino",
  "Recordes, volume e o histórico de cada exercício, série por série",
  "Compartilhe com quem você segue e receba FGs pelo treino feito",
];

/** The free line under a CTA (decision 12: free, never "para sempre"). */
const FREE_LINE = "text-sm text-muted";

async function getStats() {
  const [exercises, evidence, principles] = await Promise.all([
    prisma.exercise.count({ where: { isPublished: true } }),
    prisma.evidenceSource.count(),
    prisma.trainingPrinciple.count(),
  ]);
  return { exercises, evidence, principles };
}

async function getFeatured(): Promise<{ items: ProtocolCardData[]; total: number }> {
  const all = await listTemplates();
  const bySlug = new Map(all.map((t) => [t.slug, t]));
  const picked = FEATURED_SLUGS.map((slug) => bySlug.get(slug)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  const items = picked.map((t) => ({ ...toCatalogItem(t), index: null, href: `/programs/${t.slug}` }));
  return { items, total: all.length };
}

export default async function LandingPage() {
  // The validated session (the one the app's pages check), not the bare
  // cookie: a dead cookie must not offer an app that bounces to /login.
  const [stats, featured, session] = await Promise.all([getStats(), getFeatured(), getCurrentSession()]);
  const signedIn = Boolean(session);
  const startHref = signedIn ? "/app/today" : "/login";
  const startLabel = signedIn ? "Abrir o app" : "Criar conta grátis";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <MarketingHeader signedIn={signedIn} />
      <AccountDeletedNotice />

      <main className="flex-1">
        {/* HERO — one message, one action, and the product itself as the picture. */}
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pt-20 lg:pb-24">
          <div>
            <p className="eyebrow">Musculação orientada por ciência</p>
            <h1 className="text-display mt-3 text-[2.75rem] font-bold leading-[1.04] sm:text-6xl">
              Treine com um motivo.
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted sm:text-lg">
              Escolha um programa, registre cada série e acompanhe sua progressão semana após semana — com a ciência
              por trás de cada escolha.
            </p>
            <div className="mt-8 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap min-[420px]:items-center">
              <Button size="lg" asChild>
                <Link href={startHref}>
                  {startLabel}
                  <GArrow />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href={signedIn ? "/app/programs" : "/programs"}>Explorar programas</Link>
              </Button>
            </div>
            {signedIn ? null : <p className={`mt-4 ${FREE_LINE}`}>Grátis · sem cartão · pronto em 1 minuto</p>}
          </div>

          <HeroComposition />
        </section>

        {/* HOW IT WORKS — three steps, in reading order. */}
        <section aria-labelledby="landing-how" className="border-t border-border bg-surface py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="eyebrow">Como funciona</p>
            <h2 id="landing-how" className="text-display mt-2 text-3xl font-semibold sm:text-4xl">
              Abra, treine, registre.
            </h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-6">
              {STEPS.map((step) => (
                <li key={step.title} className="rounded-[var(--radius-lg)] bg-background p-6">
                  <span className="flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-accent-soft text-accent">
                    <step.glyph className="size-5" />
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FEATURED PROGRAMS — real ones, as the library shows them. */}
        {featured.items.length > 0 ? (
          <section aria-labelledby="landing-programs" className="py-16 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Programas em destaque</p>
                  <h2 id="landing-programs" className="text-display mt-2 text-3xl font-semibold sm:text-4xl">
                    Um plano para cada rotina.
                  </h2>
                  <p className="mt-3 max-w-xl text-muted">
                    Força, hipertrofia, calistenia, mobilidade e yoga — na academia ou em casa, do primeiro treino ao
                    avançado.
                  </p>
                </div>
                <Link
                  href={signedIn ? "/app/programs" : "/programs"}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                >
                  Ver os {plural(featured.total, "programa", "programas")}
                  <GArrow />
                </Link>
              </div>
              <ul className="mt-8 grid gap-4 md:grid-cols-3">
                {featured.items.map((item) => (
                  <li key={item.slug} className="flex">
                    <ProtocolCard data={item} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* PROGRESSION — the summary screen, and what it tells you. */}
        <section aria-labelledby="landing-progress" className="border-y border-border bg-surface py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 md:grid-cols-[1fr_1.1fr] lg:gap-20">
            <PhoneFrame screen={SCREEN.summary} className="mx-auto w-full max-w-[280px] md:order-2" sizes="280px" />
            <div className="md:order-1">
              <p className="eyebrow">Progressão</p>
              <h2 id="landing-progress" className="text-display mt-2 text-3xl font-semibold sm:text-4xl">
                Cada treino diz o que fazer no próximo.
              </h2>
              <p className="mt-4 max-w-lg text-muted">
                Todo treino fica registrado: séries, repetições, carga e RIR. A FGPOWER transforma isso em evolução que
                você enxerga.
              </p>
              <ul className="mt-8 flex flex-col gap-4">
                {PROGRESSION_POINTS.map((point) => (
                  <li key={point} className="flex gap-3 text-[15px] leading-relaxed">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <GCheck className="size-3.5" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* METHODOLOGY — the evidence, with the counts as supporting facts. */}
        <section aria-labelledby="landing-science" className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
              <div>
                <p className="eyebrow">Metodologia</p>
                <h2 id="landing-science" className="text-display mt-2 max-w-xl text-3xl font-semibold sm:text-4xl">
                  Cada princípio de treino cita a evidência por trás.
                </h2>
                <p className="mt-4 max-w-xl text-muted">
                  Volume, RIR, frequência e amplitude explicados com a fonte ao lado — estudos e diretrizes verificados
                  um por um, não achismo de academia.
                </p>
                <Button variant="outline" className="mt-7" asChild>
                  <Link href="/science">
                    Ver a metodologia
                    <GArrow />
                  </Link>
                </Button>
              </div>
              <dl className="grid grid-cols-3 gap-3">
                <Stat value={stats.evidence} label="Fontes científicas" />
                <Stat value={stats.principles} label="Princípios" />
                <Stat value={stats.exercises} label="Exercícios" />
              </dl>
            </div>
          </div>
        </section>

        {/* FINAL INVITATION */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="mx-auto flex max-w-6xl flex-col items-center rounded-[var(--radius-xl)] bg-accent-soft px-6 py-14 text-center sm:py-16">
            <h2 className="text-display max-w-lg text-3xl font-semibold sm:text-4xl">
              {signedIn ? "Seu próximo treino está esperando." : "Pronto para começar?"}
            </h2>
            <p className="mt-4 max-w-md text-muted">
              {signedIn
                ? "Continue de onde parou."
                : "Crie sua conta grátis e monte seu perfil de treino em menos de um minuto."}
            </p>
            <Button size="lg" className="mt-8" asChild>
              <Link href={startHref}>
                {startLabel}
                <GArrow />
              </Link>
            </Button>
            {signedIn ? null : <p className={`mt-4 ${FREE_LINE}`}>Grátis · sem cartão</p>}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

/**
 * The hero's picture: the Today screen in a phone, and a cut of the live
 * workout (a set being logged) laid over its lower corner — the product
 * showing its own benefit. Both are real screenshots.
 */
function HeroComposition() {
  return (
    <div role="group" aria-label="Telas do app" className="relative mx-auto w-full max-w-[440px] pb-6 lg:max-w-none">
      <PhoneFrame
        screen={SCREEN.today}
        className="ml-auto mr-2 w-[66%] max-w-[300px] sm:mr-8 lg:mr-6"
        sizes="(max-width: 640px) 66vw, 300px"
        preload
      />
      <figure className="absolute bottom-0 left-0 w-[58%] max-w-[270px] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-md)]">
        <div className="relative aspect-square">
          <Image
            src={SCREEN.workout.src}
            alt={SCREEN.workout.alt}
            fill
            sizes="(max-width: 640px) 58vw, 270px"
            className="object-cover"
            style={{ objectPosition: "50% 40%" }}
          />
        </div>
        <figcaption className="border-t border-border px-3.5 py-2.5 text-[13px] font-medium">
          Treino em andamento
        </figcaption>
      </figure>
    </div>
  );
}

function PhoneFrame({
  screen,
  className,
  sizes,
  preload = false,
}: {
  screen: { src: string; alt: string };
  className?: string;
  sizes: string;
  preload?: boolean;
}) {
  return (
    <div className={className}>
      <div className="rounded-[2.25rem] border border-border-strong bg-surface p-2 shadow-[var(--shadow-md)]">
        <Image
          src={screen.src}
          alt={screen.alt}
          width={780}
          height={1688}
          sizes={sizes}
          className="h-auto w-full rounded-[1.75rem]"
          preload={preload}
        />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-4">
      <dt className="text-[13px] leading-snug text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{value}</dd>
    </div>
  );
}
