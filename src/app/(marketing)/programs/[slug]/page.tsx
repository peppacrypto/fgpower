import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { getCurrentSession } from "@/lib/auth/require-user";
import { getTemplateBySlug } from "@/lib/data/templates";
import { Button } from "@/components/ui/button";
import { TemplateDossier } from "@/components/programs/template-dossier";

export async function generateMetadata({ params }: PageProps<"/programs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTemplateBySlug(slug);
  return t ? { title: t.namePt } : {};
}

export default async function PublicTemplateDetailPage({ params }: PageProps<"/programs/[slug]">) {
  const { slug } = await params;
  const session = await getCurrentSession();
  if (session) redirect(`/app/programs/templates/${slug}`);

  const template = await getTemplateBySlug(slug);
  if (!template) notFound();

  return (
    <MarketingShell>
      <TemplateDossier
        template={template}
        scienceHref="/science"
        actions={
          <Button variant="strong" size="lg" asChild>
            <Link href="/login">
              Iniciar com Google
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />
    </MarketingShell>
  );
}
