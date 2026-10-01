import { describe, expect, it } from "vitest";
import { afterSignInHref, emailFromLoginLinkHash, isEmailAddress, maskEmail, newLinkHref, parseLoginLinkHash } from "./login-link";

describe("the sign-in link's fragment", () => {
  it("parses address, code and a safe next", () => {
    expect(parseLoginLinkHash("#e=Ana%40Gmail.com&c=482913&next=%2Fapp%2Fprograms")).toEqual({
      email: "ana@gmail.com",
      otp: "482913",
      next: "/app/programs",
    });
    expect(parseLoginLinkHash("e=a%40b.co&c=000001")).toEqual({ email: "a@b.co", otp: "000001", next: null });
  });

  it("drops an unsafe next, and refuses a missing or malformed code or address", () => {
    expect(parseLoginLinkHash("#e=a%40b.co&c=123456&next=https%3A%2F%2Fevil.com")?.next).toBeNull();
    expect(parseLoginLinkHash("#e=a%40b.co&c=123456&next=%2F%2Fevil.com")?.next).toBeNull();
    expect(parseLoginLinkHash("#e=a%40b.co&c=12345")).toBeNull();
    expect(parseLoginLinkHash("#e=a%40b.co&c=12345a")).toBeNull();
    expect(parseLoginLinkHash("#e=nope&c=123456")).toBeNull();
    expect(parseLoginLinkHash("")).toBeNull();
    expect(emailFromLoginLinkHash("#e=a%40b.co")).toBe("a@b.co");
    expect(emailFromLoginLinkHash("#c=123456")).toBeNull();
  });

  it("masks the address and builds the way on", () => {
    expect(maskEmail("ana.souza@gmail.com")).toBe("a•••@gmail.com");
    expect(newLinkHref("a@b.co", "/app/history")).toBe("/login?email=a%40b.co&next=%2Fapp%2Fhistory");
    expect(newLinkHref(null, null)).toBe("/login");
    expect(afterSignInHref(null)).toBe("/onboarding?next=%2Fapp%2Ftoday");
    expect(isEmailAddress("a@b.co")).toBe(true);
    expect(isEmailAddress("a@b")).toBe(false);
    expect(isEmailAddress("a b@c.co")).toBe(false);
  });
});
