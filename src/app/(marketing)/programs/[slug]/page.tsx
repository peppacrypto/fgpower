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
          // Signing in keeps the choice: login → (onboarding →) this program's page in the app.
          // Full width and wrapping on a phone: at 320px it ran past the masthead's padding.
          <Button
            variant="strong"
            size="lg"
            asChild
            className="h-auto min-h-13 w-full whitespace-normal py-3 text-center text-balance max-sm:px-4 sm:w-auto"
          >
            <Link href={`/login?next=${encodeURIComponent(`/app/programs/templates/${template.slug}`)}`}>
              {/* The arrow rides the last word if the label wraps. */}
              <span>
                Começar este{" "}
                <span className="whitespace-nowrap">
                  programa
                  <ArrowRight className="ml-2 inline-block align-[-0.15em]" />
                </span>
              </span>
            </Link>
          </Button>
        }
      />
    </MarketingShell>
  );
}
