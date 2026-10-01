import { describe, expect, it } from "vitest";
import { namesText, notificationText } from "./notification-text";

describe("notificationText", () => {
  it("names who gave FG, and the workout", () => {
    expect(notificationText({ type: "FG_RECEIVED", actorNames: ["Ana"], workoutName: "Push A" })).toBe(
      "Ana deu FG no seu treino Push A",
    );
    expect(notificationText({ type: "FG_RECEIVED", actorNames: ["Ana", "Bruno"], workoutName: "Push A" })).toBe(
      "Ana e Bruno deram FG no seu treino Push A",
    );
    expect(notificationText({ type: "FG_RECEIVED", actorNames: ["Ana", "Bruno", "Caio", "Duda", "Edu"], workoutName: "Push A" })).toBe(
      "Ana, Bruno e mais 3 deram FG no seu treino Push A",
    );
    expect(notificationText({ type: "FG_RECEIVED", actorNames: ["Ana"], workoutName: null })).toBe("Ana deu FG no seu treino");
  });

  it("says where a follow request stands", () => {
    const base = { type: "FOLLOW_REQUEST", actorNames: ["Ana"] };
    expect(notificationText({ ...base, requestStatus: "PENDING" })).toBe("Ana pediu para seguir você");
    expect(notificationText(base)).toBe("Ana pediu para seguir você");
    expect(notificationText({ ...base, requestStatus: "ACCEPTED" })).toBe("Ana agora segue você");
    expect(notificationText({ ...base, requestStatus: "DECLINED" })).toBe("Você recusou o pedido de Ana");
    expect(notificationText({ type: "NEW_FOLLOWER", actorNames: ["Ana"] })).toBe("Ana começou a seguir você");
    expect(notificationText({ type: "FOLLOW_ACCEPTED", actorNames: ["Ana"] })).toBe("Ana aceitou sua solicitação");
  });

  it("lists records by exercise", () => {
    const records = (count: number, exercises: string[]) => notificationText({ type: "PERSONAL_RECORD", data: { count, exercises } });
    expect(records(1, ["Supino Reto com Barra"])).toBe("Novo recorde em Supino Reto com Barra");
    expect(records(2, ["Supino Reto com Barra", "Remada Curvada"])).toBe("2 recordes: Supino Reto com Barra e Remada Curvada");
    expect(records(4, ["Supino Reto com Barra", "Remada Curvada", "Agachamento"])).toBe(
      "4 recordes: Supino Reto com Barra, Remada Curvada e mais 2",
    );
    expect(notificationText({ type: "PERSONAL_RECORD" })).toBe("Você bateu um novo recorde");
  });

  it("describes a completed week", () => {
    const week = (data: object) => notificationText({ type: "PROGRAM_WEEK_COMPLETE", data });
    expect(week({ programName: "GD 1", programWeek: 3, done: 4, target: 4, streak: 1 })).toBe("Semana 3 de GD 1 completa · 4 de 4 treinos");
    expect(week({ programName: "GD 1", programWeek: 3, done: 4, target: 4, streak: 5 })).toBe(
      "Semana 3 de GD 1 completa · 4 de 4 treinos · 5 semanas seguidas",
    );
    expect(week({ programName: "GD 1", programWeek: 4, deload: true, done: 1, target: 4, streak: 2 })).toBe(
      "Semana de deload feita · GD 1 · 2 semanas seguidas",
    );
    expect(week({ programName: "GD 1", programWeek: 0, done: 2, target: 2 })).toBe("Semana de entrada de GD 1 completa · 2 de 2 treinos");
    expect(week({ programName: null, programWeek: null, done: 3, target: 3, streak: 0 })).toBe("Semana completa · 3 de 3 treinos");
    expect(week({ programName: null, done: 1, target: 1 })).toBe("Semana completa · 1 de 1 treino");
    expect(notificationText({ type: "PROGRAM_WEEK_COMPLETE" })).toBe("Você completou uma semana do programa");
  });

  it("names the program and the milestone", () => {
    expect(notificationText({ type: "PROGRAM_COMPLETED", data: { programName: "GD 1" } })).toBe("Você concluiu GD 1");
    expect(notificationText({ type: "PROGRAM_COMPLETED", data: null })).toBe("Você concluiu um programa");
    expect(notificationText({ type: "WORKOUT_MILESTONE", data: { count: 10 } })).toBe("Dossiê nº 10 · 10 treinos registrados");
  });
});

describe("namesText", () => {
  it("joins names the pt-BR way", () => {
    expect(namesText([])).toBe("Alguém");
    expect(namesText(["Ana", "Bruno", "Caio"])).toBe("Ana, Bruno e mais 1");
  });
});
