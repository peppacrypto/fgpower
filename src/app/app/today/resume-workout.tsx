"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markWorkoutVisited, workoutVisited } from "@/app/app/workout/[sessionId]/workout-visit";

/**
 * The installed app reopened mid-workout (iOS kills it during a rest and it
 * starts again on Today): the first Today of a visit goes straight back to
 * the workout in progress (W-097). Only once per visit — after that, and once
 * any workout screen was open in it, "Hoje" is Today.
 */
export function ResumeWorkout({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  useEffect(() => {
    if (workoutVisited()) return;
    markWorkoutVisited();
    router.replace(`/app/workout/${sessionId}`);
  }, [router, sessionId]);
  return null;
}
