import { describe, expect, it } from "vitest";
import { restTimerSpeech } from "@/lib/training/rest-timer-speech";

describe("restTimerSpeech (A-082)", () => {
  it("speaks coarse minutes and seconds", () => {
    expect(restTimerSpeech(80_000, false)).toBe("Faltam 1 minuto e 20 segundos");
    expect(restTimerSpeech(120_000, false)).toBe("Faltam 2 minutos");
    expect(restTimerSpeech(45_000, false)).toBe("Faltam 45 segundos");
  });
  it("marks a paused rest and never says zero", () => {
    expect(restTimerSpeech(80_000, true)).toBe("Em pausa, faltam 1 minuto e 20 segundos");
    expect(restTimerSpeech(0, false)).toBe("Faltam 1 segundo");
  });
});
