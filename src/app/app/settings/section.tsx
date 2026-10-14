import { Card, CardContent } from "@/components/ui/card";
import { SectionHead } from "@/components/ui/section-head";

/**
 * One block of Settings: a section head, an optional line under it, and the
 * card. Shared by the sections other clusters add (Lembretes, Contas
 * bloqueadas). `id` is its anchor (/app/settings#lembretes), which
 * ScrollToHash lands a link on: every section has one.
 */
export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-4">
      <SectionHead label={title} />
      {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
      <Card className="mt-3">
        <CardContent className="p-4 sm:p-5">{children}</CardContent>
      </Card>
    </section>
  );
}
