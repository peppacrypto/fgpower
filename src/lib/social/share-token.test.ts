import { describe, expect, it } from "vitest";
import { isShareToken, newShareToken, sharePath, SHARE_TOKEN_RE, storyPath } from "./share-token";

describe("share tokens", () => {
  it("mints 16 base64url characters, different every time", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newShareToken()));
    expect(tokens.size).toBe(200);
    for (const t of tokens) {
      expect(t).toMatch(SHARE_TOKEN_RE);
      expect(isShareToken(t)).toBe(true);
    }
  });

  it("accepts only the exact format", () => {
    expect(isShareToken("AbCdEfGhIj_-0123")).toBe(true);
    expect(isShareToken("AbCdEfGhIj_-012")).toBe(false); // 15
    expect(isShareToken("AbCdEfGhIj_-01234")).toBe(false); // 17
    expect(isShareToken("AbCdEfGhIj/-0123")).toBe(false);
    expect(isShareToken("AbCdEfGhIj+-0123")).toBe(false);
    expect(isShareToken(null)).toBe(false);
    expect(isShareToken(1234567890123456)).toBe(false);
  });

  it("builds the page and story paths", () => {
    expect(sharePath("AbCdEfGhIj_-0123")).toBe("/t/AbCdEfGhIj_-0123");
    expect(storyPath("AbCdEfGhIj_-0123", 1727550000000)).toBe("/t/AbCdEfGhIj_-0123/story.png?v=1727550000000");
  });
});
