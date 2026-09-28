import type { PrivacySettings } from "@/lib/actions/profile";

/**
 * The Privacidade block's starting values, from the profile row. Kept next to
 * privacy-form.tsx (same owner) so its fields can change without touching
 * the Settings page.
 */
export function privacyInitial(profile: PrivacySettings): PrivacySettings {
  return {
    isPublicAccount: profile.isPublicAccount,
    defaultWorkoutVisibility: profile.defaultWorkoutVisibility,
    showLoadsPublicly: profile.showLoadsPublicly,
    showBodyMetricsPublicly: profile.showBodyMetricsPublicly,
    showCurrentProgram: profile.showCurrentProgram,
    discoverable: profile.discoverable,
    autoShareAchievements: profile.autoShareAchievements,
  };
}
