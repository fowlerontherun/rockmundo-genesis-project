-- Adds show_type enum and columns to gigs and tour_venues
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'show_type') THEN
    CREATE TYPE public.show_type AS ENUM ('standard', 'acoustic');
  END IF;
END;
$$;

ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS show_type public.show_type NOT NULL DEFAULT 'standard';

ALTER TABLE public.tour_venues
  ADD COLUMN IF NOT EXISTS show_type public.show_type NOT NULL DEFAULT 'standard';

CREATE INDEX IF NOT EXISTS gigs_show_type_idx ON public.gigs (show_type);
CREATE INDEX IF NOT EXISTS tour_venues_show_type_idx ON public.tour_venues (show_type);
