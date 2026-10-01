"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { plural } from "@/lib/utils/format";
import { UnreadPip, useUnread } from "./unread-provider";

/**
 * Today's masthead bell (W-042): a 44px square link to /app/notifications,
 * with the unread pip on its corner. On a phone the notifications have no
 * tab of their own; this is the one-tap way in from the screen people open
 * most.
 */
export function NotificationsBell({ className }: { className?: string }) {
  const unread = useUnread();
  return (
    <Button variant="outline" size="icon" asChild className={cn("relative shrink-0 [&_svg]:size-5", className)}>
      <Link
        href="/app/notifications"
        aria-label={unread > 0 ? `Notificações, ${plural(unread, "nova", "novas")}` : "Notificações"}
        data-notifications-bell
      >
        <Bell aria-hidden />
        <UnreadPip count={unread} className="pointer-events-none absolute -right-1.5 -top-1.5" />
      </Link>
    </Button>
  );
}
