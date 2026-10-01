import Link from "next/link";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { countOpenReports } from "@/lib/social/notification-reports";
import { plural } from "@/lib/utils/format";

/**
 * "Painel admin" in Settings → Dados e conta, for admins (phones have no
 * sidebar; W-141): the way into /admin, with the reports waiting. `isAdmin`
 * comes from lib/auth/roles isAdminUser (role or ADMIN_EMAILS). Nothing for
 * everyone else.
 */
export async function AdminPanelLink({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) return null;
  const open = await countOpenReports().catch(() => null);
  return (
    <div className="mb-4 flex items-center justify-between gap-4 border-b border-border pb-4" data-admin-panel-link>
      <div className="min-w-0">
        <p className="text-sm font-medium">Painel admin</p>
        <p className="text-xs text-muted">
          {open === null
            ? "Exercícios, programas e denúncias."
            : open > 0
              ? `${plural(open, "denúncia aberta", "denúncias abertas")} para revisar.`
              : "Nenhuma denúncia aberta."}
        </p>
      </div>
      <Button variant="outline" size="sm" asChild className="shrink-0">
        <Link href={open && open > 0 ? "/admin/reports" : "/admin"} aria-label="Abrir o painel admin">
          <Shield aria-hidden />
          Abrir
        </Link>
      </Button>
    </div>
  );
}
