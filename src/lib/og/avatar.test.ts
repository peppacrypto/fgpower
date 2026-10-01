import { afterEach, describe, expect, it, vi } from "vitest";
import { avatarFetchUrl, fetchAvatarDataUri } from "./avatar";

describe("avatarFetchUrl", () => {
  it("accepts only https Google avatars, resized to 256 px", () => {
    expect(avatarFetchUrl("https://lh3.googleusercontent.com/a/ACg8ocK=s96-c")).toBe(
      "https://lh3.googleusercontent.com/a/ACg8ocK=s256-c",
    );
    expect(avatarFetchUrl("https://lh3.googleusercontent.com/a/ACg8ocK")).toBe(
      "https://lh3.googleusercontent.com/a/ACg8ocK=s256-c",
    );
    // The query never reaches the fetch.
    expect(avatarFetchUrl("https://lh3.googleusercontent.com/a/x=s96-c?sz=50")).toBe("https://lh3.googleusercontent.com/a/x=s256-c");
  });

  it("refuses everything else", () => {
    for (const bad of [
      null,
      "",
      "not a url",
      "http://lh3.googleusercontent.com/a/x",
      "https://lh3.googleusercontent.com:8443/a/x",
      "https://user:pw@lh3.googleusercontent.com/a/x",
      "https://lh3.googleusercontent.com.evil.com/a/x",
      "https://evil.com/lh3.googleusercontent.com",
      "https://127.0.0.1/a.png",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/a.png",
      "file:///etc/passwd",
      "data:image/png;base64,AAAA",
    ]) {
      expect(avatarFetchUrl(bad), String(bad)).toBeNull();
    }
  });
});

describe("fetchAvatarDataUri", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never fetches a refused URL", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await fetchAvatarDataUri("https://169.254.169.254/x")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns a data URI for a PNG/JPEG and null for other types or oversized bodies", async () => {
    const png = new Uint8Array([137, 80, 78, 71]);
    vi.stubGlobal("fetch", async () => new Response(png, { headers: { "content-type": "image/png" } }));
    expect(await fetchAvatarDataUri("https://lh3.googleusercontent.com/a/x")).toBe("data:image/png;base64,iVBORw==");

    vi.stubGlobal("fetch", async () => new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }));
    expect(await fetchAvatarDataUri("https://lh3.googleusercontent.com/a/x")).toBeNull();

    const big = new Uint8Array(1024 * 1024 + 1);
    vi.stubGlobal("fetch", async () => new Response(big, { headers: { "content-type": "image/jpeg" } }));
    expect(await fetchAvatarDataUri("https://lh3.googleusercontent.com/a/x")).toBeNull();

    vi.stubGlobal("fetch", async () => {
      throw new Error("network");
    });
    expect(await fetchAvatarDataUri("https://lh3.googleusercontent.com/a/x")).toBeNull();
  });
});
