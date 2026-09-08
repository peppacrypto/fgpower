import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { normalizeText } from "@/lib/utils/normalize-text";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Admin · Exercícios" };

export default async function AdminExercisesPage({ searchParams }: PageProps<"/admin/exercises">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const curatedOnly = sp.curated === "1";

  const exercises = await prisma.exercise.findMany({
    where: {
      ...(q ? { searchText: { contains: normalizeText(q) } } : {}),
      ...(curatedOnly ? { isCurated: true } : {}),
    },
    orderBy: { namePt: "asc" },
    take: 100,
    select: { id: true, namePt: true, nameEn: true, isCurated: true, isPublished: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Exercícios</h1>
      <form className="mt-4" action="/admin/exercises">
        <Input name="q" defaultValue={q} placeholder="Buscar exercício…" />
      </form>

      <div className="mt-6 overflow-x-auto rounded-[var(--radius-lg)] border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5">Nome</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {exercises.map((ex) => (
              <tr key={ex.id} className="border-t border-border">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{ex.namePt}</p>
                  <p className="text-xs text-muted">{ex.nameEn}</p>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1.5">
                    {ex.isCurated ? <Badge variant="accent">Curado</Badge> : null}
                    {!ex.isPublished ? <Badge variant="warning">Oculto</Badge> : null}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/admin/exercises/${ex.id}/edit`} className="text-accent hover:underline">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Mostrando até 100 resultados. Refine a busca para encontrar mais.</p>
    </div>
  );
}
