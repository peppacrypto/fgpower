"use client";

import { useActionState, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { applyGymStandIns } from "@/lib/actions/program-gear";
import type { ActionResult } from "@/lib/actions/result";
import { AdaptSaveBar, AdaptSwapCounts } from "@/components/programs/adapt-swap-choice";
import { describeActionFailure } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";

/**
 * The "Ajustar à minha academia" review's form: the swaps (`children`, one
 * AdaptSwapChoice per exercise) and the floating "Salvar com N trocas". A save
 * lands on the program (applyGymStandIns redirects); what comes back is a
 * failure, said right above the button — a gone session with its "Entrar", or
 * no signal / a server error (the call itself rejected) as a retry — never the
 * app's error screen, and the picks stay as they were.
 */
export function GymAdjustForm({
  programId,
  cancelHref,
  initial,
  children,
}: {
  programId: string;
  cancelHref: string;
  /** The fields that start on a stand-in (AdaptSwapCounts). */
  initial: string[];
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(
    async (_prev: ActionResult | null, formData: FormData): Promise<ActionResult | null> => {
      try {
        return await applyGymStandIns(programId, formData);
      } catch (err) {
        unstable_rethrow(err); // the save's redirect to the program
        console.warn("applyGymStandIns failed", err);
        return describeActionFailure();
      }
    },
    null,
  );

  return (
    <AdaptSwapCounts initial={initial}>
      <form action={formAction}>
        {children}
        <AdaptSaveBar
          cancelHref={cancelHref}
          none="Salvar sem trocas"
          alert={
            state && !state.ok ? (
              <p role="alert" className="basis-full px-2 pt-1 text-[13px] leading-snug text-danger">
                <ActionErrorText error={state.error} />
              </p>
            ) : null
          }
        />
      </form>
    </AdaptSwapCounts>
  );
}
