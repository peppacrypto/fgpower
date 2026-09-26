"use client";

import { Component, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/** Copy for a failed action: no signal is the usual cause on a phone at the gym. */
export function actionFailText(fallback: string) {
  return typeof navigator !== "undefined" && navigator.onLine === false
    ? "Sem conexão. Tente de novo quando o sinal voltar."
    : fallback;
}

let failures = 0;

/**
 * Catches a failed form action right at its form. Navigation "errors"
 * (redirect, notFound) are rethrown so Next.js still handles them.
 */
class ActionErrorBoundary extends Component<
  { children: (state: { failed: boolean; attempt: number; clear: () => void }) => ReactNode },
  { error: unknown; attempt: number }
> {
  state = { error: null as unknown, attempt: 0 };

  static getDerivedStateFromError(error: unknown) {
    // A fresh key remounts the form: its failed action would otherwise throw
    // again on re-render and escape to the next boundary up.
    return { error, attempt: ++failures };
  }

  clear = () => {
    if (this.state.error !== null) this.setState({ error: null });
  };

  render() {
    if (this.state.error !== null) unstable_rethrow(this.state.error);
    return this.props.children({ failed: this.state.error !== null, attempt: this.state.attempt, clear: this.clear });
  }
}

/**
 * A <form> for a server action that navigates on success (start a day, switch
 * program…). The action stays the form's own action — it still works before
 * hydration, and <SubmitButton> shows its pending state — but a dropped
 * connection or a server error now shows a short inline message next to the
 * button instead of replacing the whole app with the root error screen (no
 * nav, no way back in the installed PWA). Tapping again retries.
 */
export function InlineActionForm({
  action,
  failText,
  className,
  errorClassName,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Shown when the action fails while online. */
  failText: string;
  className?: string;
  errorClassName?: string;
  children: ReactNode;
}) {
  return (
    <ActionErrorBoundary>
      {({ failed, attempt, clear }) => (
        <form key={attempt} action={action} onSubmit={clear} className={className}>
          {children}
          {failed ? (
            <p role="alert" className={cn("text-xs text-danger", errorClassName)}>
              {actionFailText(failText)}
            </p>
          ) : null}
        </form>
      )}
    </ActionErrorBoundary>
  );
}
