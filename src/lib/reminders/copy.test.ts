import { describe, expect, it } from "vitest";
import { openWorkoutPush, trainingDayPush, type TrainingDayFacts } from "./copy";

const facts: TrainingDayFacts = {
  dayName: "Segunda — Superior (pesado)",
  exerciseCount: 6,
  daysSinceLast: 2,
  welcomeBackAfterDays: 10,
  streakCurrent: 0,
  remaining: 3,
  plannedLeft: 3,
  daysLeft: 4,
  perWeek: 5,
  program: { name: "GD 1", week: 5, weeks: 13, entry: false, rir: 1.5 },
};

describe("push copy", () => {
  it("training day: welcome back first, then the streak, then the program line", () => {
    expect(trainingDayPush({ ...facts, daysSinceLast: 12 })).toEqual({
      title: "Hoje: Segunda — Superior (pesado)",
      body: "12 dias desde o último treino. Volte com ~90% das cargas — a força volta rápido.",
    });
    expect(trainingDayPush({ ...facts, streakCurrent: 4, remaining: 1, plannedLeft: 1 }).body).toBe(
      "Falta 1 treino para a semana contar · 4 semanas seguidas no alvo.",
    );
    expect(trainingDayPush({ ...facts, streakCurrent: 4, remaining: 2, plannedLeft: 2 }).body).toBe(
      "Faltam 2 treinos para a semana contar · 4 semanas seguidas no alvo.",
    );
    // Room to spare this week: the program line.
    expect(trainingDayPush({ ...facts, streakCurrent: 4, remaining: 1, plannedLeft: 3 }).body).toBe(
      "GD 1 · Semana 5 de 13 · RIR alvo 1,5 · 6 exercícios",
    );
    expect(trainingDayPush({ ...facts, program: { ...facts.program, entry: true, week: null } }).body).toBe(
      "GD 1 · semana de entrada · 6 exercícios",
    );
    expect(trainingDayPush({ ...facts, exerciseCount: 1, program: { ...facts.program, weeks: null, rir: null } }).body).toBe(
      "GD 1 · Semana 5 · 1 exercício",
    );
  });

  it("never asks for more workouts than Today would (W-131: 2 at most, and they must fit)", () => {
    const line = "GD 1 · Semana 5 de 13 · RIR alvo 1,5 · 6 exercícios";
    // Monday, 0 of 5: the week needs every day left, but "faltam 5" is cramming.
    expect(trainingDayPush({ ...facts, streakCurrent: 2, remaining: 5, plannedLeft: 5, daysLeft: 7 }).body).toBe(line);
    // Wednesday, 1 of 5 with 3 planned days left: 4 can't fit.
    expect(trainingDayPush({ ...facts, streakCurrent: 2, remaining: 4, plannedLeft: 3, daysLeft: 5 }).body).toBe(line);
    // 3×/week on a Saturday, 2 left: back to back.
    expect(trainingDayPush({ ...facts, streakCurrent: 3, remaining: 2, plannedLeft: 2, daysLeft: 2, perWeek: 3 }).body).toBe(line);
    // Thursday, 3 of 5: Thursday and Friday still make it.
    expect(trainingDayPush({ ...facts, streakCurrent: 2, remaining: 2, plannedLeft: 2, daysLeft: 4 }).body).toBe(
      "Faltam 2 treinos para a semana contar · 2 semanas seguidas no alvo.",
    );
  });

  it("keeps titles to 60 characters", () => {
    const long = trainingDayPush({ ...facts, dayName: "Dia com um nome muito comprido que não cabe inteiro na tela" });
    expect(long.title.length).toBeLessThanOrEqual(60);
    expect(long.title.endsWith("…")).toBe(true);
  });

  it("open workout", () => {
    expect(openWorkoutPush({ name: "Sessão B", hoursOpen: 3.4, registered: 7 })).toEqual({
      title: "Treino aberto: Sessão B",
      body: "Aberto há 3 h com 7 séries registradas. Toque para finalizar ou descartar.",
    });
    expect(openWorkoutPush({ name: "Sessão B", hoursOpen: 5, registered: 0 }).body).toBe(
      "Aberto há 5 h. Toque para finalizar ou descartar.",
    );
  });
});
