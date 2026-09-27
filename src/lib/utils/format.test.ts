import { describe, expect, it } from "vitest";
import { formatDuration, formatKg, formatNumber, formatRir, formatVolume, plural } from "./format";

const S = " ";

describe("pt-BR formatting", () => {
  it("formats numbers and loads with a decimal comma", () => {
    expect(formatNumber(62.5)).toBe("62,5");
    expect(formatNumber(40)).toBe("40");
    expect(formatKg(62.5)).toBe(`62,5${S}kg`);
    expect(formatKg(null)).toBe("—");
  });

  it("rounds volume to whole kilos with a thousands separator", () => {
    expect(formatVolume(1225.4)).toBe(`1.225${S}kg`);
    expect(formatVolume(785)).toBe(`785${S}kg`);
  });

  it("formats durations", () => {
    expect(formatDuration(20)).toBe(`<1${S}min`);
    expect(formatDuration(45 * 60)).toBe(`45${S}min`);
    expect(formatDuration(75 * 60)).toBe(`1${S}h 15${S}min`);
    expect(formatDuration(120 * 60)).toBe(`2${S}h`);
  });

  it("formats RIR and plurals", () => {
    expect(formatRir(2.5)).toBe("RIR 2,5");
    expect(plural(1, "série", "séries")).toBe("1 série");
    expect(plural(0, "série", "séries")).toBe("0 séries");
    expect(plural(3, "sessão", "sessões")).toBe("3 sessões");
  });
});
