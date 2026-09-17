-- Compatibility shim for installations where the canonical achievement migration
-- has not yet landed. PostgreSQL UNIQUE indexes allow multiple NULL values, so this
-- matches the later canonical `achievements_slug_unique` index while allowing legacy
-- achievements to remain un-slugged until their normal migration/backfill runs.
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS slug text;
DROP INDEX IF EXISTS public.achievements_slug_unique;
CREATE UNIQUE INDEX achievements_slug_unique ON public.achievements(slug);
