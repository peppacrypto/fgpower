"use client";

import Link from "next/link";
import { isSessionExpiredError } from "@/lib/auth/session-expired";

/**
 * An error line of the workout screen (L-session-expired-workout). When the
 * login is gone it says so with "Entrar", which signs in again and comes back
 * to this very exercise (`loginHref`, from loginAgainHref) — never "sem
 * conexão?" while the phone is online, never a retry that can't succeed.
 */
export function WorkoutActionError({ error, loginHref }: { error: string; loginHref: string }) {
  if (!isSessionExpiredError(error)) return <>{error}</>;
  return (
    <>
      {error}{" "}
      <Link href={loginHref} className="-my-3 inline-block py-3 font-semibold underline underline-offset-2">
        Entrar
      </Link>
    </>
  );
}

/** A fetch of the workout's own API answered 401: the login is gone. */
export class WorkoutLoggedOutError extends Error {
  constructor() {
    super("UNAUTHORIZED");
    this.name = "WorkoutLoggedOutError";
  }
}
