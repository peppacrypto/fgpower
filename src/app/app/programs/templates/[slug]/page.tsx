import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getTemplateBySlug } from "@/lib/data/templates";
import { getActiveEnrollment } from "@/lib/data/dashboard";
import { SubmitButton } from "@/components/ui/submit-button";
import { startTemplate, customizeTemplate } from "@/lib/actions/programs";
import { TemplateDossier } from "@/components/programs/template-dossier";

export async function generateMetadata({ params }: PageProps<"/app/programs/templates/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTemplateBySlug(slug);
  return t ? { title: t.namePt } : {};
}

export default async function TemplateDetailPage({ params }: PageProps<"/app/programs/templates/[slug]">) {
  const { slug } = await params;
  const user = await requireUser();
  const [template, activeEnrollment] = await Promise.all([getTemplateBySlug(slug), getActiveEnrollment(user.id)]);
  if (!template) notFound();

  const enrollForm = (
    <form action={startTemplate.bind(null, template.slug)}>
      <SubmitButton size="lg" variant="strong" pendingLabel="Ativando…">
        Ativar programa
      </SubmitButton>
    </form>
  );

  return (
    <TemplateDossier
      template={template}
      scienceHref="/app/science"
      actions={
        <>
          {enrollForm}
          <form action={customizeTemplate.bind(null, template.slug)}>
            <SubmitButton size="lg" variant="outline" pendingLabel="Abrindo…">
              Personalizar
            </SubmitButton>
          </form>
          {activeEnrollment ? (
            <p className="w-full text-xs text-muted">
              Isto encerra seu programa ativo atual (
              <span className="font-medium text-foreground">{activeEnrollment.program.name}</span>).
            </p>
          ) : null}
        </>
      }
      stickyActions={enrollForm}
    />
  );
}
