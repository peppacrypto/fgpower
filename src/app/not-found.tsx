import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { NotFoundPanel } from "@/components/ui/not-found-panel";

// Only applies to unmatched URLs (Next puts it in the server-rendered head);
// after a page-level notFound() the panel's own <title> takes over. Both say
// the same thing, so the duplicate tag on unmatched URLs is harmless.
export const metadata: Metadata = { title: "Página não encontrada" };

// Unmatched URLs and notFound() outside /app: the public light chrome, so the
// visitor can find their way back in.
export default function NotFound() {
  return (
    <MarketingShell>
      <NotFoundPanel programsHref="/programs" />
    </MarketingShell>
  );
}
