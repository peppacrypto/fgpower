import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/require-user";
import { listExercises, type ExerciseFilters } from "@/lib/data/exercises";
import { listEquipment, listMovementPatterns } from "@/lib/data/taxonomy";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABEL } from "@/lib/constants/muscle-groups";
import { ExerciseFilterBar } from "@/components/exercises/exercise-filter-bar";
import { ExerciseCard } from "@/components/exercises/exercise-card";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Exercícios" };

export default async function PublicExerciseLibraryPage({ searchParams }: PageProps<"/exercises">) {
  const session = await getCurrentSession();
  if (session) redirect("/app/exercises");

  const sp = await searchParams;
  const filters: ExerciseFilters = {
    q: typeof sp.q === "string" ? sp.q : undefined,
    muscleGroup: typeof sp.muscleGroup === "string" ? sp.muscleGroup : undefined,
    equipmentId: typeof sp.equipmentId === "string" ? sp.equipmentId : undefined,
    movementPatternId: typeof sp.movementPatternId === "string" ? sp.movementPatternId : undefined,
    page: typeof sp.page === "string" ? Number(sp.page) : 1,
  };

  const [{ items, page, totalPages }, equipment, movementPatterns] = await Promise.all([
    listExercises(filters),
    listEquipment(),
    listMovementPatterns(),
  ]);

  const muscleGroups = MUSCLE_GROUPS.map((group) => ({ group, namePt: MUSCLE_GROUP_LABEL[group].pt }));

  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">Biblioteca</p>
      <h1 className="text-display mt-2 text-4xl font-semibold">Exercícios</h1>
      <p className="mt-3 max-w-lg text-muted">Como executar, por que executar, e a ciência por trás.</p>

      <div className="mt-8">
        <ExerciseFilterBar muscleGroups={muscleGroups} equipment={equipment} movementPatterns={movementPatterns} />
      </div>

      {items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<Dumbbell className="size-8" />}
            title="Nenhum exercício encontrado"
            description="Tente ajustar a busca ou os filtros."
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((ex) => (
            <ExerciseCard key={ex.id} exercise={ex} href={`/exercises/${ex.slug}`} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-8 flex items-center justify-center gap-2">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildPageHref(sp, page - 1)}>Anterior</Link>
            </Button>
          ) : null}
          <span className="px-2 text-sm text-muted">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildPageHref(sp, page + 1)}>Próxima</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
    </MarketingShell>
  );
}

function buildPageHref(sp: Record<string, string | string[] | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string" && key !== "page") params.set(key, value);
  }
  params.set("page", String(page));
  return `/exercises?${params.toString()}`;
}
