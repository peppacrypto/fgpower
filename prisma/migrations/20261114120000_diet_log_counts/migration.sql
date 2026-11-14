-- Dieta: an item counted in pieces (eggs with or without the yolk) logs how many of each kind it was eaten in.
-- Nullable, no default: every row so far is an item as planned. Metadata-only on Postgres (no rewrite).
ALTER TABLE "DietLog" ADD COLUMN "counts" JSONB;
