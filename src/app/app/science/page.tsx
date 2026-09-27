import type { Metadata } from "next";
import Link from "next/link";
import { GArrow } from "@/components/ui/glyph";
import { prisma } from "@/lib/db";
import { SectionHead } from "@/components/ui/section-head";
import { BEGINNER_PATH, readingOrder } from "@/lib/programming/principle-order";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Ciência" };

export default async function ScienceIndexPage() {
  const principles = readingOrder(await prisma.trainingPrinciple.findMany({ orderBy: { sortOrder: "asc" } }));
  const path = principles.filter((p) => BEGINNER_PATH.includes(p.slug));
  const rest = principles.filter((p) => !BEGINNER_PATH.includes(p.slug));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Por trás dos programas</span>
      <h1 className="text-display mt-1 text-3xl font-extrabold sm:text-4xl">Princípios científicos</h1>
      <p className="mt-2 text-sm text-muted">
        Os conceitos que sustentam a programação da FGPOWER, com as evidências reais por trás de cada um.
      </p>

      {path.length > 0 ? (
        <section className="mt-8">
          <SectionHead label="Comece aqui" count={plural(path.length, "leitura", "leituras")} />
          <p className="mt-1.5 text-xs text-muted">O que você usa em todo treino, na ordem de leitura.</p>
          <ol className="mt-4 flex flex-col gap-2">
            {path.map((p, i) => (
              <li key={p.id}>
                <PrincipleRow href={`/app/science/${p.slug}`} title={p.titlePt} summary={p.summaryPt} step={i + 1} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionHead label="Todos os princípios" count={String(rest.length)} />
        <div className="mt-4 flex flex-col gap-2">
          {rest.map((p) => (
            <PrincipleRow key={p.id} href={`/app/science/${p.slug}`} title={p.titlePt} summary={p.summaryPt} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PrincipleRow({ href, title, summary, step }: { href: string; title: string; summary: string; step?: number }) {
  return (
    <Link href={href} className="reg-frame is-link group flex items-start gap-3 p-4">
      {step ? (
        <span className="w-6 shrink-0 font-mono text-sm font-bold tabular-nums text-accent">
          {String(step).padStart(2, "0")}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold group-hover:text-accent">{title}</span>
        <span className="mt-1 block text-sm text-muted">{summary}</span>
      </span>
      <GArrow className="mt-1 size-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
