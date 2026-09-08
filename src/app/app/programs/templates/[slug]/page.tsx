import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTemplateBySlug } from "@/lib/data/templates";
import { Button } from "@/components/ui/button";
import { startTemplate, customizeTemplate } from "@/lib/actions/programs";
import { TemplateDossier } from "@/components/programs/template-dossier";

export async function generateMetadata({ params }: PageProps<"/app/programs/templates/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTemplateBySlug(slug);
  return t ? { title: t.namePt } : {};
}

export default async function TemplateDetailPage({ params }: PageProps<"/app/programs/templates/[slug]">) {
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);
  if (!template) notFound();

  return (
    <TemplateDossier
      template={template}
      scienceHref="/app/science"
      actions={
        <>
          <form action={startTemplate.bind(null, template.slug)}>
            <Button type="submit" size="lg" variant="strong">
              Iniciar programa
            </Button>
          </form>
          <form action={customizeTemplate.bind(null, template.slug)}>
            <Button type="submit" size="lg" variant="outline">
              Personalizar
            </Button>
          </form>
        </>
      }
    />
  );
}
