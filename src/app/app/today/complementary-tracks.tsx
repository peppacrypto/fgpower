import Link from "next/link";
import { SectionHead } from "@/components/ui/section-head";
import { SubmitButton } from "@/components/ui/submit-button";
import { exerciseCount } from "@/components/workout/day-actions";
import { startAdHocWorkoutSession } from "@/lib/actions/workouts";
import type { ComplementaryEnrollment } from "@/lib/data/dashboard";

/** Per-track chip label + hue (mirrors GOAL_HUE for YOGA / MOBILITY). */
const TRACK_META: Record<string, { label: string; bg: string; fg: string }> = {
  yoga: { label: "Yoga", bg: "var(--tag-indigo-bg)", fg: "var(--tag-indigo-fg)" },
  mobility: { label: "Mobilidade", bg: "var(--tag-teal-bg)", fg: "var(--tag-teal-fg)" },
  skills: { label: "Calistenia", bg: "var(--tag-amber-bg)", fg: "var(--tag-amber-fg)" },
};

/**
 * The on-demand complementary plans (yoga / mobility) the user has active
 * ALONGSIDE their primary strength plan. They never claim a weekday, so they
 * sit in their own "faça quando quiser" section below the primary program's
 * week — each routine opens a workout exactly like a primary day does
 * (startAdHocWorkoutSession, track-scoped so it never touches the GD plan).
 */
export function ComplementaryTracks({ enrollments }: { enrollments: ComplementaryEnrollment[] }) {
  const shown = enrollments.filter((e) => e.days.length > 0);
  if (shown.length === 0) return null;
  return (
    <section className="mt-10">
      <SectionHead label="Yoga, mobilidade & calistenia" count="faça quando quiser" />
      <div className="mt-3 flex flex-col gap-4">
        {shown.map((e) => {
          const meta = TRACK_META[e.track] ?? { label: e.track, bg: "var(--surface-2)", fg: "var(--muted)" };
          return (
            <div key={e.enrollmentId} className="reg-frame p-3">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/app/programs/${e.programId}`}
                  className="text-sm font-semibold leading-snug wrap-break-word hover:underline"
                >
                  {e.programName}
                </Link>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{ backgroundColor: meta.bg, color: meta.fg }}
                >
                  {meta.label}
                </span>
              </div>
              <div className="mt-1 flex flex-col">
                {e.days.map((day) => (
                  <div
                    key={day.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-2 mt-2"
                  >
                    <div className="min-w-[7rem] flex-1">
                      <p className="text-sm leading-snug wrap-break-word">{day.name}</p>
                      <p className="text-xs text-muted">
                        {exerciseCount(day.exerciseCount)}
                        {day.focus ? <span className="wrap-break-word"> · {day.focus}</span> : null}
                      </p>
                    </div>
                    <form action={startAdHocWorkoutSession.bind(null, day.id)}>
                      <SubmitButton variant="secondary" size="sm" pendingLabel="Abrindo…">
                        Iniciar
                      </SubmitButton>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
