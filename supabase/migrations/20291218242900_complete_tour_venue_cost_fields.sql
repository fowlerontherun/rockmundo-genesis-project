-- Complete the tour venue cost fields after public.tour_venues has been created.
-- The original February 2025 migration sorted before the table existed.

DO $$
BEGIN
  IF to_regclass('public.tour_venues') IS NULL THEN
    RAISE EXCEPTION 'tour_venues_missing_before_cost_field_completion';
  END IF;
END
$$;

ALTER TABLE public.tour_venues
  ADD COLUMN IF NOT EXISTS travel_cost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lodging_cost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS misc_cost integer NOT NULL DEFAULT 0;

UPDATE public.tour_venues
SET
  travel_cost = COALESCE(travel_cost, 0),
  lodging_cost = COALESCE(lodging_cost, 0),
  misc_cost = COALESCE(misc_cost, 0)
WHERE
  travel_cost IS NULL
  OR lodging_cost IS NULL
  OR misc_cost IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tour_venues_travel_cost_nonnegative'
      AND conrelid = 'public.tour_venues'::regclass
  ) THEN
    ALTER TABLE public.tour_venues
      ADD CONSTRAINT tour_venues_travel_cost_nonnegative
      CHECK (travel_cost >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tour_venues_lodging_cost_nonnegative'
      AND conrelid = 'public.tour_venues'::regclass
  ) THEN
    ALTER TABLE public.tour_venues
      ADD CONSTRAINT tour_venues_lodging_cost_nonnegative
      CHECK (lodging_cost >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tour_venues_misc_cost_nonnegative'
      AND conrelid = 'public.tour_venues'::regclass
  ) THEN
    ALTER TABLE public.tour_venues
      ADD CONSTRAINT tour_venues_misc_cost_nonnegative
      CHECK (misc_cost >= 0) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.tour_venues
  VALIDATE CONSTRAINT tour_venues_travel_cost_nonnegative;
ALTER TABLE public.tour_venues
  VALIDATE CONSTRAINT tour_venues_lodging_cost_nonnegative;
ALTER TABLE public.tour_venues
  VALIDATE CONSTRAINT tour_venues_misc_cost_nonnegative;

NOTIFY pgrst, 'reload schema';