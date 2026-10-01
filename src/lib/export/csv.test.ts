import { describe, expect, it } from "vitest";
import { csvDecimal, neutralizeFormula, toCsv } from "./csv";

describe("csvDecimal", () => {
  it("rounds to two decimals with a comma; empty for nothing", () => {
    expect(csvDecimal(44.62524042425695)).toBe("44,63");
    expect(csvDecimal(60)).toBe("60");
    expect(csvDecimal(2.5)).toBe("2,5");
    expect(csvDecimal(1250.5)).toBe("1250,5");
    expect(csvDecimal(null)).toBe("");
    expect(csvDecimal(undefined)).toBe("");
    expect(csvDecimal(Number.NaN)).toBe("");
    expect(csvDecimal(-0.001)).toBe("0");
  });
});

describe("neutralizeFormula", () => {
  it("prefixes text a spreadsheet would run", () => {
    expect(neutralizeFormula("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(neutralizeFormula("+55 11")).toBe("'+55 11");
    expect(neutralizeFormula("-2 kg")).toBe("'-2 kg");
    expect(neutralizeFormula("@here")).toBe("'@here");
    expect(neutralizeFormula("\tx")).toBe("'\tx");
    expect(neutralizeFormula("Supino")).toBe("Supino");
  });
});

describe("toCsv", () => {
  it("writes a BOM, ';' between fields and CRLF line ends", () => {
    const out = toCsv(["Data", "Carga (kg)"], [["2026-09-28", 44.625]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toBe("﻿Data;Carga (kg)\r\n2026-09-28;44,63\r\n");
  });

  it("quotes fields with ; \" or line breaks and doubles inner quotes", () => {
    const out = toCsv(["a", "b", "c", "d"], [['uma; duas', 'diz "oi"', "linha\nnova", " espaço"]]);
    const row = out.split("\r\n")[1];
    expect(row).toBe('"uma; duas";"diz ""oi""";"linha\nnova";" espaço"');
  });

  it("neutralizes formulas in text cells and leaves empty cells empty", () => {
    const out = toCsv(["nota", "vazio", "num"], [["=HYPERLINK(\"x\")", null, -5]]);
    expect(out.split("\r\n")[1]).toBe(`"'=HYPERLINK(""x"")";;-5`);
  });
});
