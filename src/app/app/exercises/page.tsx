import type { Metadata } from "next";
import Link from "next/link";
import {
  countUnclassifiedPatterns,
  listActiveProgramExerciseIds,
  listExercises,
  listFavoriteExerciseIds,
} from "@/lib/data/exercises";
import { listEquipment, listMovementPatterns } from "@/lib/data/taxonomy";
import { requireUser } from "@/lib/auth/require-user";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABEL } from "@/lib/constants/muscle-groups";
import { ExerciseFilterBar } from "@/components/exercises/exercise-filter-bar";
import { ExerciseCard } from "@/components/exercises/exercise-card";
import { hasLibraryFilters, libraryHref, parseLibraryParams } from "@/components/exercises/library-params";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Masthead } from "@/components/ui/masthead";
import { GLoad } from "@/components/ui/glyph";

export const metadata: Metadata = { title: "Exercícios" };

const BASE = "/app/exercises";

export default async function ExerciseLibraryPage({ searchParams }: PageProps<"/app/exercises">) {
  const [sp, user] = await Promise.all([searchParams, requireUser()]);
  const state = parseLibraryParams(sp);

  // "Do meu programa" / "Favoritos" narrow the list to those ids — all in one round.
  // (Favorites are read only when that list is picked; the program's ids also decide whether its chip shows.)
  const programIds = listActiveProgramExerciseIds(user.id);
  const onlyIds =
    state.lista === "programa" ? programIds : state.lista === "favoritos" ? listFavoriteExerciseIds(user.id) : null;
  const [{ items, total, page, totalPages }, equipment, movementPatterns, unclassified, inProgram] = await Promise.all([
    (onlyIds ?? Promise.resolve(undefined)).then((ids) =>
      listExercises({
        q: state.q,
        muscleGroup: state.muscleGroup,
        equipmentId: state.equipmentId,
        movementPatternId: state.movementPatternId,
        difficulty: state.difficulty,
        onlyIds: ids,
        page: state.page,
      }),
    ),
    listEquipment(),
    listMovementPatterns(),
    countUnclassifiedPatterns(),
    programIds,
  ]);

  const muscleGroups = MUSCLE_GROUPS.map((group) => ({ group, namePt: MUSCLE_GROUP_LABEL[group].pt }));
  const filtered = hasLibraryFilters(state);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Masthead
        kicker="Técnica e ciência"
        title="Exercícios"
        lead="Como executar, por que executar, e a ciência por trás."
        action={
          // The principles behind every exercise's "por quê" (W-050).
          <Link
            href="/app/science"
            className="inline-flex min-h-11 items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent hover:underline"
          >
            Ciência <span aria-hidden>↗</span>
          </Link>
        }
      />

      <div className="mt-6">
        <ExerciseFilterBar
          muscleGroups={muscleGroups}
          equipment={equipment}
          movementPatterns={movementPatterns}
          total={total}
          lists={{ program: inProgram.length > 0 }}
          unclassifiedPatterns={unclassified}
        >
          {items.length === 0 ? (
            <div className="mt-6">
              {state.lista === "favoritos" && !state.q && !state.muscleGroup && !state.equipmentId ? (
                <EmptyState
                  icon={<GLoad className="size-8" />}
                  title="Nenhum favorito ainda"
                  description="Toque no coração na página de um exercício para guardá-lo aqui."
                  action={<ClearFilters />}
                />
              ) : (
                <EmptyState
                  icon={<GLoad className="size-8" />}
                  title="Nenhum exercício encontrado"
                  description={
                    state.q
                      ? `Nada para “${state.q}”${filtered && hasLibraryFilters({ ...state, q: "" }) ? " com esses filtros" : ""}. Tente outra palavra — o nome, o músculo ou o equipamento.`
                      : "Nenhum exercício com esses filtros."
                  }
                  action={filtered ? <ClearFilters /> : undefined}
                />
              )}
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
  );
}

function ClearFilters() {
  return (
    <Button variant="outline" size="sm" asChild className="mt-1">
      <Link href={BASE}>Limpar filtros</Link>
    </Button>
  );
}
