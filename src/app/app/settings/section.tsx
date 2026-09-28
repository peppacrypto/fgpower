import { Card, CardContent } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";

/**
 * One block of Settings: a section head, an optional line under it, and the
 * card. Shared by the sections other clusters add (Lembretes, Contas
 * bloqueadas); `id` is its anchor (/app/settings#lembretes).
 */
export function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-8 scroll-mt-4">
      <SectionHead label={title} />
      {description ? <p className="mt-1.5 text-xs text-muted">{description}</p> : null}
      <Card className="mt-3">
        <CardContent className="pt-5">{children}</CardContent>
      </Card>
    </section>
  );
}
