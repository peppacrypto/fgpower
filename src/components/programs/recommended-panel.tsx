import Link from "next/link";
import { Play } from "lucide-react";
import { GArrow, GCheck } from "@/components/ui/glyph";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineActionForm } from "@/components/workout/inline-action-form";
import { startTemplateAndBegin } from "@/lib/actions/programs";
import { FAT_LOSS_NOTE } from "@/lib/constants/program-labels";
import type { ReasonChip } from "@/lib/programming/recommend";
import { splitSeriesTagline } from "@/lib/programming/gd-series";
import { cn } from "@/lib/utils/cn";

export interface RecommendedPick {
  slug: string;
  namePt: string;
  taglinePt: string;
  reasons: ReasonChip[];
}

/**
 * "RECOMENDADO PARA VOCÊ": the best-fitting ready-made program for the
 * user's onboarding answers, why it fits (mono chips), and two alternates.
 * "Ativar e começar" activates it and opens its first workout in one tap —
 * so it is only shown while no program is running (Today's empty state, the
 * top of the program library).
 */
export function RecommendedPanel({
  picks,
  fatLoss = false,
  showLinks = false,
  secondary = false,
  className,
}: {
  /** Best first; the first is the pick, the next two the alternates. */
  picks: RecommendedPick[];
  /** The user's goal is losing fat: say the honest line. */
  fatLoss?: boolean;
  /** Links to the whole library and to building from scratch (Today). */
  showLinks?: boolean;
  /** Under another primary action ("Retomar da semana N"): its CTA is an outline, so the page has one lime button. */
  secondary?: boolean;
  className?: string;
}) {
  const [pick, ...rest] = picks;
  if (!pick) return null;
  const alternates = rest.slice(0, 2);
  const href = (slug: string) => `/app/programs/templates/${slug}`;

  return (
    <section
      aria-labelledby="recommended-title"
      data-testid="recommended-panel"
      className={cn("relative overflow-hidden panel-raised", className)}
    >
      <span className="absolute left-0 top-0 h-full w-1.5 bg-accent" aria-hidden />
      <div className="p-6 sm:p-8">
        <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
          Recomendado para você
        </span>
        <h2 id="recommended-title" className="text-display mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">
          {pick.namePt}
        </h2>
        <PickTagline tagline={pick.taglinePt} />
        <Reasons reasons={pick.reasons} className="mt-3" />
        {fatLoss ? (
          <p className="mt-3 border-l-2 border-l-accent pl-2.5 text-xs leading-snug text-foreground/85">
            {FAT_LOSS_NOTE}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
          <InlineActionForm
            action={startTemplateAndBegin.bind(null, pick.slug)}
            failText="Não foi possível ativar. Tente de novo."
            className="flex flex-col"
            errorClassName="mt-1.5"
          >
            <SubmitButton
              size="lg"
              variant={secondary ? "outline" : "strong"}
              className="w-full sm:w-auto"
              pendingLabel="Preparando o treino…"
            >
              <Play className="size-4" />
              Ativar e começar
            </SubmitButton>
          </InlineActionForm>
          <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
            <Link href={href(pick.slug)}>Ver programa</Link>
          </Button>
        </div>

        {alternates.length > 0 ? (
          <div className="mt-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Outras opções</span>
            <ul className="mt-1.5 flex flex-col border-b border-border">
              {alternates.map((alt) => (
                <li key={alt.slug} className="border-t border-border">
                  <Link href={href(alt.slug)} className="group flex items-center gap-3 py-2.5">
                    {/* Names like "Halteres em Casa — Base Full-Body para Iniciantes" get two
                        lines and the facts wrap: at 320px a single truncated line left ~18 characters. */}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-accent">
                        {alt.namePt}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] uppercase leading-snug tracking-[0.08em] text-muted">
                        {/* Wraps between facts, never inside one ("HALTERES EM / CASA"). */}
                        {alt.reasons.map((r) => r.label.replace(/ /g, "\u00a0")).join("\u00a0· ")}
                      </span>
                    </span>
                    <GArrow className="size-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {showLinks ? (
          <div className="mt-4 flex flex-wrap gap-x-5">
            <Link
              href="/app/programs"
              className="inline-flex min-h-10 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
            >
              Ver todos os programas
              <GArrow className="size-3" />
            </Link>
            <Link
              href="/app/programs/new"
              className="inline-flex min-h-10 items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted hover:text-foreground"
            >
              Criar do zero
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** "✓ 3×/SEMANA · ✓ INICIANTE · …" — ticked where the program matches what the user said. */
export function Reasons({ reasons, className }: { reasons: ReasonChip[]; className?: string }) {
  return (
    <ul aria-label="Por que este programa" className={cn("flex flex-wrap gap-1", className)}>
      {reasons.map((r) => (
        <li
          key={r.label}
          className={cn(
            "inline-flex h-6 items-center gap-1 bg-surface px-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em]",
            r.match ? "text-foreground" : "text-muted",
          )}
        >
          {r.match ? <GCheck className="size-3 text-accent" aria-hidden /> : null}
          {r.label}
          {/* The tick is decorative: say it for screen readers too. */}
          <span className="sr-only">{r.match ? " (confere com o seu perfil)" : " (diferente do seu perfil)"}</span>
        </li>
      ))}
    </ul>
  );
}

/** The pick's tagline, led by its outcome (a GD block's place in the series goes to a mono line). */
function PickTagline({ tagline }: { tagline: string }) {
  const { outcome, meta } = splitSeriesTagline(tagline);
  return (
    <>
      {meta ? <p className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{meta}</p> : null}
      <p className="mt-1.5 line-clamp-3 text-sm text-muted wrap-break-word">{outcome}</p>
    </>
  );
}
