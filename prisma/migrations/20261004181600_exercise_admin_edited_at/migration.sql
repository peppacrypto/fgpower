-- A-040 · Protect admin-edited exercise rows from the post-deploy reseed.
-- When set, prisma/seed.ts leaves this exercise's admin-owned name, searchText,
-- isCurated flag, coaching content and evidence links untouched.
-- Additive, nullable; existing rows stay NULL and keep tracking the catalog.
ALTER TABLE "Exercise" ADD COLUMN "adminEditedAt" TIMESTAMP(3);
