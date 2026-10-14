import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GLoad } from "@/components/ui/glyph";
import { getCurrentSession } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { countUnclassifiedPatterns, listExercises } from "@/lib/data/exercises";
import { listEquipment, listMovementPatterns } from "@/lib/data/taxonomy";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABEL } from "@/lib/constants/muscle-groups";
import { ExerciseFilterBar } from "@/components/exercises/exercise-filter-bar";
import { ExerciseCard } from "@/components/exercises/exercise-card";
import { hasLibraryFilters, libraryHref, parseLibraryParams } from "@/components/exercises/library-params";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Masthead } from "@/components/ui/masthead";

export const metadata: Metadata = { title: "Exercícios" };

const BASE = "/exercises";

export default async function PublicExerciseLibraryPage({ searchParams }: PageProps<"/exercises">) {
  const [session, sp] = await Promise.all([getCurrentSession(), searchParams]);
  if (session) redirect("/app/exercises");

  const state = parseLibraryParams(sp);
  const [{ items, total, page, totalPages }, equipment, movementPatterns, unclassified, catalogTotal] = await Promise.all([
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
    // The whole catalog, counted as the home page counts it.
    prisma.exercise.count({ where: { isPublished: true } }),
  ]);

  const muscleGroups = MUSCLE_GROUPS.map((group) => ({ group, namePt: MUSCLE_GROUP_LABEL[group].pt }));
  // Signed out there are no lists: drop a stray ?lista= so "Limpar filtros" isn't offered for nothing.
  const filtered = hasLibraryFilters({ ...state, lista: "" });

  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <Masthead
          kicker="Técnica e ciência"
          title="Exercícios"
          lead="Como executar, por que executar, e a ciência por trás."
        />

        <div className="mt-8">
          <ExerciseFilterBar
            muscleGroups={muscleGroups}
            equipment={equipment}
            movementPatterns={movementPatterns}
            total={total}
            catalogTotal={catalogTotal}
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
              // A list on a phone (thumbnail, name, muscle, equipment), a grid from sm up.
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((ex) => (
                  <ExerciseCard key={ex.id} exercise={ex} href={`${BASE}/${ex.slug}`} compact />
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
                <span className="px-2 text-[13px] tabular-nums text-muted">
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
