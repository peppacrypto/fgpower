-- New-user onboarding: an optional year of birth on the profile.
--
-- The onboarding wizard now asks for age and weight (collected for the user's
-- own profile; they do not change which program the recommender picks). Age is
-- stored as a year of birth so the value never ages; weight becomes the first
-- BodyMetric weigh-in and needs no column. Nullable with no default: every
-- existing row stays untouched (null = never asked).
ALTER TABLE "Profile" ADD COLUMN "birthYear" INTEGER;
