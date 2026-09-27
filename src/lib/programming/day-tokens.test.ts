import { describe, expect, it } from "vitest";
import { CATALOG_FIXTURE } from "./catalog-fixture";
import { dayTokens, shortDayName } from "./day-tokens";

const tokensOf = (slug: string) => dayTokens(CATALOG_FIXTURE.find((t) => t.slug === slug)!.dayNames);

describe("dayTokens", () => {
  it("abbreviates weekday plans to day + focus", () => {
    expect(tokensOf("gd-adaptacao")).toEqual(["SEG · SUP A", "TER · INF A", "QUA · TÉC", "QUI · SUP B", "SEX · INF B"]);
    expect(tokensOf("high-frequency-squat")).toEqual(["SEG · PES", "TER · FRO", "QUI · VOL", "SEX · CON", "SÁB · VEL"]);
  });

  it("shows only the letter when names differ only by it", () => {
    expect(tokensOf("home-dumbbells")).toEqual(["A", "B", "C"]);
    expect(tokensOf("fgpower-adaptation")).toEqual(["A", "B", "C"]);
  });

  it("keeps short names whole and adds the focus of numbered days", () => {
    expect(tokensOf("push-pull-legs")).toEqual(["PUSH A", "PULL A", "PERNAS A", "PUSH B", "PULL B", "PERNAS B"]);
    expect(tokensOf("classic-split")).toEqual(["1 · PEITO", "2 · COSTAS", "3 · PERNAS", "4 · OMBROS", "5 · BRAÇOS"]);
  });

  it("tells apart days that share a head", () => {
    expect(tokensOf("torso-limbs")).toEqual(["TRONCO · TEN", "MEMBROS · TEN", "TRONCO · BOM", "MEMBROS · BOM"]);
  });

  it("gives every day of every catalog program a distinct, short chip", () => {
    for (const t of CATALOG_FIXTURE) {
      const tokens = dayTokens(t.dayNames);
      expect(new Set(tokens).size, t.slug).toBe(tokens.length);
      for (const token of tokens) {
        expect(token.length, `${t.slug}: ${token}`).toBeLessThanOrEqual(14);
        expect(token.endsWith("—"), token).toBe(false);
      }
    }
  });

  it("handles custom names", () => {
    expect(dayTokens(["Treino de perna", "Treino de peito"])).toEqual(["PERNA", "PEITO"]);
    expect(dayTokens(["Meu treino favorito de sábado"])).toEqual(["MEU TRE"]);
    expect(dayTokens(["Dia", "Dia"])).toEqual(["DIA 1", "DIA 2"]);
    expect(dayTokens([])).toEqual([]);
  });
});

describe("shortDayName", () => {
  it("names a day briefly enough for a button", () => {
    expect(shortDayName("Segunda — Superior A (máquinas)")).toBe("Superior A");
    expect(shortDayName("Sessão A — Agachamento e Supino")).toBe("Sessão A");
    expect(shortDayName("Sessão A")).toBe("Sessão A");
    expect(shortDayName("Push A")).toBe("Push A");
    expect(shortDayName("Corpo Inteiro A")).toBe("Corpo Inteiro A");
    expect(shortDayName("Dia do Agachamento")).toBe("Dia do Agachamento");
    expect(shortDayName("Potência Inferior A — Agachamento e Saltos")).toBe("Potência Inferior A");
  });

  it("keeps the first part of a long compound", () => {
    expect(shortDayName("Segunda — Empurrar + Prioridade (posteriores e glúteos)")).toBe("Empurrar");
    expect(shortDayName("Sexta — Braços, ombros e abdômen")).toBe("Braços");
    expect(shortDayName("Densidade & Bombeamento")).toBe("Densidade");
    expect(shortDayName("Dia do Desenvolvimento")).toBe("Desenvolvimento");
  });

  it("never names a day by a bare letter", () => {
    expect(shortDayName("A — Swing & Desenvolvimento")).toBe("Treino A");
    expect(shortDayName("b")).toBe("Treino B");
  });

  it("fits every catalog day on the start button's second line at 320px", () => {
    for (const t of CATALOG_FIXTURE) {
      for (const d of t.dayNames) {
        const short = shortDayName(d);
        expect(short.length, d).toBeLessThanOrEqual(19);
        expect(short, d).not.toMatch(/^[A-Z0-9]{1,2}$/i);
        expect(short, d).not.toMatch(/[\s+&,—]$/);
      }
    }
  });
});
