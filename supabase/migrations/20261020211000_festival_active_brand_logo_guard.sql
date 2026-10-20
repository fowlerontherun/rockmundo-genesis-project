-- #2182: Keep the canonical brand catalogue usable after the existing logo backfill.
-- Safe against partially reconciled legacy catalogues: never overwrite custom logos.
-- This runs after 20260928160000_backfill_canonical_sponsorship_brand_logos.sql.
DO $guard$
BEGIN
  IF to_regprocedure('public.festival_brand_monogram_logo(text,text)') IS NULL THEN
    RAISE EXCEPTION 'festival_brand_logo_backfill_required';
  END IF;
END;
$guard$;

UPDATE public.sponsorship_brands
SET logo_url = public.festival_brand_monogram_logo(name, category)
WHERE logo_url IS NULL OR btrim(logo_url) = '';

-- Independent of the future edition-bound sponsorship plan tables.
-- A database constraint protects direct API writes and edits, not just the admin UI.
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.sponsorship_brands'::regclass
      AND conname = 'sponsorship_brands_active_logo_not_blank'
  ) THEN
    ALTER TABLE public.sponsorship_brands
      ADD CONSTRAINT sponsorship_brands_active_logo_not_blank
      CHECK (
        NOT coalesce(is_active, false)
        OR nullif(btrim(logo_url), '') IS NOT NULL
      ) NOT VALID;
  END IF;
END;
$guard$;

ALTER TABLE public.sponsorship_brands
  VALIDATE CONSTRAINT sponsorship_brands_active_logo_not_blank;

COMMENT ON CONSTRAINT sponsorship_brands_active_logo_not_blank
  ON public.sponsorship_brands
IS 'Active canonical fictional brands must retain a nonblank identity; approval and rights checks remain separate from this completeness constraint.';
