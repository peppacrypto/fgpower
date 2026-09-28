import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GLoad } from "@/components/ui/glyph";
import { getCurrentSession } from "@/lib/auth/require-user";
import { countUnclassifiedPatterns, listExercises } from "@/lib/data/exercises";
import { listEquipment, listMovementPatterns } from "@/lib/data/taxonomy";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABEL } from "@/lib/constants/muscle-groups";
import { ExerciseFilterBar } from "@/components/exercises/exercise-filter-bar";
import { ExerciseCard } from "@/components/exercises/exercise-card";
import { hasLibraryFilters, libraryHref, parseLibraryParams } from "@/components/exercises/library-params";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Exercícios" };

const BASE = "/exercises";

export default async function PublicExerciseLibraryPage({ searchParams }: PageProps<"/exercises">) {
  const [session, sp] = await Promise.all([getCurrentSession(), searchParams]);
  if (session) redirect("/app/exercises");

  const state = parseLibraryParams(sp);
  const [{ items, total, page, totalPages }, equipment, movementPatterns, unclassified] = await Promise.all([
    listExercises({
      q: state.q,
      muscleGroup: state.muscleGroup,
      equipmentId: state.equipmentId,
      movementPatternId: state.movementPatternId,
      difficulty: state.difficulty,
      page: state.page,
    }),
    listEquipment(),
    listMovementPatterns(),
    countUnclassifiedPatterns(),
  ]);

  const muscleGroups = MUSCLE_GROUPS.map((group) => ({ group, namePt: MUSCLE_GROUP_LABEL[group].pt }));
  // Signed out there are no lists: drop a stray ?lista= so "Limpar filtros" isn't offered for nothing.
  const filtered = hasLibraryFilters({ ...state, lista: "" });

  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Biblioteca</p>
        <h1 className="text-display mt-2 text-4xl font-semibold">Exercícios</h1>
        <p className="mt-3 max-w-lg text-muted">Como executar, por que executar, e a ciência por trás.</p>

        <div className="mt-8">
          <ExerciseFilterBar
            muscleGroups={muscleGroups}
            equipment={equipment}
            movementPatterns={movementPatterns}
            total={total}
            unclassifiedPatterns={unclassified}
          >
            {items.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  icon={<GLoad className="size-8" />}
                  title="Nenhum exercício encontrado"
                  description={
                    state.q
                      ? `Nada para “${state.q}”. Tente outra palavra — o nome, o músculo ou o equipamento.`
                      : "Nenhum exercício com esses filtros."
                  }
                  action={
                    filtered ? (
                      <Button variant="outline" size="sm" asChild className="mt-1">
                        <Link href={BASE}>Limpar filtros</Link>
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((ex) => (
                  <ExerciseCard key={ex.id} exercise={ex} href={`${BASE}/${ex.slug}`} />
                ))}
              </div>
            )}

            {totalPages > 1 ? (
              <nav aria-label="Páginas" className="mt-8 flex items-center justify-center gap-2">
                {page > 1 ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={libraryHref(BASE, state, page - 1) as never}>Anterior</Link>
                  </Button>
                ) : null}
                <span className="px-2 font-mono text-[11px] tabular-nums text-muted">
                  Página {page} de {totalPages}
                </span>
                {page < totalPages ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={libraryHref(BASE, state, page + 1) as never}>Próxima</Link>
                  </Button>
                ) : null}
              </nav>
            ) : null}
          </ExerciseFilterBar>
        </div>
      </div>
    </MarketingShell>
  );
}
