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
 * A principle's references. Each keeps its title, authors and "Ver fonte";
 * the summary is the Portuguese one when it exists. Until it does, the
 * English abstract (EvidenceSource.abstractSummary is written in English,
 * faithful to the paper) waits folded under "Resumo original (inglês)"
 * instead of switching a Portuguese page to dense English mid-read.
 */
export function EvidenceReferences({ items, className }: { items: EvidenceItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <section className={className} aria-labelledby="referencias">
      <SectionHead id="referencias" label="Referências" count={plural(items.length, "fonte", "fontes")} />
      <ol className="mt-4 flex flex-col gap-2">
        {items.map(({ sourceId, source }) => (
          <li key={sourceId} className="reg-frame p-3.5 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p lang="en" className="font-semibold [overflow-wrap:anywhere]">
                  {source.title}
                </p>
                <p className="mt-0.5 text-xs text-muted [overflow-wrap:anywhere]">
                  {source.authors} · {source.journal} · {source.publicationYear}
                </p>
              </div>
              <Badge variant="accent" className="shrink-0" title={EVIDENCE_LEVEL_LABEL[source.evidenceLevel]}>
                Nível {source.evidenceLevel}
              </Badge>
            </div>
            {source.summaryPt ? (
              <p className="mt-2 text-xs text-foreground/85">{source.summaryPt}</p>
            ) : source.abstractSummary ? (
              <details className="group mt-1">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <ChevronDown aria-hidden className="size-3.5 transition-transform group-open:rotate-180" />
                  Resumo original (inglês)
                </summary>
                <p lang="en" className="pb-1 text-xs text-muted">
                  {source.abstractSummary}
                </p>
              </details>
            ) : null}
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="-mb-2 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-accent underline decoration-[color-mix(in_oklab,var(--accent)_35%,transparent)] underline-offset-[3px] hover:decoration-accent"
            >
              Ver fonte <ExternalLink aria-hidden className="size-3" />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          </li>
        ))}
      </ol>
      <ul className="mt-4 flex flex-col gap-0.5 text-[11px] text-muted">
        {Object.entries(EVIDENCE_LEVEL_LABEL).map(([level, label]) => (
          <li key={level}>{label}</li>
        ))}
      </ul>
    </section>
  );
}
