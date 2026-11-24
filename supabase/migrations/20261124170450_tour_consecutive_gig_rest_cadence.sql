-- Legacy tours used a rest period between every gig, so default to 1 for
-- existing rows while newly created tours save the player's chosen cadence.
ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS consecutive_show_count integer NOT NULL DEFAULT 1
  CONSTRAINT tours_consecutive_show_count_range CHECK (consecutive_show_count BETWEEN 1 AND 30);

COMMENT ON COLUMN public.tours.consecutive_show_count IS
  'Number of consecutive gig dates before inserting min_rest_days days off; no trailing rest period after the final gig.';
