import { describe, expect, it } from "vitest";
import { slugifyUsername, usernameCandidate, usernameError } from "./username";

describe("usernameError", () => {
  it("accepts letters, digits and underscore, 3–24 long", () => {
    for (const ok of ["maria", "Maria_2", "abc", "a".repeat(24), "seu_usuario"]) {
      expect(usernameError(ok), ok).toBeNull();
    }
  });

  it("rejects bad lengths, characters and reserved names", () => {
    expect(usernameError("ab")).toMatch(/Mínimo/);
    expect(usernameError("a".repeat(25))).toMatch(/Máximo/);
    for (const bad of ["seu-usuario", "maria silva", "joão", "@maria"]) {
      expect(usernameError(bad), bad).toMatch(/letras, números e _/);
    }
    expect(usernameError("Admin")).toMatch(/não está disponível/);
    expect(usernameError("app")).toMatch(/não está disponível/);
  });
});

describe("slugifyUsername", () => {
  it("normalizes accents, case, spaces and punctuation", () => {
    expect(slugifyUsername("Maria Luísa")).toBe("maria_luisa");
    expect(slugifyUsername("  João  Pedro-Silva ")).toBe("joao_pedro_silva");
    expect(slugifyUsername("Ana Teste 2")).toBe("ana_teste_2");
    expect(slugifyUsername("ÇÃO!!")).toBe("cao");
  });

  it("always produces a well-formed handle", () => {
    expect(slugifyUsername("")).toBe("atleta");
    expect(slugifyUsername("🔥🔥")).toBe("atleta");
    expect(slugifyUsername("Jo")).toBe("jo_fg");
    const long = slugifyUsername("Maria Aparecida dos Santos Oliveira");
    expect(long.length).toBeLessThanOrEqual(24);
    expect(long).toBe("maria_aparecida_dos_sant");
    // Truncation never leaves a trailing underscore.
    expect(slugifyUsername("abcdefghijklmnopqrstuvw xyz")).toBe("abcdefghijklmnopqrstuvw");
    for (const name of ["", "Jo", "Maria Luísa", "Maria Aparecida dos Santos Oliveira", "E2E Test"]) {
      const slug = slugifyUsername(name);
      expect(slug).toMatch(/^[a-z0-9_]{3,24}$/);
    }
  });
});

describe("usernameCandidate", () => {
  it("adds a numeric suffix and stays within 24 characters", () => {
    expect(usernameCandidate("maria", 1)).toBe("maria");
    expect(usernameCandidate("maria", 2)).toBe("maria2");
    expect(usernameCandidate("maria", 13)).toBe("maria13");
    const base = "a".repeat(24);
    expect(usernameCandidate(base, 2)).toBe(`${"a".repeat(23)}2`);
    expect(usernameCandidate(base, 100)).toHaveLength(24);
  });
});
