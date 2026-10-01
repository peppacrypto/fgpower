import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGIN_CODES_DAILY_BUDGET,
  emailOtpGate,
  isEmailOtpPath,
  loginCodeBudgetVerdict,
  loginCodesDailyBudget,
} from "./login-gate";

describe("emailOtpGate", () => {
  it("lets every other auth route through, e-mail on or off", () => {
    for (const path of ["/sign-in/social", "/get-session", "/sign-out", "/sign-in/email", "/callback/google"]) {
      expect(isEmailOtpPath(path)).toBe(false);
      expect(emailOtpGate(path, {}, true)).toBeNull();
      expect(emailOtpGate(path, {}, false)).toBeNull();
    }
  });

  it("offers only sending a sign-in code and signing in with it", () => {
    expect(emailOtpGate("/email-otp/send-verification-otp", { email: "a@b.co", type: "sign-in" }, true)).toBeNull();
    expect(emailOtpGate("/sign-in/email-otp", { email: "a@b.co", otp: "123456" }, true)).toBeNull();
    for (const path of [
      "/email-otp/check-verification-otp",
      "/email-otp/verify-email",
      "/email-otp/request-password-reset",
      "/email-otp/reset-password",
      "/forget-password/email-otp",
      "/email-otp/request-email-change",
      "/email-otp/change-email",
      "/email-otp/get-verification-otp",
    ]) {
      expect(isEmailOtpPath(path)).toBe(true);
      expect(emailOtpGate(path, {}, true)).toEqual({ status: "NOT_FOUND" });
    }
  });

  it("answers 404 for every e-mail route while e-mail is off", () => {
    expect(emailOtpGate("/email-otp/send-verification-otp", { type: "sign-in" }, false)).toEqual({ status: "NOT_FOUND" });
    expect(emailOtpGate("/sign-in/email-otp", { email: "a@b.co", otp: "1" }, false)).toEqual({ status: "NOT_FOUND" });
  });

  it("refuses codes of another type", () => {
    for (const type of ["email-verification", "forget-password", "change-email", undefined]) {
      expect(emailOtpGate("/email-otp/send-verification-otp", { email: "a@b.co", type }, true)).toMatchObject({
        status: "BAD_REQUEST",
      });
    }
  });

  it("takes nothing but the address and the code on sign-in (no name, image or user fields)", () => {
    for (const extra of [{ name: "X" }, { image: "http://169.254.169.254/" }, { role: "admin" }, { username: "x" }]) {
      expect(emailOtpGate("/sign-in/email-otp", { email: "a@b.co", otp: "123456", ...extra }, true)).toMatchObject({
        status: "BAD_REQUEST",
      });
    }
  });
});

describe("login code budgets", () => {
  const base = { addressLastHour: 0, addressLastDay: 0, allLastDay: 0, dailyBudget: 80 };
  it("5 an hour and 10 a day per address, then the global budget", () => {
    expect(loginCodeBudgetVerdict(base)).toBe("ok");
    expect(loginCodeBudgetVerdict({ ...base, addressLastHour: 4, addressLastDay: 9 })).toBe("ok");
    expect(loginCodeBudgetVerdict({ ...base, addressLastHour: 5, addressLastDay: 5 })).toBe("address");
    expect(loginCodeBudgetVerdict({ ...base, addressLastHour: 0, addressLastDay: 10 })).toBe("address");
    expect(loginCodeBudgetVerdict({ ...base, allLastDay: 79 })).toBe("ok");
    expect(loginCodeBudgetVerdict({ ...base, allLastDay: 80 })).toBe("global");
  });

  it("reads the daily budget from the environment, positive integers only", () => {
    expect(loginCodesDailyBudget(undefined)).toBe(DEFAULT_LOGIN_CODES_DAILY_BUDGET);
    expect(loginCodesDailyBudget("50")).toBe(50);
    for (const bad of ["", "0", "-3", "abc", "2.5"]) expect(loginCodesDailyBudget(bad)).toBe(DEFAULT_LOGIN_CODES_DAILY_BUDGET);
  });
});
