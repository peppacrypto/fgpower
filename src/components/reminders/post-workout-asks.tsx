import { InstallAppCard } from "@/components/pwa/install-app-card";

/**
 * The one ask after a fresh workout (decision 8, W-017, owned by C4): the
 * reminders ask ("Lembrar você nos dias de treino?", with the e-mail digest
 * checkbox when e-mail is on) or the install card — never both. An async
 * server component that loads its own eligibility (reminder preferences,
 * devices), so the summary only places it: last on the page, for the latest
 * workout.
 *
 * Phase 0 stub with the final props: the install card, exactly as before.
 */
export async function PostWorkoutAsks({
  finishedWorkouts,
  className,
}: {
  userId: string;
  /** The workout's ordinal ("Treino nº N"): the install card waits for the first few. */
  finishedWorkouts: number;
  className?: string;
}) {
  return <InstallAppCard finishedWorkouts={finishedWorkouts} className={className} />;
}
