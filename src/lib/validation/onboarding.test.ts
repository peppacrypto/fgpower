import { describe, expect, it } from "vitest";
import { onboardingSchema, ONBOARDING_AGE, ONBOARDING_WEIGHT_KG } from "./onboarding";

/** A complete, valid submission; override to probe one field at a time. */
function raw(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Fulano",
    goal: "HYPERTROPHY",
    experience: "BEGINNER",
    daysPerWeek: "3",
    sessionMinutes: "60",
    equipmentAccess: "FULL_GYM",
    preferredDays: [],
    doesEndurance: false,
    confirmedAdult: true,
    healthConsent: true,
    ...overrides,
  };
}

describe("onboardingSchema age/weight", () => {
  it("accepts a submission with neither (optional), leaving them undefined", () => {
    const parsed = onboardingSchema.safeParse(raw());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.age).toBeUndefined();
      expect(parsed.data.weight).toBeUndefined();
    }
  });

  it("treats an empty string (a blank input) as not provided", () => {
    const parsed = onboardingSchema.safeParse(raw({ age: "", weight: "" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.age).toBeUndefined();
      expect(parsed.data.weight).toBeUndefined();
    }
  });

  it("coerces the numeric strings the form submits", () => {
    const parsed = onboardingSchema.safeParse(raw({ age: "30", weight: "72.5" }));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.age).toBe(30);
      expect(parsed.data.weight).toBe(72.5);
    }
  });

  it("rejects out-of-range values", () => {
    expect(onboardingSchema.safeParse(raw({ age: String(ONBOARDING_AGE.max + 1) })).success).toBe(false);
    expect(onboardingSchema.safeParse(raw({ age: String(ONBOARDING_AGE.min - 1) })).success).toBe(false);
    expect(onboardingSchema.safeParse(raw({ weight: String(ONBOARDING_WEIGHT_KG.max + 1) })).success).toBe(false);
    expect(onboardingSchema.safeParse(raw({ weight: String(ONBOARDING_WEIGHT_KG.min - 1) })).success).toBe(false);
  });

  it("still requires the 18+ attestation and the health consent", () => {
    expect(onboardingSchema.safeParse(raw({ confirmedAdult: false })).success).toBe(false);
    expect(onboardingSchema.safeParse(raw({ healthConsent: false })).success).toBe(false);
  });
});
