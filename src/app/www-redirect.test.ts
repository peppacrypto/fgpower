import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("www → apex canonical redirect", () => {
  it("redirects www.fgpower.monster to the apex with a 308, preserving the path", async () => {
    expect(typeof nextConfig.redirects).toBe("function");
    const rules = await nextConfig.redirects!();

    const www = rules.find((r) =>
      r.has?.some(
        (h) => h.type === "host" && h.value === "www.fgpower.monster",
      ),
    );

    expect(www).toBeDefined();
    expect(www!.source).toBe("/:path*");
    expect(www!.destination).toBe("https://fgpower.monster/:path*");
    // permanent: true => 308 (method- and body-preserving), not 301.
    expect(www!.permanent).toBe(true);
  });

  it("does not redirect the apex host onto itself", async () => {
    const rules = await nextConfig.redirects!();
    const loop = rules.find(
      (r) => r.destination === "https://fgpower.monster/:path*" &&
        r.has?.some((h) => h.type === "host" && h.value === "fgpower.monster"),
    );
    expect(loop).toBeUndefined();
  });
});
