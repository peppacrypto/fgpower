"use client";

import { useState } from "react";
import { Masthead } from "@/components/ui/masthead";
import { plural } from "@/lib/utils/format";

/**
 * The inbox masthead with "N novas" as this visit opened it. The page marks
 * those seen at once, so a server re-render (a refresh, the session cookie
 * refreshed inside an action, the app resuming) would drop the line while the
 * rows still show their markers; more arriving meanwhile raise it.
 */
export function InboxMasthead({ unread }: { unread: number }) {
  const [shown] = useState(unread);
  const count = Math.max(shown, unread);
  return <Masthead kicker="Sua atividade" title="Notificações" lead={count > 0 ? plural(count, "nova", "novas") : undefined} />;
}
