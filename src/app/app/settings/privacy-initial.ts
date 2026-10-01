import type { PrivacySettings } from "@/lib/actions/profile";

/**
 * The Privacidade block's starting values, from the profile row. Kept next to
 * privacy-form.tsx (same owner) so its fields can change without touching
 * the Settings page. autoShareAchievements and showBodyMetricsPublicly stay
 * in the table (an image rollback still reads them) but nothing offers them:
 * records aren't posts (decision 9), and no public surface shows body data.
 */
export function privacyInitial(profile: PrivacySettings): PrivacySettings {
  return {
    isPublicAccount: profile.isPublicAccount,
    defaultWorkoutVisibility: profile.defaultWorkoutVisibility,
    showLoadsPublicly: profile.showLoadsPublicly,
    showCurrentProgram: profile.showCurrentProgram,
    discoverable: profile.discoverable,
  };
}
