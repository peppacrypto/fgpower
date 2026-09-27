"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { isSessionExpiredError, loginAgainHref } from "@/lib/auth/session-expired";

/**
 * An action's error message. When it says the session expired, it carries an
 * "Entrar" link that signs in again and comes back to this page — instead of
 * a dead-end sentence (or "sem conexão?") while the phone is online.
 */
export function ActionErrorText({ error }: { error: string }) {
  if (!isSessionExpiredError(error)) return <>{error}</>;
  return (
    <>
      {error} <LoginAgainLink />
    </>
  );
}

export function LoginAgainLink({ className }: { className?: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const href = loginAgainHref(search ? `${pathname}?${search}` : pathname);
  return (
    <Link href={href} className={className ?? "font-semibold underline underline-offset-2"}>
      Entrar
    </Link>
  );
}
