import { normalizeMissingGear } from "@/lib/exercises/gear";
import { gymLoadsOf } from "@/lib/training/exercise-load";
import { Section } from "./section";
import { GymLoadsForm } from "./gym-loads-form";
import { GearChecklist } from "./gear-checklist";
import { gearChecklistGroups } from "./gym-gear";
import { gymLoadsForForm } from "./gym-options";
import { blockedPlan } from "./gym-plan";

/** The Profile columns this section reads (the page's getProfile row has them all). */
type GymProfile = NonNullable<Parameters<typeof gymLoadsOf>[0]> & { missingGear?: string[] | null };

/**
 * Settings → "Minha academia" (id="academia", right after Rotina): how the
 * loads move in the user's gym ("Pesos") and the gear it has ("Aparelhos").
 * The load suggestions, the warm-ups and the swaps all follow it. When the
 * active primary plan prescribes an exercise the gym can't do, "Aparelhos"
 * says so and links to the plan's adjustment (/app/programs/[id]/academia).
 * #aparelhos lands a link right on the checklist.
 */
export async function GymSection({ userId, profile, programId }: { userId: string; profile: GymProfile; programId: string | null }) {
  const missing = normalizeMissingGear(profile.missingGear ?? []);
  const plan = await blockedPlan(userId, programId, missing);
  return (
    <Section id="academia" title="Minha academia" description="As sugestões de carga e as trocas de exercício seguem a sua academia.">
      <div className="divide-y divide-border">
        <div className="pb-3">
          <GymLoadsForm initial={gymLoadsForForm(gymLoadsOf(profile))} />
        </div>
        <div id="aparelhos" className="scroll-mt-4 pt-5">
          <GearChecklist groups={gearChecklistGroups()} initial={missing} blockedPlan={plan} />
        </div>
      </div>
    </Section>
  );
}
