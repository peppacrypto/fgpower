import { ChevronDown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionHead } from "@/components/ui/section-head";
import { plural } from "@/lib/utils/format";

export const EVIDENCE_LEVEL_LABEL: Record<string, string> = {
  A: "A — Diretrizes / evidência sistemática forte",
  B: "B — Múltiplos estudos controlados",
  C: "C — Biomecânica ou evidência direta limitada",
  D: "D — Consenso de especialistas",
};

export interface EvidenceItem {
  sourceId: string;
  source: {
    title: string;
    authors: string;
    journal: string;
    publicationYear: number;
    url: string;
    evidenceLevel: string;
    abstractSummary: string;
    summaryPt: string | null;
  };
}

/**
 * A source's evidence level, said in words next to its letter ("Nível B ·
 * Múltiplos estudos controlados"), so the weight of a claim reads on the
 * reference itself, not only in the legend.
 */
export function EvidenceLevel({ level }: { level: string }) {
  const meaning = EVIDENCE_LEVEL_LABEL[level]?.split(" — ")[1];
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
      <Badge variant="accent" className="tabular-nums">
        Nível {level}
      </Badge>
      {meaning ? <span>{meaning}</span> : null}
    </p>
  );
}

/** The scale the levels come from, A (strongest) to D. */
export function EvidenceLegend({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-[13px] font-medium text-muted">Níveis de evidência</p>
      <ul className="mt-1 flex flex-col gap-0.5 text-xs leading-relaxed text-muted">
        {Object.entries(EVIDENCE_LEVEL_LABEL).map(([level, label]) => (
          <li key={level}>{label}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A principle's references. Each keeps its title, authors, evidence level and
 * "Ver fonte"; the summary is the Portuguese one when it exists. Until it
 * does, the English abstract (EvidenceSource.abstractSummary is written in
 * English, faithful to the paper) waits folded under "Resumo original
 * (inglês)" instead of switching a Portuguese page to dense English mid-read.
 */
export function EvidenceReferences({ items, className }: { items: EvidenceItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <section className={className} aria-labelledby="referencias">
      <SectionHead id="referencias" label="Referências" count={plural(items.length, "fonte", "fontes")} />
      <ol className="mt-4 flex flex-col gap-3">
        {items.map(({ sourceId, source }) => (
          <li key={sourceId} className="card p-4 sm:p-5">
            <p lang="en" className="text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]">
              {source.title}
            </p>
            <p className="mt-1 text-[13px] text-muted [overflow-wrap:anywhere]">
              {source.authors} · {source.journal} · <span className="tabular-nums">{source.publicationYear}</span>
            </p>
            <div className="mt-2.5">
              <EvidenceLevel level={source.evidenceLevel} />
            </div>
            {source.summaryPt ? (
              <p className="mt-3 text-sm leading-relaxed text-foreground">{source.summaryPt}</p>
            ) : source.abstractSummary ? (
              <details className="group mt-1">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
                  Resumo original (inglês)
                </summary>
                <p lang="en" className="pb-1 text-[13px] leading-relaxed text-muted">
                  {source.abstractSummary}
                </p>
              </details>
            ) : null}
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="-mb-2 inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-accent underline decoration-[color-mix(in_oklab,var(--accent)_35%,transparent)] underline-offset-[3px] hover:decoration-accent"
            >
              Ver fonte <ExternalLink aria-hidden className="size-3.5" />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          </li>
        ))}
      </ol>
      <EvidenceLegend className="mt-5" />
    </section>
  );
}
