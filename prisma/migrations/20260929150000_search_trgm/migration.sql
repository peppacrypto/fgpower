-- Batch 5 · trigram search indexes (L-pg-trgm-search-index; people search in
-- Descobrir). Exercise search and people search match ILIKE '%q%', which a
-- B-tree can't serve; GIN gin_trgm_ops can (the planner may still prefer a
-- sequential scan on small tables — fine). pg_trgm is a trusted extension
-- since PostgreSQL 13. Indexes only; safe to re-run.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Exercise_searchText_trgm_idx" ON "Exercise" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ExerciseAlias_alias_trgm_idx" ON "ExerciseAlias" USING GIN ("alias" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "user_username_trgm_idx" ON "user" USING GIN ("username" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "user_name_trgm_idx" ON "user" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Profile_displayName_trgm_idx" ON "Profile" USING GIN ("displayName" gin_trgm_ops);
