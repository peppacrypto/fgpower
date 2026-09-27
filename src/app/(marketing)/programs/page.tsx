import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/require-user";
import { listTemplates, toCatalogItem } from "@/lib/data/templates";
import { ProtocolLibrary } from "@/components/programs/protocol-library";
import type { ProtocolCardData } from "@/components/programs/protocol-card";

export const metadata: Metadata = { title: "Programas" };

export default async function PublicProgramsPage() {
  const session = await getCurrentSession();
  if (session) redirect("/app/programs");

  const items: ProtocolCardData[] = (await listTemplates()).map((t, i) => ({
    ...toCatalogItem(t),
    index: i + 1,
    href: `/programs/${t.slug}`,
    mark: t.isFlagship ? "Destaque" : null,
  }));

  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Biblioteca de programas</span>
        <h1 className="text-display mt-1 max-w-xl text-4xl font-extrabold sm:text-5xl">Programas</h1>
        <p className="mt-3 max-w-lg text-muted">
          Programas prontos, construídos em torno de evidência real — objetivo, frequência e progressão explicados,
          nunca só uma planilha de exercícios.
        </p>

        <ProtocolLibrary
          label="Todos os programas"
          items={items}
          // Nothing known about a visitor: suggest the beginner shelf when a search finds nothing.
          suggestions={items
            .filter((t) => t.experienceLevel === "BEGINNER" && t.equipmentAccess === "FULL_GYM")
            .slice(0, 3)}
          suggestionsLabel="Comece por aqui"
        />
      </div>
    </MarketingShell>
  );
}
