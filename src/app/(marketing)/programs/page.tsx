import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/require-user";
import { listTemplates, toCatalogItem } from "@/lib/data/templates";
import { ProtocolLibrary } from "@/components/programs/protocol-library";
import { Masthead } from "@/components/ui/masthead";
import type { ProtocolCardData } from "@/components/programs/protocol-card";

export const metadata: Metadata = { title: "Programas" };

export default async function PublicProgramsPage() {
  const session = await getCurrentSession();
  if (session) redirect("/app/programs");

  const items: ProtocolCardData[] = (await listTemplates()).map((t) => ({
    ...toCatalogItem(t),
    href: `/programs/${t.slug}`,
    mark: t.isFlagship ? "Destaque" : null,
  }));

  return (
    <MarketingShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <Masthead
          kicker="Biblioteca de programas"
          title="Programas"
          lead={
            <span className="block max-w-xl">
              Programas prontos, construídos em torno de evidência real — objetivo, frequência e progressão explicados,
              nunca só uma planilha de exercícios.
            </span>
          }
        />

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
