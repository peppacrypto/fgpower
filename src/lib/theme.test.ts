import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_BOOT_SCRIPT, THEME_COLORS, parseThemeChoice } from "./theme";

interface FakeMeta {
  media: string;
  content: string;
  setAttribute(name: string, value: string): void;
}

/** Just enough of a document for the boot script: a cookie, <html> and the theme-color metas. */
function fakeDocument(cookie: string | (() => string)) {
  const attrs: Record<string, string> = {};
  const metas: FakeMeta[] = ["(prefers-color-scheme: light)", "(prefers-color-scheme: dark)"].map((media, i) => ({
    media,
    content: (i === 0 ? THEME_COLORS.light : THEME_COLORS.dark) as string,
    setAttribute(name: string, value: string) {
      if (name === "content") this.content = value;
    },
  }));
  const document = {
    get cookie() {
      return typeof cookie === "function" ? cookie() : cookie;
    },
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attrs[name] = value;
      },
    },
    querySelectorAll: () => metas,
  };
  return { document, attrs, metas };
}

function boot(doc: ReturnType<typeof fakeDocument>["document"]) {
  new Function("document", THEME_BOOT_SCRIPT)(doc);
}

describe("THEME_BOOT_SCRIPT", () => {
  it("forces the cookie's theme on <html> and every theme-color meta", () => {
    const { document, attrs, metas } = fakeDocument("a=1; fg-theme=dark; b=2");
    boot(document);
    expect(attrs["data-theme"]).toBe("dark");
    expect(metas.map((m) => m.content)).toEqual([THEME_COLORS.dark, THEME_COLORS.dark]);

    const light = fakeDocument("fg-theme=light");
    boot(light.document);
    expect(light.attrs["data-theme"]).toBe("light");
    expect(light.metas.map((m) => m.content)).toEqual([THEME_COLORS.light, THEME_COLORS.light]);
  });

  it("leaves the system theme alone without a valid cookie", () => {
    for (const cookie of ["", "fg-theme=purple", "xfg-theme=dark", "fg-theme=darkish"]) {
      const { document, attrs, metas } = fakeDocument(cookie);
      boot(document);
      expect(attrs["data-theme"]).toBeUndefined();
      expect(metas.map((m) => m.content)).toEqual([THEME_COLORS.light, THEME_COLORS.dark]);
    }
  });

  it("never throws when the cookie jar does", () => {
    const { document, attrs } = fakeDocument(() => {
      throw new Error("SecurityError");
    });
    expect(() => boot(document)).not.toThrow();
    expect(attrs["data-theme"]).toBeUndefined();
  });

  it("is the same script public/offline.html inlines", () => {
    const html = readFileSync(path.resolve(import.meta.dirname, "../../public/offline.html"), "utf8");
    expect(html).toContain(THEME_BOOT_SCRIPT);
  });
});

describe("parseThemeChoice", () => {
  it("keeps light/dark and reads anything else as system", () => {
    expect(parseThemeChoice("dark")).toBe("dark");
    expect(parseThemeChoice("light")).toBe("light");
    expect(parseThemeChoice("system")).toBe("system");
    expect(parseThemeChoice(undefined)).toBe("system");
    expect(parseThemeChoice("<script>")).toBe("system");
  });
});
