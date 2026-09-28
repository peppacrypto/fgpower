import { describe, expect, it } from "vitest";
import { blockCompletedSummary, workoutMilestoneSummary } from "@/lib/programming/milestones";
import { blockStampLine, milestoneStampOf, stampText } from "./milestone-stamp";

describe("milestoneStampOf (a private milestone drawn as a stamp, never as a workout card)", () => {
  it("reads the 10th workout's stamp, with the workout that reached it", () => {
    const stamp = milestoneStampOf(
      workoutMilestoneSummary({ count: 10, sessionId: "s10", sessionName: "Sexta — Inferior B", totalWorkingSets: 18 }),
    );
    expect(stamp).toEqual({ kind: "WORKOUT_COUNT", count: 10, sessionId: "s10", workoutName: "Sexta — Inferior B" });
    expect(stampText(stamp!)).toBe("Dossiê nº 10");
  });

  it("reads a completed block's stamp and how it went", () => {
    const stamp = milestoneStampOf(
      blockCompletedSummary({
        enrollmentId: "e1",
        programName: "GD 1",
        templateSlug: "gd-1",
        weeks: 13,
        sessionsDone: 60,
        plannedSessions: 65,
        totalWorkingSets: 900,
      }),
    );
    expect(stamp).toMatchObject({ kind: "BLOCK_COMPLETED", programName: "GD 1", enrollmentId: "e1", templateSlug: "gd-1" });
    expect(stampText(stamp!)).toBe("GD 1 concluído");
    if (stamp?.kind !== "BLOCK_COMPLETED") throw new Error("expected a block stamp");
    expect(blockStampLine(stamp)).toBe("13 semanas · 60 de 65 treinos");
  });

  it("says only what was stored for a block", () => {
    const stamp = milestoneStampOf({ kind: "BLOCK_COMPLETED", workoutName: "Bloco concluído · Meu treino" });
    expect(stamp).toMatchObject({ programName: "Meu treino", weeks: null, sessionsDone: null });
    if (stamp?.kind !== "BLOCK_COMPLETED") throw new Error("expected a block stamp");
    expect(blockStampLine(stamp)).toBeNull();
    expect(blockStampLine({ ...stamp, weeks: 1, sessionsDone: 1, plannedSessions: null })).toBe("1 semana · 1 treino");
  });

  it("leaves a workout's summary (and anything malformed) to the workout card", () => {
    expect(milestoneStampOf({ workoutName: "Segunda — Superior", totalWorkingSets: 12, exercises: [], prs: [] })).toBeNull();
    expect(milestoneStampOf(null)).toBeNull();
    expect(milestoneStampOf("x")).toBeNull();
    expect(milestoneStampOf({ kind: "WORKOUT_COUNT", count: "10" })).toBeNull();
    expect(milestoneStampOf({ kind: "BLOCK_COMPLETED" })).toBeNull();
  });
});
